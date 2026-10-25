/**
 * @fileoverview Banks AI Modal — Interactive Enterprise Assistant.
 * Fully integrated with OmniSuite ERP RBAC & Permission Access Control.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send, Sparkles, RefreshCw, X, Maximize2, Minimize2,
  CheckCircle, Copy, Check, Trash2, AlertTriangle, Plus,
  Mic, MicOff, Volume2, VolumeX, Headphones
} from "lucide-react";
import { useSpeech } from "./useSpeech.js";
import VoiceVisualizer from "./VoiceVisualizer.jsx";
import { toast } from "react-toastify";
import banksIcon from "../../assets/banks_ai_icon.png";
import { api } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { usePermission } from "../../auth/PermissionContext.jsx";
import InteractiveFormCard from "./InteractiveFormCard.jsx";
import { useBanksChat } from "./useBanksChat.js";

// Markdown Formatter for AI responses
function MarkdownContent({ content }) {
  if (!content) return null;

  const lines = content.split("\n");
  const renderedElements = [];
  let tableRows = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      renderedElements.push(
        <div key={`table-${renderedElements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
          <table className="min-w-full text-xs text-left">
            <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
              <tr>
                {header.map((cell, idx) => (
                  <th key={idx} className="px-3 py-2">{cell}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/80">
              {body.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-1.5 text-slate-600 dark:text-slate-300">{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      if (!cells.every((c) => /^:?-+:?$/.test(c))) {
        tableRows.push(cells);
      }
      return;
    } else if (inTable) {
      flushTable();
    }

    if (trimmed.startsWith("### ")) {
      renderedElements.push(
        <h4 key={idx} className="text-xs font-extrabold text-brand-700 dark:text-brand-300 mt-3 mb-1 uppercase tracking-wider">
          {trimmed.replace(/^###\s+/, "")}
        </h4>
      );
    } else if (trimmed.startsWith("## ")) {
      renderedElements.push(
        <h3 key={idx} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1.5">
          {trimmed.replace(/^##\s+/, "")}
        </h3>
      );
    } else if (trimmed.startsWith("# ")) {
      renderedElements.push(
        <h2 key={idx} className="text-base font-black text-slate-900 dark:text-white mt-4 mb-2">
          {trimmed.replace(/^#\s+/, "")}
        </h2>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const formatted = renderInlineFormatting(trimmed.replace(/^[-*]\s+/, ""));
      renderedElements.push(
        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 ml-4 list-disc my-0.5 leading-relaxed">
          {formatted}
        </li>
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const formatted = renderInlineFormatting(trimmed.replace(/^\d+\.\s+/, ""));
      renderedElements.push(
        <li key={idx} className="text-xs text-slate-700 dark:text-slate-300 ml-4 list-decimal my-0.5 leading-relaxed">
          {formatted}
        </li>
      );
    } else if (trimmed === "") {
      renderedElements.push(<div key={idx} className="h-1.5" />);
    } else {
      const formatted = renderInlineFormatting(trimmed);
      renderedElements.push(
        <p key={idx} className="text-xs text-slate-700 dark:text-slate-300 my-1 leading-relaxed">
          {formatted}
        </p>
      );
    }
  });

  if (inTable) flushTable();

  return <div className="space-y-1">{renderedElements}</div>;
}

function renderInlineFormatting(text) {
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-900 dark:text-slate-100">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-300 px-1 py-0.5 rounded text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export default function BanksAiModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { isSuperAdmin, canAccessPath } = usePermission();

  const {
    messages,
    input,
    setInput,
    loading,
    activeToolBadge,
    aiStatus,
    sendMessage,
    deleteChatHistory,
    startNewChat,
  } = useBanksChat();

  const {
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
  } = useSpeech({
    onAutoSend: (spokenText) => {
      if (spokenText && spokenText.trim()) {
        sendMessage(spokenText);
      }
    },
  });

  // Auto-speak responses in continuous Voice Mode
  const prevMsgCountRef = useRef(messages.length);
  useEffect(() => {
    if (isVoiceMode && messages.length > prevMsgCountRef.current) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg && lastMsg.role === "assistant" && lastMsg.content) {
        speak(lastMsg.content, messages.length - 1);
      }
    }
    prevMsgCountRef.current = messages.length;
  }, [messages, isVoiceMode, speak]);

  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleNewChat = () => {
    startNewChat();
    setShowConfirmDelete(false);
    toast.info("Started new conversation.");
  };

  const handleDeleteHistory = async () => {
    try {
      setDeleting(true);
      await deleteChatHistory();
      setShowConfirmDelete(false);
      toast.success("Your chat history was deleted successfully.");
    } catch {
      toast.error("Failed to delete chat history.");
    } finally {
      setDeleting(false);
    }
  };

  // Automatically delete user's chat history from the database when the chat is closed
  const handleClose = async () => {
    stopSpeaking();
    stopListening();
    try {
      await deleteChatHistory();
    } catch {}
    onClose();
  };

  const wasOpenRef = useRef(isOpen);
  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      // Chat closed via external trigger (e.g. Alt + B or parent state)
      deleteChatHistory().catch(() => {});
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, deleteChatHistory]);

  // Close & auto-delete on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, deleteChatHistory]);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [isOpen, messages]);

  const handleSend = (userPrompt = null) => {
    sendMessage(userPrompt);
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6 transition-all"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div
        className={`bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden transition-all duration-200 ${
          isExpanded ? "w-full h-full max-w-6xl max-h-[95vh]" : "w-full max-w-3xl h-[680px] max-h-[90vh]"
        }`}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 via-brand-800 to-brand-700 p-4 text-white flex items-center justify-between flex-shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center shadow-inner relative group">
              <img src={banksIcon} alt="Banks AI" className="w-6 h-6 object-contain" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-secondary rounded-full border-2 border-brand-900" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-base tracking-wide flex items-center gap-1.5">
                  Banks
                </h3>
                {aiStatus?.isConfigured && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full font-semibold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Connected
                  </span>
                )}
              </div>
              <p className="text-xs text-brand-200 leading-tight">OmniSuite Enterprise Brain</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                toggleVoiceMode(
                  (interim) => setInput(interim),
                  (final) => setInput(final)
                )
              }
              title={isVoiceMode ? "Disable Voice Mode (Speech-to-Speech)" : "Enable Voice Mode (Speech-to-Speech Auto-Conversation)"}
              className={`px-2.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 text-xs font-semibold shadow-sm active:scale-95 ${
                isVoiceMode
                  ? "bg-emerald-500 text-white shadow-emerald-500/30 animate-pulse"
                  : "bg-white/10 hover:bg-white/20 text-white"
              }`}
            >
              <Headphones size={14} />
              <span className="hidden sm:inline">{isVoiceMode ? "Voice Mode ON" : "Voice Mode"}</span>
            </button>
            <button
              onClick={handleNewChat}
              title="Start New Chat"
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold shadow-sm active:scale-95"
            >
              <Plus size={14} />
              <span className="hidden sm:inline">New Chat</span>
            </button>
            <button
              onClick={() => setShowConfirmDelete((prev) => !prev)}
              title="Delete My Chat History"
              className={`p-2 rounded-lg transition-colors ${
                showConfirmDelete
                  ? "bg-rose-600 text-white"
                  : "text-white/70 hover:text-rose-300 hover:bg-white/10"
              }`}
            >
              <Trash2 size={16} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : "Expand Fullscreen"}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden md:block"
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={handleClose}
              title="Close & Clear Chat (Esc)"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Inline Confirmation for Deleting Chat History */}
        {showConfirmDelete && (
          <div className="bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-900/60 px-4 py-2.5 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-fadeIn flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={15} className="text-rose-600 dark:text-rose-400 flex-shrink-0" />
              <span>Permanently delete your personal chat history? Only your own conversation records will be deleted from the database.</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDeleteHistory}
                disabled={deleting}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-md font-semibold text-[11px] shadow-sm transition-colors"
              >
                {deleting ? "Deleting..." : "Delete My History"}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="px-2.5 py-1 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 rounded-md font-medium text-[11px] border border-slate-300 dark:border-slate-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Live Speaking Status */}
        {isSpeaking && (
          <div className="bg-emerald-50 dark:bg-emerald-950/70 border-b border-emerald-200 dark:border-emerald-900/60 px-4 py-1.5 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-200 animate-fadeIn">
            <span className="flex items-center gap-2 font-medium">
              <Volume2 size={14} className="text-emerald-600 dark:text-emerald-400 animate-bounce" />
              <span>Banks is speaking...</span>
            </span>
            <button
              type="button"
              onClick={stopSpeaking}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-300 transition-colors"
            >
              Stop Audio
            </button>
          </div>
        )}

        {/* Live Microphone Status */}
        {isListening && (
          <div className="bg-rose-50 dark:bg-rose-950/70 border-b border-rose-200 dark:border-rose-900/60 px-4 py-1.5 flex items-center justify-between text-xs text-rose-800 dark:text-rose-200 animate-pulse">
            <span className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              <span>Listening... speak into your microphone</span>
            </span>
            <button
              type="button"
              onClick={stopListening}
              className="px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-200 dark:bg-rose-800 text-rose-900 dark:text-rose-100 hover:bg-rose-300 transition-colors"
            >
              Stop Mic
            </button>
          </div>
        )}

        {/* Live Active Tool Pill */}
        {activeToolBadge && (
          <div className="bg-brand-50 dark:bg-brand-950/40 border-b border-brand-200 dark:border-brand-900/60 px-4 py-1.5 flex items-center justify-between text-xs text-brand-700 dark:text-brand-300 animate-pulse">
            <span className="flex items-center gap-2 font-medium">
              <Sparkles size={13} className="text-primary animate-spin" />
              {activeToolBadge}
            </span>
          </div>
        )}

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {msg.role === "assistant" ? (
                <div className="w-8 h-8 rounded-lg bg-brand-900 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                  <img src={banksIcon} alt="Banks" className="w-5 h-5 object-contain" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-brand-800 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5 font-bold text-xs">
                  You
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-2xl p-4 shadow-erp-sm text-xs relative group transition-all ${
                  msg.role === "user"
                    ? "bg-brand-900 text-white rounded-tr-none"
                    : msg.isError
                    ? "bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800/60 rounded-tl-none"
                    : "bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 border border-slate-200/80 dark:border-slate-800 rounded-tl-none"
                }`}
              >
                {msg.role === "user" ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                ) : (
                  <div>
                    <MarkdownContent content={msg.content} />
                    {msg.form && <InteractiveFormCard form={msg.form} />}
                    {msg.tools && msg.tools.length > 0 && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap gap-1.5">
                        {msg.tools.map((t, tIdx) => (
                          <span
                            key={tIdx}
                            className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-full border border-brand-200 dark:border-brand-800/60"
                          >
                            <CheckCircle size={10} className="text-secondary" />
                            {t.toolName.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Assistant Message Actions (Speak Aloud & Copy) */}
                {msg.role === "assistant" && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => toggleSpeak(msg.content, idx)}
                      className={`p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ${
                        isSpeaking && speakingId === idx ? "text-emerald-600 dark:text-emerald-400 font-bold" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                      title={isSpeaking && speakingId === idx ? "Stop Audio" : "Read Aloud (Speech-to-Speech)"}
                    >
                      {isSpeaking && speakingId === idx ? <VolumeX size={13} /> : <Volume2 size={13} />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopy(msg.content, idx)}
                      className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      title="Copy Answer"
                    >
                      {copiedIdx === idx ? <Check size={13} className="text-secondary" /> : <Copy size={13} />}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-brand-900 text-white flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                <img src={banksIcon} alt="Banks" className="w-5 h-5 object-contain animate-pulse" />
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none p-4 shadow-erp-sm flex items-center gap-2 text-xs text-slate-500">
                <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping" />
                <span>Banks is analyzing ERP data...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Prompt Input Box */}
        <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
          {/* Audio Visualizer & Level Indicator */}
          <VoiceVisualizer
            isListening={isListening}
            isSpeaking={isSpeaking}
            isTranscribing={isTranscribing}
            audioLevel={audioLevel}
            activeEngine={activeEngine}
            onStopAndSend={() => {
              stopListening(true);
              if (input.trim()) {
                handleSend();
              }
            }}
          />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2"
          >
            <div className="relative flex-1">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={isListening ? "Listening... speak now..." : "Ask Banks anything about your ERP data, analytics, or workflows..."}
                className={`w-full bg-white dark:bg-slate-900 border rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all ${
                  isListening ? "border-rose-500 ring-1 ring-rose-500" : "border-slate-200 dark:border-slate-700"
                }`}
                disabled={loading}
              />
            </div>
            {/* Speech-to-Text Microphone Button */}
            <button
              type="button"
              onClick={() => {
                if (isListening) {
                  stopListening(true);
                  if (input.trim()) {
                    handleSend();
                  }
                } else {
                  toggleListening(
                    (interim) => setInput(interim),
                    (final) => setInput(final)
                  );
                }
              }}
              disabled={loading}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                isListening
                  ? "bg-rose-600 text-white animate-pulse shadow-md scale-105 ring-2 ring-rose-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 active:scale-95"
              }`}
              title={isListening ? "Finish & Send (or click to stop)" : "Voice Input (Speech-to-Text)"}
            >
              {isListening ? (
                <div className="flex items-center gap-1">
                  <MicOff size={17} />
                  {audioLevel > 15 && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                </div>
              ) : (
                <Mic size={18} />
              )}
            </button>
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center flex-shrink-0 shadow-sm ${
                input.trim()
                  ? "bg-brand-900 hover:bg-brand-800 text-white shadow-md cursor-pointer scale-105"
                  : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-90"
              }`}
              title="Send Prompt (Enter)"
            >
              <Send
                size={18}
                className={input.trim() ? "text-white stroke-[2.5]" : "text-brand-900 dark:text-brand-300 stroke-[2.5]"}
              />
            </button>
          </form>
          <div className="text-center mt-2 text-[10px] text-slate-400">
            <span>OmniSuite ERP</span>
          </div>
        </div>
      </div>
    </div>
  );
}
