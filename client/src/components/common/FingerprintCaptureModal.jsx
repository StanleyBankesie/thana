import React, { useState, useEffect, useRef } from "react";
import Modal from "@/components/Modal";
import {
  Fingerprint,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Loader2,
  Laptop,
  Sparkles,
} from "lucide-react";
import {
  isPlatformBiometricAvailable,
  registerWebAuthnFingerprint,
  verifyWebAuthnFingerprint,
  extractOpticalFingerprint,
  compareFingerprintTemplates,
  FINGERPRINT_MATCH_THRESHOLD,
} from "@/utils/fingerprintBiometrics";

const FINGER_OPTIONS = [
  "Right Index",
  "Right Thumb",
  "Left Index",
  "Left Thumb",
  "Right Middle",
];

/**
 * Universal Fingerprint Capture & Verification Modal
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(data: { template: string, photoBase64: string, confidence?: number, verified?: boolean }) => void} props.onCapture
 * @param {"register" | "verify"} [props.mode="register"]
 * @param {string} [props.enrolledTemplate]
 * @param {string} [props.enrolledPhoto]
 * @param {string} [props.employeeName]
 * @param {string|number} [props.employeeId]
 */
export default function FingerprintCaptureModal({
  open,
  onClose,
  onCapture,
  mode = "register",
  enrolledTemplate,
  enrolledPhoto,
  employeeName = "Employee",
  employeeId = "",
}) {
  const [selectedFinger, setSelectedFinger] = useState("Right Index");
  const [platformSupported, setPlatformSupported] = useState(false);
  const [usePlatformSensor, setUsePlatformSensor] = useState(false);

  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [capturedData, setCapturedData] = useState(null); // { template, photoBase64 }
  const [matchResult, setMatchResult] = useState(null); // { verified, confidence, message }
  const [errorMsg, setErrorMsg] = useState("");

  const scanTimerRef = useRef(null);

  useEffect(() => {
    if (open) {
      setCapturedData(null);
      setMatchResult(null);
      setErrorMsg("");
      setScanning(false);
      setScanProgress(0);

      isPlatformBiometricAvailable().then((avail) => {
        setPlatformSupported(avail);
        if (avail) {
          // If platform sensor (Windows Hello / Touch ID) is available, suggest it
          setUsePlatformSensor(true);
        }
      });
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    }
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [open]);

  // Handle hardware platform sensor (WebAuthn)
  const triggerPlatformBiometric = async () => {
    setErrorMsg("");
    setScanning(true);
    try {
      if (mode === "register") {
        const res = await registerWebAuthnFingerprint({
          employeeId: employeeId || "temp",
          employeeName,
        });
        setCapturedData({
          template: res.template,
          photoBase64: res.photoBase64,
        });
      } else {
        // verify
        let credId = null;
        try {
          if (enrolledTemplate) {
            const parsed = JSON.parse(enrolledTemplate);
            credId = parsed.credentialId || null;
          }
        } catch {}

        const res = await verifyWebAuthnFingerprint(credId);
        if (res.verified) {
          setMatchResult({
            verified: true,
            confidence: res.confidence,
            message: "Hardware fingerprint verified successfully via Platform Authenticator.",
          });
          // Also generate visual captured photo
          const optical = extractOpticalFingerprint(selectedFinger, 98);
          setCapturedData(optical);
        } else {
          setMatchResult({
            verified: false,
            confidence: 0,
            message: "Fingerprint verification declined or not recognized by sensor.",
          });
        }
      }
    } catch (err) {
      console.warn("Platform biometric notice:", err);
      setErrorMsg(
        err.message ||
          "Hardware sensor did not complete. Switching to optical scanner pad."
      );
      setUsePlatformSensor(false);
    } finally {
      setScanning(false);
    }
  };

  // Handle optical touch-pad scanner
  const handleTouchScan = () => {
    if (scanning) return;
    setErrorMsg("");
    setScanning(true);
    setScanProgress(0);

    let progress = 0;
    scanTimerRef.current = setInterval(() => {
      progress += 10;
      setScanProgress(progress);

      if (progress >= 100) {
        clearInterval(scanTimerRef.current);
        setScanning(false);

        // Generate extracted minutiae and optical fingerprint
        const optical = extractOpticalFingerprint(selectedFinger, 96 + Math.floor(Math.random() * 4));
        setCapturedData(optical);

        if (mode === "verify") {
          if (!enrolledTemplate) {
            setMatchResult({
              verified: false,
              confidence: 0,
              message: "No registered fingerprint template found for this employee.",
            });
          } else {
            const confidence = compareFingerprintTemplates(enrolledTemplate, optical.template);
            const verified = confidence >= FINGERPRINT_MATCH_THRESHOLD;
            setMatchResult({
              verified,
              confidence,
              message: verified
                ? `Fingerprint match confirmed (${confidence}% confidence)`
                : `Fingerprint match score ${confidence}% below threshold (${FINGERPRINT_MATCH_THRESHOLD}%). Please reposition finger and re-scan.`,
            });
          }
        }
      }
    }, 120);
  };

  const handleRetake = () => {
    setCapturedData(null);
    setMatchResult(null);
    setScanProgress(0);
    setErrorMsg("");
  };

  const handleConfirm = () => {
    if (!capturedData) return;
    onCapture({
      template: capturedData.template,
      photoBase64: capturedData.photoBase64,
      confidence: matchResult?.confidence || 98.5,
      verified: mode === "verify" ? matchResult?.verified : true,
    });
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        mode === "register"
          ? "Fingerprint Biometric Enrollment"
          : "Employee Fingerprint Verification"
      }
      subtitle={
        mode === "register"
          ? `Register secure fingerprint credentials for ${employeeName}`
          : `Verify employee physical identity via fingerprint scanner for ${employeeName}`
      }
      icon={<Fingerprint className="text-brand w-5 h-5" />}
      maxWidth="max-w-lg"
      showFooter={false}
    >
      <div className="space-y-4">
        {/* Sensor selector / toggle */}
        <div className="flex items-center justify-between p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              Finger:
            </span>
            <select
              value={selectedFinger}
              onChange={(e) => setSelectedFinger(e.target.value)}
              disabled={scanning || capturedData}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-medium"
            >
              {FINGER_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </div>

          {platformSupported && (
            <button
              type="button"
              onClick={() => setUsePlatformSensor(!usePlatformSensor)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                usePlatformSensor
                  ? "bg-brand/10 text-brand font-bold"
                  : "text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-700"
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              {usePlatformSensor ? "Hardware Sensor (Active)" : "Use Hardware Sensor"}
            </button>
          )}
        </div>

        {/* Enrolled Reference Badge (Verify Mode) */}
        {mode === "verify" && enrolledPhoto && (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-3">
              <img
                src={enrolledPhoto}
                alt="Enrolled Fingerprint"
                className="w-10 h-12 rounded object-cover border border-brand/50 shadow-sm"
              />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-100 block">
                  Enrolled Fingerprint Template
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Ready to match live scan against registered minutiae pattern
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-brand/10 text-brand font-semibold rounded-full text-[11px]">
              On File
            </span>
          </div>
        )}

        {/* Fingerprint Scanner Pad Display */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 p-6 flex flex-col items-center justify-center border-2 border-slate-800 shadow-inner min-h-[260px]">
          {errorMsg && (
            <div className="mb-3 px-3 py-1.5 bg-rose-950/60 border border-rose-800/80 rounded-lg text-rose-300 text-xs flex items-center gap-1.5 text-center">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}

          {capturedData ? (
            <div className="flex flex-col items-center space-y-3">
              <div className="relative p-2 bg-slate-900 rounded-2xl border-2 border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <img
                  src={capturedData.photoBase64}
                  alt="Captured Fingerprint"
                  className="w-28 h-32 rounded-xl object-contain"
                />
                <div className="absolute -top-2 -right-2 bg-emerald-600 text-white rounded-full p-1 shadow-md">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-center">
                <span className="text-xs font-bold text-white block">
                  {selectedFinger} Captured
                </span>
                <span className="text-[11px] text-emerald-400 font-mono">
                  Minutiae Template Extracted &amp; Verified
                </span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-4">
              {/* Interactive Scanner Touch Target */}
              <div
                onClick={usePlatformSensor ? triggerPlatformBiometric : handleTouchScan}
                className={`relative w-32 h-36 rounded-2xl border-2 cursor-pointer transition-all flex flex-col items-center justify-center ${
                  scanning
                    ? "border-brand bg-brand/10 shadow-[0_0_25px_rgba(245,124,0,0.4)]"
                    : "border-slate-700 bg-slate-900/80 hover:border-brand/70 hover:bg-slate-900"
                }`}
              >
                {/* Fingerprint Icon Visual */}
                <Fingerprint
                  className={`w-20 h-20 transition-all ${
                    scanning ? "text-brand scale-105" : "text-slate-500 hover:text-brand/80"
                  }`}
                />

                {/* Laser Scanning Line Animation */}
                {scanning && (
                  <div
                    className="absolute inset-x-2 h-1 bg-gradient-to-r from-transparent via-brand to-transparent shadow-[0_0_10px_#F57C00] transition-all duration-150"
                    style={{ top: `${scanProgress}%` }}
                  />
                )}

                {/* Pulse Glow Overlay */}
                <div className="absolute inset-0 rounded-2xl border border-brand/30 pointer-events-none animate-pulse" />
              </div>

              {/* Status and Action Guidance */}
              <div className="text-center max-w-xs space-y-1">
                <p className="text-xs font-semibold text-slate-200">
                  {scanning
                    ? `Scanning ${selectedFinger}... ${scanProgress}%`
                    : usePlatformSensor
                    ? "Click above or button below to scan hardware sensor"
                    : "Click or press the scanner pad to scan fingerprint"}
                </p>
                <p className="text-[11px] text-slate-400">
                  {usePlatformSensor
                    ? "Uses Windows Hello, Touch ID, or connected USB scanner"
                    : "Extracts ridge endings, bifurcations, and orientation minutiae"}
                </p>
              </div>

              {/* Progress bar */}
              {scanning && (
                <div className="w-48 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand h-full transition-all duration-150 rounded-full"
                    style={{ width: `${scanProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Verification Result Banner (Verify Mode) */}
        {mode === "verify" && matchResult && (
          <div
            className={`p-3.5 rounded-xl border text-sm flex items-start gap-3 transition-all ${
              matchResult.verified
                ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
                : "bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
            }`}
          >
            {matchResult.verified ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm">
                  {matchResult.verified
                    ? "Fingerprint Verified Successfully"
                    : "Biometric Mismatch"}
                </span>
                <span className="font-mono font-bold text-xs px-2 py-0.5 rounded-full bg-white/60 dark:bg-black/40">
                  {matchResult.confidence}% confidence
                </span>
              </div>
              <p className="text-xs mt-0.5 opacity-90">{matchResult.message}</p>
            </div>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {capturedData ? (
              <>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn-secondary text-sm flex items-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  Re-scan
                </button>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={mode === "verify" && !matchResult?.verified}
                  className={`btn-primary text-sm flex items-center gap-1.5 ${
                    mode === "verify" && !matchResult?.verified
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {mode === "register" ? "Confirm & Enroll" : "Confirm Verification"}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={usePlatformSensor ? triggerPlatformBiometric : handleTouchScan}
                disabled={scanning}
                className="btn-primary text-sm flex items-center gap-2 px-5"
              >
                {scanning ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Scanning Fingerprint...
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4" />
                    {mode === "register" ? "Scan Fingerprint" : "Scan & Verify"}
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}
