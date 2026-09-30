/**
 * @fileoverview AI API Routes for "Banks" AI Assistant.
 * Fully enforces RBAC and user permission propagation.
 */

import express from "express";
import { query } from "../db/pool.js";
import {
  chatWithBanks,
  testGroqConnection,
  testOpenRouterConnection,
  setRuntimeApiKey,
  getApiKey,
  setRuntimeOpenRouterApiKey,
  getOpenRouterApiKey,
} from "../services/ai/banks.service.js";

const router = express.Router();

// Attach tenant/branch scope
router.use((req, res, next) => {
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

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    console.error("[Banks AI Error]:", err?.message);
    res.status(500).json({
      success: false,
      message: err?.message || "Failed to process AI conversation.",
    });
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
    "SELECT setting_value FROM adm_system_settings WHERE setting_key = 'banks_ai_enabled' LIMIT 1",
  ).catch(() => []);
  const isEnabled = visRow?.setting_value ? visRow.setting_value === "true" : true;

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
 * Toggle the Ask Banks AI visibility on/off.
 */
router.post("/toggle-visibility", async (req, res) => {
  try {
    const { enabled } = req.body;
    const val = enabled ? "true" : "false";
    await query(
      `INSERT INTO adm_system_settings (company_id, setting_key, setting_value)
       VALUES (1, 'banks_ai_enabled', :val)
       ON DUPLICATE KEY UPDATE setting_value = :val`,
      { val },
    ).catch(async () => {
      await query(
        `UPDATE adm_system_settings SET setting_value = :val WHERE setting_key = 'banks_ai_enabled'`,
        { val },
      );
    });
    res.json({ success: true, enabled: Boolean(enabled) });
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
