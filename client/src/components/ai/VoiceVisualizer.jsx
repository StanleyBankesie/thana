import React from "react";
import { Mic, Volume2, Sparkles, Loader2 } from "lucide-react";

/**
 * Animated Sound Wave & Audio Level Visualizer for Banks AI Voice Mode & STT.
 */
export default function VoiceVisualizer({
  isListening,
  isSpeaking,
  isTranscribing,
  audioLevel = 0,
  activeEngine = "web-speech",
  onStopAndSend,
}) {
  if (!isListening && !isSpeaking && !isTranscribing) return null;

  // Compute heights for 5 equalizer bars based on audioLevel
  const barHeights = [
    Math.max(12, Math.min(100, audioLevel * 1.2)),
    Math.max(18, Math.min(100, audioLevel * 1.6)),
    Math.max(24, Math.min(100, audioLevel * 2.0)),
    Math.max(18, Math.min(100, audioLevel * 1.5)),
    Math.max(12, Math.min(100, audioLevel * 1.1)),
  ];

  return (
    <div className="bg-gradient-to-r from-brand-900/90 via-slate-900 to-brand-950 text-white px-4 py-2.5 rounded-xl border border-brand-500/30 shadow-lg flex items-center justify-between gap-3 animate-fadeIn my-2">
      <div className="flex items-center gap-3">
        {/* Animated icon indicator */}
        <div className="relative flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 flex-shrink-0">
          {isTranscribing ? (
            <Loader2 size={16} className="text-amber-400 animate-spin" />
          ) : isSpeaking ? (
            <Volume2 size={16} className="text-brand-300 animate-pulse" />
          ) : (
            <Mic size={16} className="text-rose-400 animate-bounce" />
          )}
          {isListening && (
            <span
              className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white animate-ping"
            />
          )}
        </div>

        {/* Status text & Equalizer */}
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-white">
              {isTranscribing
                ? "Transcribing with Whisper AI..."
                : isSpeaking
                ? "Banks AI is speaking..."
                : "Banks AI is listening..."}
            </span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/10 text-brand-200 border border-white/10">
              {activeEngine === "whisper" ? "Groq Whisper" : "Live Speech"}
            </span>
          </div>

          <p className="text-[11px] text-slate-300 leading-tight">
            {isTranscribing
              ? "Converting your speech to high-accuracy text..."
              : isSpeaking
              ? "Reading analysis response aloud."
              : audioLevel > 15
              ? "Voice detected! Speak naturally..."
              : "Listening for your voice (speak into microphone)..."}
          </p>
        </div>
      </div>

      {/* Live Equalizer Bars */}
      <div className="flex items-center gap-2">
        <div className="flex items-end gap-1 h-6 px-2 py-1 bg-black/20 rounded-lg">
          {barHeights.map((h, idx) => (
            <span
              key={idx}
              className={`w-1 rounded-full transition-all duration-75 ${
                isSpeaking
                  ? "bg-brand-400 animate-pulse"
                  : isTranscribing
                  ? "bg-amber-400 animate-pulse"
                  : audioLevel > 15
                  ? "bg-rose-400"
                  : "bg-slate-500"
              }`}
              style={{
                height: isSpeaking ? `${30 + (idx % 3) * 25}%` : `${Math.max(15, h)}%`,
              }}
            />
          ))}
        </div>

        {/* Quick Send Button when user finishes speaking */}
        {isListening && onStopAndSend && (
          <button
            type="button"
            onClick={onStopAndSend}
            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm transition-all flex items-center gap-1 active:scale-95"
            title="Finish speaking and send query to Banks AI"
          >
            <span>Finish</span>
          </button>
        )}
      </div>
    </div>
  );
}
