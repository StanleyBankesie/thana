import React, { useState, useRef, useEffect } from "react";
import Modal from "@/components/Modal";
import {
  Camera,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ShieldCheck,
  Eye,
  Loader2,
} from "lucide-react";
import {
  extractFaceDescriptor,
  compareFaceDescriptors,
  FACE_MATCH_THRESHOLD,
} from "@/utils/faceBiometrics";

/**
 * Universal Biometric Face Capture & Verification Modal
 *
 * @param {object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {(data: { descriptor: number[], photoBase64: string, confidence?: number, verified?: boolean }) => void} props.onCapture
 * @param {"register" | "verify"} [props.mode="register"]
 * @param {string | number[]} [props.enrolledDescriptor]
 * @param {string} [props.enrolledPhoto]
 * @param {string} [props.employeeName]
 */
export default function FaceCaptureModal({
  open,
  onClose,
  onCapture,
  mode = "register",
  enrolledDescriptor,
  enrolledPhoto,
  employeeName = "Employee",
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [capturedPhoto, setCapturedPhoto] = useState(null);
  const [capturedDescriptor, setCapturedDescriptor] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState(null); // { confidence, verified }

  // Start webcam when modal opens
  useEffect(() => {
    if (open) {
      setCapturedPhoto(null);
      setCapturedDescriptor(null);
      setMatchResult(null);
      setCameraError("");
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [open]);

  const startCamera = async () => {
    try {
      setCameraError("");
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError(
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
          ? "Camera permission denied. Please allow camera access in your browser to proceed with biometric scanning."
          : "Could not start camera. Please verify your webcam is connected and not in use by another application."
      );
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const handleCapture = () => {
    if (!videoRef.current) return;
    setAnalyzing(true);
    try {
      const { descriptor, photoBase64 } = extractFaceDescriptor(videoRef.current);
      setCapturedPhoto(photoBase64);
      setCapturedDescriptor(descriptor);

      if (mode === "verify") {
        if (!enrolledDescriptor) {
          setMatchResult({
            confidence: 0,
            verified: false,
            message: "No registered biometric face descriptor found for this employee.",
          });
        } else {
          const confidence = compareFaceDescriptors(enrolledDescriptor, descriptor);
          const verified = confidence >= FACE_MATCH_THRESHOLD;
          setMatchResult({
            confidence,
            verified,
            message: verified
              ? `Biometric match confirmed (${confidence}% confidence)`
              : `Biometric confidence ${confidence}% is below threshold (${FACE_MATCH_THRESHOLD}%). Please reposition and re-scan.`,
          });
        }
      }
    } catch (err) {
      console.error("Biometric extraction error:", err);
      setCameraError("Failed to extract facial features. Ensure your face is centered and well-lit.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    setCapturedDescriptor(null);
    setMatchResult(null);
    if (!streamRef.current) {
      startCamera();
    }
  };

  const handleConfirm = () => {
    if (!capturedDescriptor || !capturedPhoto) return;
    onCapture({
      descriptor: capturedDescriptor,
      photoBase64: capturedPhoto,
      confidence: matchResult?.confidence,
      verified: mode === "verify" ? matchResult?.verified : true,
    });
    stopCamera();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        stopCamera();
        onClose();
      }}
      title={
        mode === "register"
          ? "Facial Biometric Enrollment"
          : "Employee Facial Recognition Verification"
      }
      subtitle={
        mode === "register"
          ? `Register secure facial credentials for ${employeeName}`
          : `Verify live biometric credentials for ${employeeName} at current location`
      }
      icon={<Camera className="text-brand w-5 h-5" />}
      maxWidth="max-w-xl"
      showFooter={false}
    >
      <div className="space-y-4">
        {/* Enrolled Face Reference Comparison (in verify mode) */}
        {mode === "verify" && enrolledPhoto && (
          <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
            <div className="flex items-center gap-3">
              <img
                src={enrolledPhoto}
                alt="Enrolled profile"
                className="w-12 h-12 rounded-lg object-cover border border-brand/40 shadow-sm"
              />
              <div>
                <span className="font-semibold text-slate-800 dark:text-slate-100 block">
                  Registered Profile Photo
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Comparing live camera capture against enrolled credentials
                </span>
              </div>
            </div>
            <span className="px-2.5 py-1 bg-brand/10 text-brand font-semibold rounded-full text-[11px]">
              Enrolled
            </span>
          </div>
        )}

        {/* Viewfinder / Camera Display */}
        <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-[4/3] flex items-center justify-center border-2 border-slate-700 shadow-inner">
          {cameraError ? (
            <div className="p-6 text-center text-rose-400 max-w-sm space-y-2">
              <AlertTriangle className="w-10 h-10 mx-auto text-rose-500" />
              <p className="text-sm font-semibold">{cameraError}</p>
              <button
                type="button"
                onClick={startCamera}
                className="mt-3 px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors"
              >
                Retry Camera
              </button>
            </div>
          ) : capturedPhoto ? (
            <div className="relative w-full h-full">
              <img
                src={capturedPhoto}
                alt="Captured Face"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Snapshot Captured
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
              />

              {/* Biometric Face Guide Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {/* Oval face guide */}
                <div className="w-52 h-64 border-2 border-dashed border-brand/80 rounded-[50%] relative shadow-[0_0_0_9999px_rgba(15,23,42,0.55)]">
                  {/* Scanning line animation */}
                  <div className="absolute inset-x-2 top-0 h-0.5 bg-gradient-to-r from-transparent via-brand to-transparent animate-pulse" />
                  {/* Corner alignment markers */}
                  <div className="absolute top-2 left-6 w-3 h-3 border-t-2 border-l-2 border-brand" />
                  <div className="absolute top-2 right-6 w-3 h-3 border-t-2 border-r-2 border-brand" />
                  <div className="absolute bottom-2 left-6 w-3 h-3 border-b-2 border-l-2 border-brand" />
                  <div className="absolute bottom-2 right-6 w-3 h-3 border-b-2 border-r-2 border-brand" />
                </div>
              </div>

              {/* Instructions badge */}
              <div className="absolute bottom-3 inset-x-4 bg-slate-900/80 backdrop-blur-md py-1.5 px-3 rounded-full text-center text-xs text-slate-200 border border-slate-700">
                Position face inside the oval with clear lighting
              </div>
            </>
          )}
        </div>

        {/* Verification Match Status Banner */}
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
                    ? "Face Verified Successfully"
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

        {/* Action Controls */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="btn-secondary text-sm"
          >
            Cancel
          </button>

          <div className="flex items-center gap-2">
            {capturedPhoto ? (
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
                onClick={handleCapture}
                disabled={!cameraActive || analyzing}
                className="btn-primary text-sm flex items-center gap-2 px-5"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing Facial Biometrics...
                  </>
                ) : (
                  <>
                    <Camera className="w-4 h-4" />
                    {mode === "register" ? "Capture Face" : "Scan & Verify Face"}
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
