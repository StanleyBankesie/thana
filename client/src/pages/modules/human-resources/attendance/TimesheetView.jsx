/**
 * @fileoverview TimesheetView component.
 * Provides functionality for Timesheet modal entry with live facial recognition & fingerprint verification & GPS coordinates.
 */

import React, { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client.js";
import { toast } from "react-toastify";
import Modal from "@/components/Modal";
import FaceCaptureModal from "@/components/common/FaceCaptureModal";
import FingerprintCaptureModal from "@/components/common/FingerprintCaptureModal";
import {
  Clock,
  MapPin,
  Camera,
  Fingerprint,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Calendar,
  User,
  Info,
  Sparkles,
} from "lucide-react";

/**
 * Universal Timesheet Modal with Dual Biometric Verification (Face & Fingerprint)
 *
 * @param {object} props
 * @param {boolean} [props.isOpen=true]
 * @param {() => void} [props.onClose]
 * @param {() => void} [props.onSuccess]
 * @returns {JSX.Element}
 */
export default function TimesheetView({ isOpen = true, onClose, onSuccess }) {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [regularWorkingHours, setRegularWorkingHours] = useState(8);

  // Biometric modals
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [showFingerprintModal, setShowFingerprintModal] = useState(false);

  // Biometric active tab: "face" | "fingerprint"
  const [biometricTab, setBiometricTab] = useState("face");

  // Biometric verification state
  const [faceVerification, setFaceVerification] = useState({
    verified: false,
    confidence: null,
    capturedPhoto: null,
    verifiedAt: null,
  });

  const [fingerprintVerification, setFingerprintVerification] = useState({
    verified: false,
    confidence: null,
    capturedPhoto: null,
    verifiedAt: null,
  });

  const [form, setForm] = useState({
    employee_id: "",
    work_date: new Date().toISOString().slice(0, 10),
    time_in: "",
    time_out: "",
    hours_worked: 0,
    overtime_hours: 0,
    short_hours: 0,
    location_gps: "",
    remarks: "",
    on_leave: false,
  });

  const handleClose = () => {
    if (onClose) onClose();
    else navigate("/human-resources?section=Time%20%26%20Attendance");
  };

  useEffect(() => {
    loadEmployees();
    loadParameters();
    getCurrentLocation();
  }, []);

  const loadParameters = async () => {
    try {
      const res = await api.get("/hr/setup/parameters");
      const params = res?.data?.items || [];
      const wh = params.find((p) => p.param_key === "REGULAR_WORKING_HOURS");
      if (wh) setRegularWorkingHours(Number(wh.param_value));
    } catch {}
  };

  const getCurrentLocation = () => {
    if (form.on_leave) return;
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setForm((prev) => ({
            ...prev,
            location_gps: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
          }));
        },
        (error) => {
          console.warn("Error getting location:", error);
        }
      );
    }
  };

  // Live hours calculations
  useEffect(() => {
    if (form.time_in && form.time_out) {
      const start = new Date(`2000-01-01T${form.time_in}`);
      const end = new Date(`2000-01-01T${form.time_out}`);
      let diff = (end - start) / (1000 * 60 * 60);
      if (diff < 0) diff += 24;

      const regular = Math.min(diff, regularWorkingHours);
      const ot = Math.max(0, diff - regularWorkingHours);
      const short = Math.max(0, regularWorkingHours - diff);

      setForm((prev) => ({
        ...prev,
        hours_worked: regular.toFixed(2),
        overtime_hours: ot.toFixed(2),
        short_hours: short.toFixed(2),
      }));
    }
  }, [form.time_in, form.time_out, regularWorkingHours]);

  const loadEmployees = async () => {
    try {
      const res = await api.get("/hr/employees?status=ALL");
      setEmployees(res.data?.items || []);
    } catch {}
  };

  // Find currently selected employee object
  const selectedEmployee = useMemo(() => {
    if (!form.employee_id) return null;
    return employees.find((e) => String(e.id) === String(form.employee_id)) || null;
  }, [employees, form.employee_id]);

  // Reset biometric verifications when selected employee changes
  const handleEmployeeChange = (empId) => {
    setForm((prev) => ({ ...prev, employee_id: empId }));
    setFaceVerification({
      verified: false,
      confidence: null,
      capturedPhoto: null,
      verifiedAt: null,
    });
    setFingerprintVerification({
      verified: false,
      confidence: null,
      capturedPhoto: null,
      verifiedAt: null,
    });

    // Auto-select active biometric tab based on employee enrollments
    const emp = employees.find((e) => String(e.id) === String(empId));
    if (emp) {
      if (emp.fingerprint_template && !emp.face_descriptor) {
        setBiometricTab("fingerprint");
      } else {
        setBiometricTab("face");
      }
    }
  };

  const handleFaceVerified = ({ descriptor, photoBase64, confidence, verified }) => {
    setFaceVerification({
      verified: Boolean(verified),
      confidence,
      capturedPhoto: photoBase64,
      verifiedAt: new Date().toLocaleTimeString(),
    });
    if (verified) {
      toast.success(`Face identity confirmed (${confidence}% match)!`);
    } else {
      toast.warn("Face biometric match was below threshold.");
    }
  };

  const handleFingerprintVerified = ({ template, photoBase64, confidence, verified }) => {
    setFingerprintVerification({
      verified: Boolean(verified),
      confidence,
      capturedPhoto: photoBase64,
      verifiedAt: new Date().toLocaleTimeString(),
    });
    if (verified) {
      toast.success(`Fingerprint verified successfully (${confidence}% match)!`);
    } else {
      toast.warn("Fingerprint verification was below threshold.");
    }
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Please select an employee");

    const isVerified = faceVerification.verified || fingerprintVerification.verified;
    const hasEnrolledBiometrics =
      selectedEmployee?.face_descriptor || selectedEmployee?.fingerprint_template;

    // If employee has biometrics enrolled but neither was verified, confirm with user
    if (hasEnrolledBiometrics && !isVerified && !form.on_leave) {
      const proceed = window.confirm(
        "Biometric verification (Face or Fingerprint) has not been confirmed for this employee. Proceed with saving without biometric verification?"
      );
      if (!proceed) {
        if (biometricTab === "fingerprint" && selectedEmployee.fingerprint_template) {
          setShowFingerprintModal(true);
        } else if (selectedEmployee.face_descriptor) {
          setShowFaceModal(true);
        } else {
          setShowFingerprintModal(true);
        }
        return;
      }
    }

    setLoading(true);
    try {
      let bioType = "NONE";
      if (faceVerification.verified && fingerprintVerification.verified) bioType = "BOTH";
      else if (faceVerification.verified) bioType = "FACE";
      else if (fingerprintVerification.verified) bioType = "FINGERPRINT";

      const payload = {
        ...form,
        face_verified: faceVerification.verified ? 1 : 0,
        face_confidence: faceVerification.confidence || null,
        captured_face_photo: faceVerification.capturedPhoto || null,
        fingerprint_verified: fingerprintVerification.verified ? 1 : 0,
        fingerprint_confidence: fingerprintVerification.confidence || null,
        biometric_type: bioType,
      };

      await api.post("/hr/timesheets", payload);
      toast.success("Timesheet entry saved successfully");
      if (onSuccess) onSuccess();
      handleClose();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save timesheet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Modal
        open={isOpen}
        onClose={handleClose}
        title="Timesheet Entry & Biometric Verification"
        subtitle="Log employee working hours with facial recognition, fingerprint verification & GPS location"
        icon={<Clock className="text-brand w-5 h-5" />}
        maxWidth="max-w-4xl"
        showFooter={false}
      >
        <form onSubmit={save} className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Core Work Details */}
            <div className="lg:col-span-7 space-y-4">
              <div>
                <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">
                  Employee <span className="text-rose-500">*</span>
                </label>
                <select
                  className="input text-sm w-full"
                  value={form.employee_id}
                  onChange={(e) => handleEmployeeChange(e.target.value)}
                  required
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.emp_code ? `${e.emp_code} - ` : ""}
                      {e.first_name} {e.last_name}
                      {e.face_descriptor && e.fingerprint_template
                        ? "  [📸 Face & 🖐️ Fingerprint]"
                        : e.face_descriptor
                        ? "  [📸 Face]"
                        : e.fingerprint_template
                        ? "  [🖐️ Fingerprint]"
                        : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* On Leave Checkbox */}
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60">
                <input
                  type="checkbox"
                  id="on_leave_check"
                  checked={form.on_leave}
                  onChange={async (e) => {
                    const on_leave = e.target.checked;
                    if (on_leave && form.employee_id) {
                      try {
                        const res = await api.get(
                          `/hr/work-schedules?employee_id=${form.employee_id}`
                        );
                        const item = (res.data?.items || [])[0];
                        if (item?.start_time && item?.end_time) {
                          setForm((prev) => ({
                            ...prev,
                            on_leave: true,
                            time_in: item.start_time,
                            time_out: item.end_time,
                            location_gps: "",
                            remarks: prev.remarks || "Leave",
                          }));
                        } else {
                          setForm((prev) => ({ ...prev, on_leave }));
                          toast.info("No shift schedule found; set times manually");
                        }
                      } catch {
                        setForm((prev) => ({ ...prev, on_leave }));
                        toast.error("Failed to load shift times");
                      }
                    } else {
                      setForm((prev) => ({
                        ...prev,
                        on_leave,
                        location_gps: prev.location_gps || "",
                      }));
                      if (!on_leave) getCurrentLocation();
                    }
                  }}
                  className="rounded text-brand focus:ring-brand h-4 w-4"
                />
                <label
                  htmlFor="on_leave_check"
                  className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer select-none"
                >
                  Employee On Leave / Vacation / Official Off
                </label>
              </div>

              {/* Work Date */}
              <div>
                <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">
                  Work Date <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    className="input text-sm w-full pr-10"
                    value={form.work_date}
                    onChange={(e) =>
                      setForm({ ...form, work_date: e.target.value })
                    }
                    required
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Time In & Time Out */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">
                    Time In <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="input text-sm w-full"
                    value={form.time_in}
                    onChange={(e) =>
                      setForm({ ...form, time_in: e.target.value })
                    }
                    required={!form.on_leave}
                  />
                </div>
                <div>
                  <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">
                    Time Out <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    className="input text-sm w-full"
                    value={form.time_out}
                    onChange={(e) =>
                      setForm({ ...form, time_out: e.target.value })
                    }
                    required={!form.on_leave}
                  />
                </div>
              </div>

              {/* Computed Hours Summary Cards */}
              <div className="grid grid-cols-3 gap-2.5 p-3 bg-slate-50 dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-700/60 text-center">
                <div>
                  <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider block">
                    Regular
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-100 font-mono">
                    {Number(form.hours_worked || 0).toFixed(1)} hrs
                  </span>
                </div>
                <div className="border-x border-slate-200 dark:border-slate-700/60 px-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400 tracking-wider block">
                    Overtime
                  </span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {Number(form.overtime_hours || 0).toFixed(1)} hrs
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase text-amber-600 dark:text-amber-400 tracking-wider block">
                    Short
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-400 font-mono">
                    {Number(form.short_hours || 0).toFixed(1)} hrs
                  </span>
                </div>
              </div>

              {/* Location (GPS) */}
              <div>
                <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block flex items-center justify-between">
                  <span>Location (GPS Coordinates)</span>
                  {form.location_gps && (
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium lowercase">
                      ✓ coordinates locked
                    </span>
                  )}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className="input bg-slate-50 dark:bg-slate-900 text-xs w-full pl-8 font-mono text-slate-700 dark:text-slate-300"
                      value={form.location_gps}
                      placeholder="Coordinates (e.g. 5.554500, -0.190200)"
                      readOnly
                    />
                    <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    type="button"
                    onClick={getCurrentLocation}
                    className="btn-secondary text-xs px-3 flex items-center gap-1.5 shrink-0"
                    title="Fetch Current Location"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    GPS
                  </button>
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="label text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1.5 block">
                  Remarks / Task Details
                </label>
                <textarea
                  className="input h-16 text-xs w-full"
                  placeholder="Notes on tasks, site, or duties..."
                  value={form.remarks}
                  onChange={(e) =>
                    setForm({ ...form, remarks: e.target.value })
                  }
                />
              </div>
            </div>

            {/* Right Column: Biometric Recognition (Face & Fingerprint) Workspace */}
            <div className="lg:col-span-5 flex flex-col justify-between p-4 bg-slate-50/70 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-slate-700/60 space-y-4">
              <div>
                {/* Header & Biometric Tabs */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-brand/10 text-brand rounded-lg">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                        Biometric Verification
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Authenticate presence via Face or Fingerprint
                      </p>
                    </div>
                  </div>
                </div>

                {/* Tab switcher: Face vs Fingerprint */}
                {selectedEmployee && (
                  <div className="flex rounded-xl bg-slate-200/70 dark:bg-slate-900/60 p-1 mb-3">
                    <button
                      type="button"
                      onClick={() => setBiometricTab("face")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        biometricTab === "face"
                          ? "bg-white dark:bg-slate-800 text-brand shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      Face Scan
                      {faceVerification.verified && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setBiometricTab("fingerprint")}
                      className={`flex-1 py-1.5 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                        biometricTab === "fingerprint"
                          ? "bg-white dark:bg-slate-800 text-brand shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
                      }`}
                    >
                      <Fingerprint className="w-3.5 h-3.5" />
                      Fingerprint
                      {fingerprintVerification.verified && (
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      )}
                    </button>
                  </div>
                )}

                {!selectedEmployee ? (
                  <div className="p-8 text-center bg-white dark:bg-slate-800 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400 space-y-2">
                    <User className="w-8 h-8 mx-auto opacity-40" />
                    <p className="text-xs">
                      Please select an employee on the left to verify biometric credentials.
                    </p>
                  </div>
                ) : biometricTab === "face" ? (
                  /* ================= FACIAL VERIFICATION TAB ================= */
                  !selectedEmployee.face_descriptor ? (
                    <div className="p-4 bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                      <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold block">Face Biometrics Not Enrolled</span>
                          <p className="opacity-90 mt-0.5">
                            {selectedEmployee.first_name} has not registered face credentials. You can use <strong>Fingerprint</strong> instead if enrolled, or enroll in Employee Setup.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Enrolled Reference */}
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img
                          src={selectedEmployee.face_photo || selectedEmployee.picture_url}
                          alt="Enrolled profile"
                          className="w-12 h-12 rounded-lg object-cover border border-emerald-500/50 shadow-sm shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                              {selectedEmployee.first_name} {selectedEmployee.last_name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              Face Enrolled
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
                            {selectedEmployee.emp_code}
                          </span>
                        </div>
                      </div>

                      {/* Result */}
                      {faceVerification.verified ? (
                        <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/30 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-3">
                          <div className="flex items-center gap-3">
                            {faceVerification.capturedPhoto && (
                              <img
                                src={faceVerification.capturedPhoto}
                                alt="Live capture"
                                className="w-12 h-12 rounded-lg object-cover border-2 border-emerald-500 shadow-sm shrink-0"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                Facial Identity Confirmed!
                              </div>
                              <span className="text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 block mt-0.5">
                                {faceVerification.confidence}% Biometric Match
                              </span>
                              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400 block">
                                Verified at {faceVerification.verifiedAt}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowFaceModal(true)}
                            className="w-full py-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-white/70 dark:bg-black/30 hover:bg-white rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors font-medium flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Re-scan Live Face
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                          <div className="w-10 h-10 rounded-full bg-brand/10 text-brand mx-auto flex items-center justify-center">
                            <Camera className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 block">
                              Live Face Scan Pending
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                              Verify that the employee is physically in front of camera.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowFaceModal(true)}
                            className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Camera className="w-4 h-4" />
                            Start Live Face Scan
                          </button>
                        </div>
                      )}
                    </div>
                  )
                ) : (
                  /* ================= FINGERPRINT VERIFICATION TAB ================= */
                  !selectedEmployee.fingerprint_template ? (
                    <div className="p-4 bg-amber-50/80 dark:bg-amber-950/20 rounded-xl border border-amber-200/80 dark:border-amber-800/60 space-y-3">
                      <div className="flex items-start gap-2.5 text-amber-800 dark:text-amber-200">
                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="text-xs">
                          <span className="font-bold block">Fingerprint Not Enrolled</span>
                          <p className="opacity-90 mt-0.5">
                            {selectedEmployee.first_name} has not registered fingerprint credentials. You can use <strong>Face Scan</strong> instead or enroll in Employee Setup.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Enrolled Reference */}
                      <div className="flex items-center gap-3 p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                        <img
                          src={selectedEmployee.fingerprint_photo || "/assets/fingerprint-placeholder.png"}
                          alt="Enrolled fingerprint"
                          className="w-10 h-12 rounded object-contain bg-slate-950 border border-emerald-500/50 shadow-sm shrink-0 p-0.5"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 truncate">
                              {selectedEmployee.first_name} {selectedEmployee.last_name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                              Fingerprint Enrolled
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 block">
                            {selectedEmployee.emp_code}
                          </span>
                        </div>
                      </div>

                      {/* Result */}
                      {fingerprintVerification.verified ? (
                        <div className="p-3.5 bg-emerald-50/90 dark:bg-emerald-950/30 rounded-xl border border-emerald-300 dark:border-emerald-800 space-y-3">
                          <div className="flex items-center gap-3">
                            {fingerprintVerification.capturedPhoto && (
                              <img
                                src={fingerprintVerification.capturedPhoto}
                                alt="Live fingerprint"
                                className="w-10 h-12 rounded object-contain bg-slate-950 border-2 border-emerald-500 shadow-sm shrink-0 p-0.5"
                              />
                            )}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                                <CheckCircle2 className="w-4 h-4 shrink-0" />
                                Fingerprint Verified!
                              </div>
                              <span className="text-[11px] font-mono font-semibold text-emerald-800 dark:text-emerald-200 block mt-0.5">
                                {fingerprintVerification.confidence}% Ridge Pattern Match
                              </span>
                              <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400 block">
                                Verified at {fingerprintVerification.verifiedAt}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setShowFingerprintModal(true)}
                            className="w-full py-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-white/70 dark:bg-black/30 hover:bg-white rounded-lg border border-emerald-200 dark:border-emerald-800 transition-colors font-medium flex items-center justify-center gap-1.5"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            Re-scan Fingerprint
                          </button>
                        </div>
                      ) : (
                        <div className="p-4 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 text-center space-y-3">
                          <div className="w-10 h-10 rounded-full bg-brand/10 text-brand mx-auto flex items-center justify-center">
                            <Fingerprint className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-slate-800 dark:text-slate-100 block">
                              Fingerprint Scan Pending
                            </span>
                            <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 block">
                              Verify via hardware biometric sensor or optical touch pad.
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setShowFingerprintModal(true)}
                            className="btn-primary text-xs w-full py-2 flex items-center justify-center gap-2 shadow-sm"
                          >
                            <Fingerprint className="w-4 h-4" />
                            Start Fingerprint Scan
                          </button>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Security Audit Badge */}
              <div className="p-2.5 bg-slate-100/70 dark:bg-slate-900/40 rounded-xl border border-slate-200/80 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  All biometric verification events and GPS stamps are permanently logged in timesheets &amp; attendance.
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 flex items-center gap-2">
              {faceVerification.verified && fingerprintVerification.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Dual Biometrics Verified (Face &amp; Fingerprint)
                </span>
              ) : faceVerification.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Face Verified ({faceVerification.confidence}%)
                </span>
              ) : fingerprintVerification.verified ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Fingerprint Verified ({fingerprintVerification.confidence}%)
                </span>
              ) : selectedEmployee?.face_descriptor || selectedEmployee?.fingerprint_template ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> Biometric verification pending
                </span>
              ) : (
                <span className="text-slate-400">Standard timesheet entry</span>
              )}
            </div>

            <div className="flex items-center gap-2.5 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="btn-secondary text-sm px-4"
              >
                Cancel
              </button>
              <button
                className="btn-primary text-sm px-6"
                type="submit"
                disabled={loading}
              >
                {loading ? "Saving..." : "Save Timesheet"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Live Facial Scanner Modal */}
      {showFaceModal && (
        <FaceCaptureModal
          open={showFaceModal}
          onClose={() => setShowFaceModal(false)}
          onCapture={handleFaceVerified}
          mode="verify"
          enrolledDescriptor={selectedEmployee?.face_descriptor}
          enrolledPhoto={selectedEmployee?.face_photo || selectedEmployee?.picture_url}
          employeeName={
            selectedEmployee
              ? `${selectedEmployee.first_name || ""} ${selectedEmployee.last_name || ""}`.trim()
              : "Employee"
          }
        />
      )}

      {/* Live Fingerprint Scanner Modal */}
      {showFingerprintModal && (
        <FingerprintCaptureModal
          open={showFingerprintModal}
          onClose={() => setShowFingerprintModal(false)}
          onCapture={handleFingerprintVerified}
          mode="verify"
          enrolledTemplate={selectedEmployee?.fingerprint_template}
          enrolledPhoto={selectedEmployee?.fingerprint_photo}
          employeeName={
            selectedEmployee
              ? `${selectedEmployee.first_name || ""} ${selectedEmployee.last_name || ""}`.trim()
              : "Employee"
          }
          employeeId={selectedEmployee?.id || selectedEmployee?.emp_code}
        />
      )}
    </>
  );
}
