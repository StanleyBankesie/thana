/**
 * @fileoverview Banks AI Assistant Studio — Full-page conversational copilot for BI Module.
 * Fully integrated with OmniSuite ERP RBAC & Permission Access Control.
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  Send, Sparkles, RefreshCw, CheckCircle, Copy, Check, Database
} from "lucide-react";
import banksIcon from "../../../assets/banks_ai_icon.png";
import { api } from "../../../api/client.js";
import { PageHeader } from "./bi.shared.jsx";
import { useAuth } from "../../../auth/AuthContext.jsx";
import { usePermission } from "../../../auth/PermissionContext.jsx";

// Helper for rendering Markdown
function MarkdownBody({ content }) {
  if (!content) return null;
  const lines = content.split("\n");
  const elements = [];
  let tableRows = [];
  let inTable = false;

  const flushTable = () => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1);
      elements.push(
        <div key={`table-${elements.length}`} className="my-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
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
      elements.push(<h4 key={idx} className="text-xs font-bold text-brand-600 dark:text-brand-300 uppercase tracking-wider mt-3 mb-1">{trimmed.replace(/^###\s+/, "")}</h4>);
    } else if (trimmed.startsWith("## ")) {
      elements.push(<h3 key={idx} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">{trimmed.replace(/^##\s+/, "")}</h3>);
    } else if (trimmed.startsWith("# ")) {
      elements.push(<h2 key={idx} className="text-base font-black text-slate-900 dark:text-white mt-4 mb-2">{trimmed.replace(/^#\s+/, "")}</h2>);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(<li key={idx} className="text-xs text-slate-700 dark:text-slate-300 ml-4 list-disc my-0.5 leading-relaxed">{trimmed.replace(/^[-*]\s+/, "")}</li>);
    } else if (/^\d+\.\s+/.test(trimmed)) {
      elements.push(<li key={idx} className="text-xs text-slate-700 dark:text-slate-300 ml-4 list-decimal my-0.5 leading-relaxed">{trimmed.replace(/^\d+\.\s+/, "")}</li>);
    } else if (trimmed === "") {
      elements.push(<div key={idx} className="h-1.5" />);
    } else {
      elements.push(<p key={idx} className="text-xs text-slate-700 dark:text-slate-300 my-1 leading-relaxed">{trimmed}</p>);
    }
  });

  if (inTable) flushTable();
  return <div className="space-y-1">{elements}</div>;
}

const STATIC_PROMPTS = [
  { category: "sales", path: "/sales", title: "Executive Business Summary", prompt: "Give me an executive summary of our overall revenue, sales, expenses, and gross profit." },
  { category: "inventory", path: "/inventory", title: "Inventory Health & Reorder", prompt: "Check inventory health: which items are below their safety reorder level and need replenishment?" },
  { category: "production", path: "/production", title: "Production & Work Orders", prompt: "What is our current production status, active work orders, completed units, and machine status?" },
  { category: "projects", path: "/project-management", title: "Project Milestones & Budget", prompt: "Show me all active projects, their budgets, and expenses incurred so far." },
  { category: "pos", path: "/pos", title: "Retail POS Daily Performance", prompt: "How much retail sales have been processed at the POS today, and what are the top selling items?" },
  { category: "transport", path: "/transport", title: "Fleet & Delivery Status", prompt: "What is the status of our fleet deliveries and active dispatches?" },
  { category: "maintenance", path: "/maintenance", title: "Maintenance Job Orders", prompt: "Show me open maintenance job orders and equipment requiring attention." },
  { category: "hr", path: "/human-resource", title: "Workforce Overview", prompt: "Give me a breakdown of active workforce headcount across departments." },
];

export default function BanksAiPage() {
  const { user } = useAuth();
  const { isSuperAdmin, canAccessPath, modules } = usePermission();

  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Welcome to **Banks AI Studio**. How can I assist you with OmniSuite ERP today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState(null);
  const [activeModel, setActiveModel] = useState("openai/gpt-oss-120b");
  const [copiedIdx, setCopiedIdx] = useState(null);

  const messagesEndRef = useRef(null);

  // Filter prompt library strictly based on user permissions
  const authorizedPrompts = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return STATIC_PROMPTS;
    return STATIC_PROMPTS.filter((p) => canAccessPath(p.path));
  }, [isSuperAdmin, user, canAccessPath]);

  // Extract allowed modules list for backend RBAC enforcement
  const userAllowedModules = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return ["*"];
    const list = Array.from(modules || []);
    return list.length ? list : ["general"];
  }, [isSuperAdmin, user, modules]);

  useEffect(() => {
    loadStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadStatus = async () => {
    try {
      const res = await api.get("/ai/status");
      setAiStatus(res.data);
      if (res.data?.defaultModel) setActiveModel(res.data.defaultModel);
    } catch {}
  };

  const handleSend = async (customPrompt = null) => {
    const text = (customPrompt || input).trim();
    if (!text || loading) return;

    const updated = [...messages, { role: "user", content: text }];
    setMessages(updated);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/ai/chat", {
        messages: updated,
        model: activeModel,
        userContext: {
          roleName: user?.role_name || user?.role || "User",
          isSuperAdmin: Boolean(isSuperAdmin || user?.id === 1),
          allowedModules: userAllowedModules,
        },
      });

      const reply = res.data?.data?.reply;
      const tools = res.data?.data?.toolCallsExecuted || [];

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: reply,
          tools,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ **Error:** ${err?.response?.data?.message || "Failed to contact AI service. Please verify your Groq API key in System Configuration -> General Settings."}`,
          isError: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Banks AI Studio"
        description="OmniSuite Enterprise AI Assistant — with full real-time database query execution"
      >
        {aiStatus?.isConfigured && (
          <span className="text-xs text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5">
            <CheckCircle size={13} className="text-emerald-400" />
            Connected
          </span>
        )}
      </PageHeader>

      {/* Main Studio Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Sidebar: Quick Prompts Library & System Status */}
        <div className="space-y-4 lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-erp-sm space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">
              <Sparkles size={14} className="text-primary" />
              <span>Prompt Library</span>
            </div>
            <div className="space-y-2">
              {authorizedPrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSend(p.prompt)}
                  className="w-full text-left p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-slate-200 dark:border-slate-700 hover:border-brand-300 transition-all text-xs text-slate-700 dark:text-slate-300 group"
                >
                  <div className="font-semibold text-brand-700 dark:text-brand-300 group-hover:text-brand-800">
                    {p.title}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate mt-0.5">{p.prompt}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-erp-sm text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider text-[11px]">
              <Database size={13} className="text-secondary" />
              <span>Connected Data Sources</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> Sales & Invoices</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> Inventory Items</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> Work Orders</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> Projects & Spend</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> POS Sales</span>
              <span className="flex items-center gap-1"><CheckCircle size={11} className="text-secondary" /> Fleet Deliveries</span>
            </div>
          </div>
        </div>

        {/* Right Chat Stream */}
        <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-erp-sm flex flex-col h-[700px] overflow-hidden">
          {/* Chat header bar */}
          <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900/80">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-900 text-white flex items-center justify-center">
                <img src={banksIcon} alt="Banks" className="w-4 h-4 object-contain" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 dark:text-white">Banks AI</span>
              </div>
            </div>
            <button
              onClick={() => setMessages([{ role: "assistant", content: "Conversation reset. How can I help you today?" }])}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1"
            >
              <RefreshCw size={12} /> Clear
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/40 dark:bg-slate-950/40">
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
                  className={`max-w-[85%] rounded-2xl p-4 shadow-erp-sm text-xs relative group ${
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
                      <MarkdownBody content={msg.content} />
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

          {/* Prompt input */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Banks anything about your ERP data, analytics, or workflows..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className={`px-5 py-3 rounded-xl transition-all flex items-center justify-center gap-1.5 text-xs flex-shrink-0 shadow-sm ${
                  input.trim()
                    ? "bg-brand-900 hover:bg-brand-800 text-white shadow-md cursor-pointer scale-105"
                    : "bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-90"
                }`}
              >
                <Send
                  size={15}
                  className={input.trim() ? "text-white stroke-[2.5]" : "text-brand-900 dark:text-brand-300 stroke-[2.5]"}
                />
                <span className={input.trim() ? "text-white font-semibold" : "text-brand-900 dark:text-brand-300 font-medium"}>Ask Banks</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
