/**
 * @fileoverview Hook for Banks AI conversation management with persistent chat history.
 * Ensures conversations persist across modal toggling, page reload, and module navigation.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { api } from "../../api/client.js";
import { useAuth } from "../../auth/AuthContext.jsx";
import { usePermission } from "../../auth/PermissionContext.jsx";
import { extractFormFromContent } from "./formParser.js";

export const CHAT_STORAGE_KEY = "omnisuite.banks_ai.chat_history";

export const DEFAULT_WELCOME_MESSAGE = {
  role: "assistant",
  content: "Hello! I am **Banks**, your OmniSuite AI Assistant. How can I help you today?",
  timestamp: Date.now(),
};

/**
 * Reads persisted messages from localStorage safely.
 */
export function getStoredChatHistory() {
  try {
    const raw = localStorage.getItem(CHAT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to parse stored Banks AI chat history:", err);
  }
  return [DEFAULT_WELCOME_MESSAGE];
}

/**
 * Persists messages array to localStorage and notifies other listeners.
 */
export function persistChatHistory(messages) {
  try {
    if (Array.isArray(messages) && messages.length > 0) {
      // Store up to last 100 messages
      const slice = messages.slice(-100);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(slice));
      window.dispatchEvent(
        new CustomEvent("omni.banks_ai.history_updated", {
          detail: { messages: slice },
        })
      );
    }
  } catch (err) {
    console.warn("Failed to persist Banks AI chat history:", err);
  }
}

export function useBanksChat() {
  const { user } = useAuth();
  const { isSuperAdmin, modules } = usePermission();

  const [messages, setMessages] = useState(() => getStoredChatHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeToolBadge, setActiveToolBadge] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);

  // Sync with remote database on initial mount
  useEffect(() => {
    let mounted = true;
    api
      .get("/ai/history")
      .then((res) => {
        if (mounted && Array.isArray(res.data?.data) && res.data.data.length > 0) {
          setMessages(res.data.data);
          try {
            localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(res.data.data.slice(-100)));
          } catch {}
        }
      })
      .catch(() => {});

    // Listen for history updates from other instances (e.g. modal <-> page)
    const onHistoryUpdated = (e) => {
      if (Array.isArray(e?.detail?.messages)) {
        setMessages(e.detail.messages);
      }
    };
    window.addEventListener("omni.banks_ai.history_updated", onHistoryUpdated);

    return () => {
      mounted = false;
      window.removeEventListener("omni.banks_ai.history_updated", onHistoryUpdated);
    };
  }, []);

  // Fetch status
  useEffect(() => {
    let mounted = true;
    api
      .get("/ai/status")
      .then((res) => {
        if (mounted) setAiStatus(res.data);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  // Extract allowed modules list for backend RBAC enforcement
  const userAllowedModules = useMemo(() => {
    if (isSuperAdmin || user?.id === 1) return ["*"];
    if (modules instanceof Set) {
      const arr = Array.from(modules).map((m) => String(m).toLowerCase().trim()).filter(Boolean);
      return arr.length ? arr : ["general"];
    }
    if (Array.isArray(modules)) {
      const arr = modules.map((m) => String(m).toLowerCase().trim()).filter(Boolean);
      return arr.length ? arr : ["general"];
    }
    return ["general"];
  }, [isSuperAdmin, user, modules]);

  // Send Message
  const sendMessage = useCallback(
    async (userPrompt = null, customModel = null) => {
      const text = (userPrompt || input).trim();
      if (!text || loading) return;

      const userMessage = {
        role: "user",
        content: text,
        timestamp: Date.now(),
      };

      const newMessages = [...messages, userMessage];
      setMessages(newMessages);
      persistChatHistory(newMessages);
      setInput("");
      setLoading(true);
      setActiveToolBadge("Analyzing request...");

      try {
        const res = await api.post("/ai/chat", {
          messages: newMessages,
          model: customModel,
          userContext: {
            roleName: user?.role_name || user?.role || "User",
            isSuperAdmin: Boolean(isSuperAdmin || user?.id === 1),
            allowedModules: userAllowedModules,
          },
        });

        const reply = res.data?.data?.reply;
        const toolsExecuted = res.data?.data?.toolCallsExecuted || [];
        const form = res.data?.data?.form || extractFormFromContent(reply);

        if (toolsExecuted.length > 0) {
          const toolNames = toolsExecuted.map((t) => t.toolName.replace(/_/g, " ")).join(", ");
          setActiveToolBadge(`Executed: ${toolNames}`);
        }

        const assistantMessage = {
          role: "assistant",
          content: reply,
          tools: toolsExecuted,
          form,
          timestamp: Date.now(),
        };

        const updatedHistory = [...newMessages, assistantMessage];
        setMessages(updatedHistory);
        persistChatHistory(updatedHistory);
      } catch (err) {
        const errMsg =
          err?.response?.data?.message ||
          "I encountered an issue connecting to the AI engine. Please configure your Groq API key under System Configuration -> General Settings.";

        const errorMessage = {
          role: "assistant",
          content: `⚠️ **Error:** ${errMsg}`,
          isError: true,
          timestamp: Date.now(),
        };

        const updatedHistory = [...newMessages, errorMessage];
        setMessages(updatedHistory);
        persistChatHistory(updatedHistory);
      } finally {
        setLoading(false);
        setActiveToolBadge(null);
      }
    },
    [input, loading, messages, user, isSuperAdmin, userAllowedModules]
  );

  // Delete & Clear Chat History
  const deleteChatHistory = useCallback(async () => {
    const defaultGreeting = [DEFAULT_WELCOME_MESSAGE];
    setMessages(defaultGreeting);
    try {
      localStorage.removeItem(CHAT_STORAGE_KEY);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(defaultGreeting));
      window.dispatchEvent(
        new CustomEvent("omni.banks_ai.history_updated", {
          detail: { messages: defaultGreeting },
        })
      );
    } catch {}

    try {
      await api.delete("/ai/history");
      return { success: true };
    } catch (err) {
      console.warn("Failed to delete remote chat history:", err);
      return { success: false, error: err };
    }
  }, []);

  // Start New Chat (clears active screen conversation to start a new topic)
  const startNewChat = useCallback(() => {
    const defaultGreeting = [
      {
        role: "assistant",
        content: "Hello! Starting a new conversation. How can I assist you with OmniSuite today?",
        timestamp: Date.now(),
      },
    ];
    setMessages(defaultGreeting);
    setInput("");
    setActiveToolBadge(null);
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(defaultGreeting));
      window.dispatchEvent(
        new CustomEvent("omni.banks_ai.history_updated", {
          detail: { messages: defaultGreeting },
        })
      );
    } catch {}
  }, []);

  // Backward compatible alias
  const clearChat = deleteChatHistory;

  return {
    messages,
    setMessages,
    input,
    setInput,
    loading,
    activeToolBadge,
    aiStatus,
    sendMessage,
    clearChat,
    deleteChatHistory,
    startNewChat,
  };
}
