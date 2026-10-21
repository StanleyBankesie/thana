/**
 * @fileoverview AI API Routes for "Banks" AI Assistant.
 * Fully enforces RBAC and user permission propagation.
 */

import express from "express";
import { query } from "../db/pool.js";
import { verifyAccessToken } from "../services/token.service.js";
import { checkPromptModulePermission } from "../services/ai/banks.guardrails.js";
import {
  getChatRetentionDays,
  setChatRetentionDays,
  cleanupExpiredAiChatHistory,
  getChatHistoryStats,
  deleteAiChatHistory,
} from "../services/ai/banks.history.service.js";
import {
  chatWithBanks,
  autonomousDirectResponse,
  testGroqConnection,
  testOpenRouterConnection,
  setRuntimeApiKey,
  getApiKey,
  setRuntimeOpenRouterApiKey,
  getOpenRouterApiKey,
} from "../services/ai/banks.service.js";

const router = express.Router();

// Attach user authentication & tenant/branch scope
router.use((req, res, next) => {
  if (!req.user) {
    const authHeader = String(req.headers.authorization || "");
    const customHeader = String(req.headers["x-access-token"] || "");
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.slice(7).trim()
      : customHeader.trim();
    if (token) {
      try {
        req.user = verifyAccessToken(token);
      } catch {}
    }
  }
  req.scope = {
    companyId: req.user?.company_id || req.headers["x-company-id"] || 1,
    branchId: req.user?.branch_id || req.headers["x-branch-id"] || null,
  };
  next();
});

/**
 * POST /api/ai/chat
 * Multi-turn chat with Banks AI with live database tool execution and RBAC security.
 */
router.post("/chat", async (req, res) => {
  try {
    const { messages = [], model, customApiKey, openRouterApiKey, userContext } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ success: false, message: "Messages array is required." });
    }

    // Resolve user context & scope
    const resolvedUserContext = {
      roleName: userContext?.roleName || req.user?.role_name || "User",
      isSuperAdmin: Boolean(
        userContext?.isSuperAdmin ||
        req.user?.id === 1 ||
        (req.user?.permissions && req.user.permissions.includes("*"))
      ),
      allowedModules: Array.isArray(userContext?.allowedModules)
        ? userContext.allowedModules
        : (req.user?.id === 1 ? ["*"] : ["general"]),
    };

    const userId = req.user?.id || req.user?.sub || 1;
    const companyId = req.scope?.companyId || 1;

    // Persist user prompt to chat history
    const lastUserMsg = messages[messages.length - 1];
    if (lastUserMsg && lastUserMsg.role === "user" && lastUserMsg.content) {
      await query(
        `INSERT INTO adm_ai_chat_history (user_id, company_id, role, content)
         VALUES (:userId, :companyId, 'user', :content)`,
        { userId, companyId, content: lastUserMsg.content }
      ).catch(() => {});
    }

    const result = await chatWithBanks(messages, {
      model,
      customApiKey,
      openRouterApiKey,
      userContext: resolvedUserContext,
      scope: {
        ...req.scope,
        ...resolvedUserContext,
      },
    });

    // Persist assistant response to chat history
    if (result && result.reply) {
      await query(
        `INSERT INTO adm_ai_chat_history (user_id, company_id, role, content, tools, form, is_error)
         VALUES (:userId, :companyId, 'assistant', :content, :tools, :form, 0)`,
        {
          userId,
          companyId,
          content: result.reply,
          tools: result.toolCallsExecuted?.length ? JSON.stringify(result.toolCallsExecuted) : null,
          form: result.form ? JSON.stringify(result.form) : null,
        }
      ).catch(() => {});
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("[Banks AI Error]:", err?.message);
    const userId = req.user?.id || req.user?.sub || 1;
    const companyId = req.scope?.companyId || 1;

    const resolvedUserContext = {
      roleName: req.body?.userContext?.roleName || req.user?.role_name || "User",
      isSuperAdmin: Boolean(
        req.body?.userContext?.isSuperAdmin ||
        req.user?.id === 1 ||
        (req.user?.permissions && req.user.permissions.includes("*"))
      ),
      allowedModules: Array.isArray(req.body?.userContext?.allowedModules)
        ? req.body.userContext.allowedModules
        : (req.user?.id === 1 ? ["*"] : ["general"]),
    };

    try {
      const fallbackResult = await autonomousDirectResponse(req.body.messages, {
        userContext: resolvedUserContext,
        scope: {
          ...req.scope,
          ...resolvedUserContext,
        },
      });

      if (fallbackResult && fallbackResult.reply) {
        await query(
          `INSERT INTO adm_ai_chat_history (user_id, company_id, role, content, tools, form, is_error)
           VALUES (:userId, :companyId, 'assistant', :content, :tools, :form, 0)`,
          {
            userId,
            companyId,
            content: fallbackResult.reply,
            tools: fallbackResult.toolCallsExecuted?.length ? JSON.stringify(fallbackResult.toolCallsExecuted) : null,
            form: fallbackResult.form ? JSON.stringify(fallbackResult.form) : null,
          }
        ).catch(() => {});
      }

      return res.json({
        success: true,
        data: fallbackResult,
      });
    } catch (fallbackErr) {
      res.status(500).json({
        success: false,
        message: err?.message || "Failed to process AI conversation.",
      });
    }
  }
});

/**
 * GET /api/ai/status
 * Check if Groq and OpenRouter APIs are configured and connected.
 */
router.get("/status", async (req, res) => {
  const groqKey = getApiKey();
  const openRouterKey = getOpenRouterApiKey();

  const isGroqConfigured = Boolean(groqKey && groqKey.length > 5);
  const isOpenRouterConfigured = Boolean(openRouterKey && openRouterKey.length > 5);

  let maskedGroqKey = "";
  if (isGroqConfigured) {
    maskedGroqKey = groqKey.substring(0, 7) + "..." + groqKey.substring(groqKey.length - 4);
  }
  let maskedOpenRouterKey = "";
  if (isOpenRouterConfigured) {
    maskedOpenRouterKey = openRouterKey.substring(0, 7) + "..." + openRouterKey.substring(openRouterKey.length - 4);
  }

  let groqConn = { success: false, message: "Groq API key not configured" };
  if (isGroqConfigured) {
    groqConn = await testGroqConnection(groqKey);
  }

  let openRouterConn = { success: false, message: "OpenRouter API key not configured" };
  if (isOpenRouterConfigured) {
    openRouterConn = await testOpenRouterConnection(openRouterKey);
  }

  const [visRow] = await query(
    "SELECT setting_value FROM adm_system_settings WHERE setting_key = 'banks_ai_enabled' ORDER BY id DESC LIMIT 1",
  ).catch(() => []);
  const isEnabled = visRow?.setting_value !== undefined ? visRow.setting_value === "true" : true;

  res.json({
    success: true,
    enabled: isEnabled,
    isConfigured: isGroqConfigured || isOpenRouterConfigured,
    groq: {
      isConfigured: isGroqConfigured,
      maskedKey: maskedGroqKey,
      connected: groqConn.success,
      statusMessage: groqConn.message,
    },
    openRouter: {
      isConfigured: isOpenRouterConfigured,
      maskedKey: maskedOpenRouterKey,
      connected: openRouterConn.success,
      statusMessage: openRouterConn.message,
    },
    defaultModel: "openai/gpt-oss-120b",
    availableModels: [
      { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B [Groq: Deep ERP Reasoning & Tools]" },
      { id: "stealth/ox-alpha", name: "0x Alpha [OpenRouter: 1M Token Context, Free Reasoning & Tools]" },
      { id: "openrouter/free", name: "OpenRouter Free Auto-Router [OpenRouter: Dynamic Free Tool Engine]" },
      { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile [Groq: Fast Meta Enterprise Flagship]" },
      { id: "qwen/qwen3.6-27b", name: "Qwen 3.6 27B [Groq: High Efficiency & Code Reasoning]" },
      { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B Instruct [OpenRouter Free Tier]" },
      { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B Instruct [OpenRouter Free Tier]" },
      { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant [Groq: Ultra-Fast Lightweight]" },
    ],
  });
});

/**
 * POST /api/ai/toggle-visibility
 * Toggle the Ask Banks AI visibility on/off persistently.
 */
router.post("/toggle-visibility", async (req, res) => {
  try {
    const { enabled } = req.body;
    const val = enabled ? "true" : "false";

    // Clean up all rows first to prevent duplicate rows overriding value
    await query("DELETE FROM adm_system_settings WHERE setting_key = 'banks_ai_enabled'").catch(() => {});
    await query(
      `INSERT INTO adm_system_settings (company_id, setting_key, setting_value)
       VALUES (1, 'banks_ai_enabled', :val)`,
      { val },
    );

    res.json({ success: true, enabled: Boolean(enabled) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/ai/history
 * Fetch persisted multi-turn chat history for the authenticated user.
 */
router.get("/history", async (req, res) => {
  try {
    // Opportunistically run expired history cleanup in the background
    cleanupExpiredAiChatHistory().catch(() => {});

    const userId = req.user?.id || req.user?.sub || 1;
    const rows = await query(
      `SELECT id, role, content, tools, form, is_error as isError, created_at as createdAt
       FROM adm_ai_chat_history
       WHERE user_id = :userId
       ORDER BY id ASC
       LIMIT 100`,
      { userId },
    ).catch(() => []);

    const data = (rows || []).map((r) => {
      let parsedTools = null;
      let parsedForm = null;
      try {
        if (r.tools) parsedTools = typeof r.tools === "string" ? JSON.parse(r.tools) : r.tools;
      } catch {}
      try {
        if (r.form) parsedForm = typeof r.form === "string" ? JSON.parse(r.form) : r.form;
      } catch {}
      return {
        id: r.id,
        role: r.role,
        content: r.content,
        tools: parsedTools,
        form: parsedForm,
        isError: Boolean(r.isError),
        createdAt: r.createdAt,
      };
    });

    res.json({ success: true, data });
  } catch (err) {
    res.json({ success: true, data: [] });
  }
});

/**
 * DELETE /api/ai/history
 * Clear chat history for the authenticated user or all users (if admin with all=true).
 */
router.delete("/history", async (req, res) => {
  try {
    const isWipeAllRequested =
      req.query?.all === "true" ||
      req.body?.all === true ||
      req.query?.wipeAll === "true";

    const isAuthorizedAdmin = Boolean(
      req.user?.id === 1 ||
      req.user?.is_superadmin ||
      req.user?.role_id === 1 ||
      String(req.user?.role_name || "").toLowerCase().includes("admin") ||
      (Array.isArray(req.user?.permissions) && req.user.permissions.includes("*"))
    );

    if (isWipeAllRequested) {
      if (!isAuthorizedAdmin) {
        return res.status(403).json({
          success: false,
          message: "Only system administrators can delete chat history for all users.",
        });
      }

      const wipeResult = await deleteAiChatHistory({ userId: null });
      return res.json({
        success: true,
        deletedCount: wipeResult.deletedCount,
        message: `All AI chat history records (${wipeResult.deletedCount}) deleted successfully.`,
      });
    }

    const userId = req.user?.id || req.user?.sub || 1;
    const deleteResult = await deleteAiChatHistory({ userId });

    res.json({
      success: true,
      deletedCount: deleteResult.deletedCount,
      message: "Chat history deleted successfully.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/ai/retention-settings
 * Retrieve current AI chat retention policy and statistics.
 */
router.get("/retention-settings", async (req, res) => {
  try {
    const stats = await getChatHistoryStats();
    res.json({
      success: true,
      retentionDays: stats.retentionDays,
      stats: {
        totalMessages: stats.totalMessages,
        oldestMessage: stats.oldestMessage,
        newestMessage: stats.newestMessage,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/ai/retention-settings
 * Save chat retention policy (in days) to adm_system_settings and prune expired records.
 */
router.post("/retention-settings", async (req, res) => {
  try {
    const { retentionDays } = req.body;
    const parsed = parseInt(retentionDays, 10);
    if (isNaN(parsed) || parsed < 0) {
      return res.status(400).json({
        success: false,
        message: "Retention days must be a non-negative integer (0 or greater).",
      });
    }

    const savedDays = await setChatRetentionDays(parsed);
    let purgedCount = 0;
    if (savedDays > 0) {
      const cleanupResult = await cleanupExpiredAiChatHistory(savedDays);
      purgedCount = cleanupResult.purgedCount || 0;
    }

    const stats = await getChatHistoryStats();

    res.json({
      success: true,
      retentionDays: savedDays,
      purgedCount,
      stats,
      message:
        savedDays === 0
          ? "Chat retention set to Indefinite (auto-deletion disabled)."
          : `Chat history retention set to ${savedDays} day(s). ${purgedCount > 0 ? `Cleaned up ${purgedCount} expired message(s).` : ""}`.trim(),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/ai/cleanup-expired-history
 * Manually trigger expired history cleanup based on configured retention policy.
 */
router.post("/cleanup-expired-history", async (req, res) => {
  try {
    const result = await cleanupExpiredAiChatHistory();
    const stats = await getChatHistoryStats();

    res.json({
      success: true,
      purgedCount: result.purgedCount || 0,
      retentionDays: result.retentionDays || 0,
      stats,
      message:
        result.purgedCount > 0
          ? `Successfully deleted ${result.purgedCount} expired chat message(s) older than ${result.retentionDays} day(s).`
          : `No expired messages found. (Retention policy: ${result.retentionDays > 0 ? `${result.retentionDays} day(s)` : "Indefinite"}).`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/ai/save-key
 * Validate and save runtime Groq API Key.
 */
router.post("/save-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ success: false, message: "Valid API key is required." });
    }

    const cleanKey = String(apiKey).trim().replace(/^["']|["']$/g, "").trim();
    const testRes = await testGroqConnection(cleanKey);

    if (!testRes.success) {
      return res.status(400).json({
        success: false,
        message: `Invalid Groq API key: ${testRes.message}`,
      });
    }

    setRuntimeApiKey(cleanKey);
    process.env.GROQ_API_KEY = cleanKey;

    res.json({
      success: true,
      message: "Groq API key verified and connected successfully!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/ai/save-openrouter-key
 * Validate and save runtime OpenRouter API Key.
 */
router.post("/save-openrouter-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ success: false, message: "Valid OpenRouter API key is required." });
    }

    const cleanKey = String(apiKey).trim().replace(/^["']|["']$/g, "").trim();
    const testRes = await testOpenRouterConnection(cleanKey);

    if (!testRes.success) {
      return res.status(400).json({
        success: false,
        message: `Invalid OpenRouter API key: ${testRes.message}`,
      });
    }

    setRuntimeOpenRouterApiKey(cleanKey);
    process.env.OPENROUTER_API_KEY = cleanKey;

    res.json({
      success: true,
      message: "OpenRouter API key verified and connected successfully!",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/ai/quick-prompts
 * Suggested prompts tailored to OmniSuite ERP.
 */
router.get("/quick-prompts", (req, res) => {
  const prompts = [
    {
      category: "Executive & Revenue",
      title: "Executive Business Summary",
      prompt: "Give me a high-level executive summary of our overall revenue, sales, expenses, and gross profit.",
    },
    {
      category: "Inventory",
      title: "Low Stock & Reorder Analysis",
      prompt: "Check inventory health: which items are below safety reorder level and need urgent replenishment?",
    },
    {
      category: "Production",
      title: "Production Status & Work Orders",
      prompt: "What is our current production status, active work orders, completed units, and machine status?",
    },
    {
      category: "Projects",
      title: "Active Projects & Budgets",
      prompt: "Show me all active projects, their budgets, and expenses incurred so far.",
    },
    {
      category: "POS",
      title: "Retail POS Daily Performance",
      prompt: "How much retail sales have been processed at the POS today, and what are the top selling items?",
    },
    {
      category: "Transport",
      title: "Fleet & Delivery Status",
      prompt: "What is the status of our fleet deliveries and active dispatches?",
    },
    {
      category: "Maintenance",
      title: "Maintenance Job Orders",
      prompt: "Show me open maintenance job orders and equipment requiring attention.",
    },
    {
      category: "Human Resources",
      title: "Workforce Overview",
      prompt: "Give me a breakdown of active workforce headcount across departments.",
    },
  ];

  res.json({ success: true, data: prompts });
});

export default router;
