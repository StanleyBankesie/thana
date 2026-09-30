/**
 * @fileoverview Banks AI Modal — Interactive Enterprise Assistant.
 * Fully integrated with OmniSuite ERP RBAC & Permission Access Control.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send, Sparkles, RefreshCw, X, Maximize2, Minimize2,
  CheckCircle, Copy, Check
} from "lucide-react";
import banksIcon from "../../assets/banks_ai_icon.png";
import { api } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { usePermission } from "../../auth/PermissionContext.jsx";

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

const ALL_QUICK_QUERIES = [
  { label: "📊 Revenue & Financials", prompt: "Give me an executive summary of our overall revenue, expenses, and gross profit.", path: "/sales" },
  { label: "📦 Low Stock Alerts", prompt: "Check inventory health: which items are below safety reorder level?", path: "/inventory" },
  { label: "🏭 Production Status", prompt: "What is our current production status, active work orders, and machine uptime?", path: "/production" },
  { label: "📁 Active Projects", prompt: "Show me all active projects, their budgets, and expenses incurred so far.", path: "/project-management" },
  { label: "🛒 POS Sales Today", prompt: "How much retail sales have been processed at the POS today?", path: "/pos" },
  { label: "🚚 Fleet Deliveries", prompt: "What is our current transport delivery and fleet status?", path: "/transport" },
  { label: "🛠️ Maintenance Jobs", prompt: "Show me open maintenance job orders and equipment status.", path: "/maintenance" },
  { label: "👥 Workforce Overview", prompt: "Give me an overview of our workforce headcount and department distribution.", path: "/human-resource" },
];

export default function BanksAiModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { isSuperAdmin, canAccessPath, modules } = usePermission();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I am **Banks**, your OmniSuite AI Assistant. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);
  const [activeToolBadge, setActiveToolBadge] = useState(null);

  const messagesEndRef = useRef(null);

  // Filter suggestion pills strictly according to user's permissions
  const authorizedSuggestions = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return ALL_QUICK_QUERIES;
    return ALL_QUICK_QUERIES.filter((q) => canAccessPath(q.path));
  }, [isSuperAdmin, user, canAccessPath]);

  // Extract allowed modules list for backend RBAC enforcement
  const userAllowedModules = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return ["*"];
    const list = Array.from(modules || []);
    return list.length ? list : ["general"];
  }, [isSuperAdmin, user, modules]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
      checkStatus();
    }
  }, [isOpen, messages]);

  const checkStatus = async () => {
    try {
      const res = await api.get("/ai/status");
      setAiStatus(res.data);
    } catch {
      // Fallback
    }
  };

  const handleSend = async (userPrompt = null) => {
    const text = (userPrompt || input).trim();
    if (!text || loading) return;

    const newMessages = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    setActiveToolBadge("Analyzing request...");

    try {
      const res = await api.post("/ai/chat", {
        messages: newMessages,
        userContext: {
          roleName: user?.role_name || user?.role || "User",
          isSuperAdmin: Boolean(isSuperAdmin || user?.id === 1),
          allowedModules: userAllowedModules,
        },
      });

      const reply = res.data?.data?.reply;
      const toolsExecuted = res.data?.data?.toolCallsExecuted || [];

      if (toolsExecuted.length > 0) {
        const toolNames = toolsExecuted.map((t) => t.toolName.replace(/_/g, " ")).join(", ");
        setActiveToolBadge(`Executed: ${toolNames}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          tools: toolsExecuted,
        },
      ]);
    } catch (err) {
      const errMsg =
        err?.response?.data?.message ||
        "I encountered an issue connecting to the AI engine. Please configure your Groq API key under System Configuration -> General Settings.";
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error:** ${errMsg}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
      setActiveToolBadge(null);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  const clearChat = () => {
    setMessages([
      {
        role: "assistant",
        content: "Conversation cleared. How can I help you today?",
      },
    ]);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 md:p-6 transition-all">
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
              onClick={clearChat}
              title="Clear Conversation"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              title={isExpanded ? "Collapse" : "Expand Fullscreen"}
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden md:block"
            >
              {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
            <button
              onClick={onClose}
              title="Close"
              className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

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

                {/* Copy response button */}
                {msg.role === "assistant" && (
                  <button
                    onClick={() => handleCopy(msg.content, idx)}
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    title="Copy Answer"
                  >
                    {copiedIdx === idx ? <Check size={13} className="text-secondary" /> : <Copy size={13} />}
                  </button>
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

        {/* Quick Suggestion Pills — Strictly Role & Permission Filtered */}
        {messages.length <= 2 && authorizedSuggestions.length > 0 && (
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 overflow-x-auto flex-shrink-0">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Suggested Executive Queries
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {authorizedSuggestions.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(s.prompt)}
                  className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:border-brand-400 hover:text-brand-600 dark:hover:text-brand-300 transition-all whitespace-nowrap shadow-sm hover:shadow"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt Input Box */}
        <div className="p-3 md:p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex-shrink-0">
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
                placeholder="Ask Banks anything about your ERP data, analytics, or workflows..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                disabled={loading}
              />
            </div>
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
