/**
 * @fileoverview Dual-Engine Speech-to-Text & Speech-to-Speech Hook for Banks AI.
 * 
 * Features:
 * - Dual Engine STT: Native Browser Web Speech API + High-Precision Groq Whisper API fallback.
 * - Explicit Microphone Permission Request via navigator.mediaDevices.getUserMedia.
 * - Live Web Audio API Sound Level Visualizer (audioLevel: 0-100) with Voice Activity Detection (VAD).
 * - Continuous Speech-to-Speech (STS) Hands-Free Voice Mode with automatic turn-taking.
 * - Natural Text-to-Speech (TTS) with Markdown/code cleansing and voice pitch/rate tuning.
 * - Resilient across Chrome, Edge, Brave, Firefox, Safari, and restrictive corporate proxies.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../../api/client.js";
import { toast } from "react-toastify";

// Helper to strip markdown formatting so audio synthesis sounds natural
export function sanitizeMarkdownForSpeech(text) {
  if (!text) return "";
  return text
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, " code snippet omitted ")
    // Remove inline code
    .replace(/`([^`]+)`/g, "$1")
    // Remove markdown links [title](url) -> title
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    // Remove table pipes and separator rows
    .replace(/\|[\s-:]+\|/g, "")
    .replace(/\|/g, ", ")
    // Remove headers (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove bold and italics
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, "$1")
    // Remove bullet points and numbered lists
    .replace(/^\s*[-*+]\s+/gm, "")
    .replace(/^\s*\d+\.\s+/gm, "")
    // Remove emojis & special symbols
    .replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, "")
    // Clean up excessive whitespace and punctuation
    .replace(/\s+/g, " ")
    .trim();
}

// Detect best audio MIME type supported by browser MediaRecorder
function getBestAudioMimeType() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "", ext: "wav" };
  }
  const candidates = [
    { mime: "audio/webm;codecs=opus", ext: "webm" },
    { mime: "audio/webm", ext: "webm" },
    { mime: "audio/ogg;codecs=opus", ext: "ogg" },
    { mime: "audio/mp4", ext: "mp4" },
    { mime: "audio/aac", ext: "m4a" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c.mime)) {
      return { mimeType: c.mime, ext: c.ext };
    }
  }
  return { mimeType: "", ext: "webm" };
}

export function useSpeech({ onAutoSend } = {}) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [isVoiceMode, setIsVoiceMode] = useState(false);
  const [speechError, setSpeechError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0); // 0 to 100 live mic volume
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [activeEngine, setActiveEngine] = useState("web-speech"); // "web-speech" | "whisper"

  // Internal refs
  const recognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);

  const isVoiceModeRef = useRef(isVoiceMode);
  isVoiceModeRef.current = isVoiceMode;

  const onAutoSendRef = useRef(onAutoSend);
  onAutoSendRef.current = onAutoSend;

  const onInterimRef = useRef(null);
  const onFinalRef = useRef(null);
  const currentTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);
  const hasSpokenRef = useRef(false);

  // Check Web Speech Recognition support
  const SpeechRecognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;
  const isSpeechRecognitionSupported = Boolean(SpeechRecognition);

  // Stop audio visualizer and audio stream
  const cleanupAudioStream = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {}
      });
      mediaStreamRef.current = null;
    }
  }, []);

  // Initialize live microphone volume level analyzer via Web Audio API
  const startAudioVisualizer = useCallback((stream) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      audioContextRef.current = audioCtx;
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const sample = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        // Map average volume to 0-100 range
        const level = Math.min(100, Math.round((avg / 65) * 100));
        setAudioLevel(level);

        // Track voice activity
        if (level > 18) {
          hasSpokenRef.current = true;
        }

        animFrameRef.current = requestAnimationFrame(sample);
      };
      sample();
    } catch (e) {
      console.warn("Could not start Web Audio visualizer:", e);
    }
  }, []);

  // Transcribe recorded audio with server-side Groq Whisper
  const sendAudioToWhisper = useCallback(async (audioBlob, ext) => {
    try {
      setIsTranscribing(true);
      const formData = new FormData();
      formData.append("audio", audioBlob, `voice_recording.${ext}`);

      const res = await api.post("/ai/transcribe", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const text = (res.data?.text || "").trim();
      setIsTranscribing(false);

      if (text) {
        if (onFinalRef.current) {
          onFinalRef.current(text);
        }
        if (isVoiceModeRef.current && onAutoSendRef.current) {
          setTimeout(() => {
            onAutoSendRef.current(text);
          }, 200);
        }
        return text;
      }
    } catch (err) {
      console.error("Whisper transcription error:", err);
      setIsTranscribing(false);
      const errMsg = err.response?.data?.message || err.message || "Voice transcription failed";
      toast.error(`Whisper error: ${errMsg}`);
    }
    return "";
  }, []);

  // Stop listening helper
  const stopListening = useCallback((triggerSend = false) => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    // Stop native recognition
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Stop MediaRecorder
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {}
    }
    mediaRecorderRef.current = null;

    cleanupAudioStream();
    setIsListening(false);

    // If native speech recognition captured text and triggerSend is requested
    const finalText = (currentTranscriptRef.current || "").trim();
    if (finalText && triggerSend) {
      if (onFinalRef.current) {
        onFinalRef.current(finalText);
      }
      if (onAutoSendRef.current) {
        setTimeout(() => {
          onAutoSendRef.current(finalText);
        }, 150);
      }
    }
  }, [cleanupAudioStream]);

  // Start listening with real-time browser recognition + parallel Whisper backup
  const startListening = useCallback(
    async (onInterim, onFinal) => {
      // Cancel speech synthesis if Banks is talking
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        setSpeakingId(null);
      }

      if (onInterim) onInterimRef.current = onInterim;
      if (onFinal) onFinalRef.current = onFinal;

      currentTranscriptRef.current = "";
      hasSpokenRef.current = false;
      setSpeechError(null);

      // 1. Explicitly request microphone stream
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        mediaStreamRef.current = stream;
        startAudioVisualizer(stream);
      } catch (err) {
        console.error("Microphone access denied or unavailable:", err);
        const denied = err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
        const message = denied
          ? "Microphone access was denied. Please allow microphone permissions in your browser address bar."
          : `Microphone error: ${err.message || "Device unavailable"}`;
        setSpeechError(message);
        toast.error(message);
        setIsListening(false);
        return;
      }

      // 2. Start parallel MediaRecorder for guaranteed Whisper fallback
      const { mimeType, ext } = getBestAudioMimeType();
      audioChunksRef.current = [];
      let recorder = null;
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.onstop = async () => {
          // If native speech recognition yielded no text, fallback to Whisper!
          const nativeText = (currentTranscriptRef.current || "").trim();
          if (!nativeText && audioChunksRef.current.length > 0 && hasSpokenRef.current) {
            const blobType = mimeType || "audio/webm";
            const audioBlob = new Blob(audioChunksRef.current, { type: blobType });
            if (audioBlob.size > 1500) {
              await sendAudioToWhisper(audioBlob, ext);
            }
          }
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } catch (recErr) {
        console.warn("MediaRecorder start failed:", recErr);
      }

      // 3. Start Web Speech Recognition if available
      if (isSpeechRecognitionSupported) {
        try {
          const recognition = new SpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;
          recognition.lang = "en-US";
          recognition.maxAlternatives = 1;

          recognition.onstart = () => {
            setIsListening(true);
            setActiveEngine("web-speech");
            setSpeechError(null);
          };

          recognition.onresult = (event) => {
            let fullFinal = "";
            let fullInterim = "";

            for (let i = 0; i < event.results.length; i++) {
              const res = event.results[i];
              if (res.isFinal) {
                fullFinal += res[0].transcript;
              } else {
                fullInterim += res[0].transcript;
              }
            }

            const combined = (fullFinal + " " + fullInterim).replace(/\s+/g, " ").trim();
            if (combined) {
              currentTranscriptRef.current = combined;
              hasSpokenRef.current = true;
              if (onInterimRef.current) {
                onInterimRef.current(combined);
              }

              // Voice Activity Detection / Auto-silence finalizer:
              // In continuous Voice Mode, auto-finalize when user finishes speaking (1.8s silence)
              if (silenceTimerRef.current) {
                clearTimeout(silenceTimerRef.current);
              }
              if (isVoiceModeRef.current) {
                silenceTimerRef.current = setTimeout(() => {
                  stopListening(true);
                }, 1800);
              }
            }
          };

          recognition.onerror = (event) => {
            console.warn("Speech recognition notice:", event.error);
            if (event.error === "not-allowed") {
              setSpeechError("Microphone permission denied.");
              toast.error("Microphone permission denied.");
              stopListening(false);
            } else if (event.error === "network" || event.error === "service-not-allowed") {
              // Seamlessly fallback to Groq Whisper engine
              setActiveEngine("whisper");
            }
          };

          recognition.onend = () => {
            // If in continuous Voice Mode and user didn't stop intentionally, re-arm
            if (isVoiceModeRef.current && isListening) {
              try {
                recognition.start();
              } catch {}
            }
          };

          recognition.start();
          recognitionRef.current = recognition;
          setIsListening(true);
        } catch (e) {
          console.warn("Could not start Web Speech Recognition:", e);
          setActiveEngine("whisper");
          setIsListening(true);
        }
      } else {
        // Web Speech API not supported (Firefox, etc.) -> Pure Whisper mode
        setActiveEngine("whisper");
        setIsListening(true);
      }
    },
    [isSpeechRecognitionSupported, startAudioVisualizer, sendAudioToWhisper, stopListening, isListening]
  );

  // Toggle listening button
  const toggleListening = useCallback(
    (onInterim, onFinal, autoSubmitOnStop = true) => {
      if (isListening) {
        stopListening(autoSubmitOnStop);
      } else {
        startListening(onInterim, onFinal);
      }
    },
    [isListening, startListening, stopListening]
  );

  // Text-to-Speech (Voice Output)
  const speak = useCallback(
    (text, messageId = null, onEnd = null) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        toast.warn("Speech synthesis is not supported on this browser.");
        return;
      }

      window.speechSynthesis.cancel();

      const sanitized = sanitizeMarkdownForSpeech(text);
      if (!sanitized) {
        if (onEnd) onEnd();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(sanitized);
      utterance.rate = 1.05;
      utterance.pitch = 1.0;
      utterance.lang = "en-US";

      // Select natural English voice if available
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find((v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.name.includes("Jenny") || v.name.includes("Samantha"))) ||
        voices.find((v) => v.lang.startsWith("en-US")) ||
        voices.find((v) => v.lang.startsWith("en"));
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      utterance.onstart = () => {
        setIsSpeaking(true);
        setSpeakingId(messageId);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setSpeakingId(null);
        if (onEnd) onEnd();

        // Speech-to-Speech mode: Once Banks finishes speaking, auto-listen for next user question
        if (isVoiceModeRef.current) {
          setTimeout(() => {
            if (isVoiceModeRef.current && !isListening) {
              startListening(onInterimRef.current, onFinalRef.current);
            }
          }, 500);
        }
      };

      utterance.onerror = (e) => {
        console.warn("SpeechSynthesis error:", e);
        setIsSpeaking(false);
        setSpeakingId(null);
        if (onEnd) onEnd();
      };

      window.speechSynthesis.speak(utterance);
    },
    [isListening, startListening]
  );

  // Stop Speaking
  const stopSpeaking = useCallback(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
    setSpeakingId(null);
  }, []);

  // Toggle Speaking for a specific message
  const toggleSpeak = useCallback(
    (text, messageId) => {
      if (isSpeaking && speakingId === messageId) {
        stopSpeaking();
      } else {
        speak(text, messageId);
      }
    },
    [isSpeaking, speakingId, speak, stopSpeaking]
  );

  // Toggle Continuous Speech-to-Speech Voice Mode
  const toggleVoiceMode = useCallback(
    (onInterim, onFinal) => {
      const nextMode = !isVoiceMode;
      setIsVoiceMode(nextMode);

      if (nextMode) {
        toast.info("🎙️ Voice Mode Active: Banks will speak responses and listen continuously.", { autoClose: 3500 });
        startListening(onInterim, onFinal);
      } else {
        stopListening(false);
        stopSpeaking();
        toast.info("Voice Mode deactivated.", { autoClose: 2000 });
      }
    },
    [isVoiceMode, startListening, stopListening, stopSpeaking]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      stopListening(false);
    };
  }, [stopListening]);

  return {
    isListening,
    isSpeaking,
    speakingId,
    isVoiceMode,
    speechError,
    audioLevel,
    isTranscribing,
    activeEngine,
    startListening,
    stopListening,
    toggleListening,
    speak,
    stopSpeaking,
    toggleSpeak,
    toggleVoiceMode,
    isSpeechRecognitionSupported,
  };
}
