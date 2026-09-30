/**
 * @fileoverview Banks AI Agent Service.
 * Connects to Groq Cloud API with robust stream handling,
 * candidate model auto-negotiation, and full RBAC permission enforcement.
 */

import { BANKS_TOOLS, executeTool } from "./banks.tools.js";

// Provider Endpoints
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";

// Groq Candidate Models
export const GROQ_CANDIDATE_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
  "qwen/qwen3.6-27b",
  "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant",
  "llama3-70b-8192",
  "groq/compound",
];

// OpenRouter Candidate Models (including stealth/ox-alpha and free router)
export const OPENROUTER_CANDIDATE_MODELS = [
  "stealth/ox-alpha",
  "openrouter/free",
  "meta-llama/llama-3.3-70b-instruct:free",
  "qwen/qwen-2.5-72b-instruct:free",
  "google/gemini-2.0-flash-exp:free",
];

export const ALL_MODELS = [
  ...GROQ_CANDIDATE_MODELS,
  ...OPENROUTER_CANDIDATE_MODELS,
];

let activeWorkingModel = "qwen/qwen3.6-27b";
let runtimeGroqApiKey = process.env.GROQ_API_KEY || "";
let runtimeOpenRouterApiKey = process.env.OPENROUTER_API_KEY || "";

export function setRuntimeApiKey(key) {
  runtimeGroqApiKey = String(key || "").trim().replace(/^["']|["']$/g, "").trim();
}

export function getApiKey() {
  return runtimeGroqApiKey || process.env.GROQ_API_KEY || "";
}

export function setRuntimeOpenRouterApiKey(key) {
  runtimeOpenRouterApiKey = String(key || "").trim().replace(/^["']|["']$/g, "").trim();
}

export function getOpenRouterApiKey() {
  return runtimeOpenRouterApiKey || process.env.OPENROUTER_API_KEY || "";
}

/**
 * Determine provider from model name.
 */
export function detectProvider(modelName = "") {
  const m = String(modelName).toLowerCase();
  if (
    m.startsWith("stealth/") ||
    m.startsWith("openrouter/") ||
    m.includes(":free") ||
    m.startsWith("google/") ||
    m.startsWith("meta-llama/")
  ) {
    return "openrouter";
  }
  return "groq";
}

/**
 * System prompt builder with affirmative operational guidelines and RBAC context.
 */
function buildSystemPrompt(userContext = {}) {
  const { roleName = "User", allowedModules = ["*"], isSuperAdmin = false } = userContext;
  const isFullAccess = isSuperAdmin || (Array.isArray(allowedModules) && allowedModules.includes("*"));

  return `You are "Banks", the intelligent executive AI Assistant for OmniSuite ERP.
Current User Context: ${roleName} (${isFullAccess ? "Full Administrator — authorized to access all system records" : `Authorized for modules: ${allowedModules.join(", ")}`}).

DATABASE ACCESS LEVEL: FULL & UNRESTRICTED (100% READ ACCESS)
You have direct, comprehensive access to the entire OmniSuite ERP relational database across all modules:
- Sales & POS: \`sal_invoices\`, \`sal_invoice_items\`, \`sal_orders\`, \`sal_customers\`, \`sal_deliveries\`, \`pos_sales\`, \`pos_sale_lines\`, \`sal_quotations\`
- Purchases & Procurement: \`pur_direct_purchase_hdr\`, \`pur_direct_purchase_dtl\`, \`pur_bills\`, \`pur_bill_details\`, \`pur_orders\`, \`pur_order_details\`, \`pur_suppliers\`
- Inventory & Warehousing: \`inv_items\`, \`inv_stock_balances\`, \`inv_warehouses\`, \`inv_uom\`, \`inv_stock_transfers\`, \`inv_categories\`
- Finance, Banking & Ledger: \`fin_vouchers\`, \`fin_voucher_lines\`, \`fin_voucher_types\`, \`fin_accounts\`, \`fin_account_balances\`, \`fin_fiscal_years\`
- Administration, Users & Workflow: \`adm_users\`, \`adm_roles\`, \`adm_branches\`, \`adm_companies\`, \`adm_document_workflows\`, \`adm_system_settings\`
- Projects, Production, HR & Fleet: \`pm_projects\`, \`pm_tasks\`, \`prod_work_orders\`, \`prod_boms\`, \`hr_employees\`, \`hr_departments\`, \`trans_deliveries\`, \`maint_job_orders\`

CORE OPERATIONAL INSTRUCTIONS:
1. GREETINGS: Keep greetings extremely brief (e.g. "Hello! How can I assist you with OmniSuite ERP today?").
2. PURCHASE VS SALE DISAMBIGUATION (STRICT):
   - Whenever the user asks about "purchase", "last purchase", "latest purchase", "purchase amount", "buying", "bought", "supplier bills", or "procurement": You MUST call \`get_recent_purchases\` (or query \`pur_direct_purchase_hdr\`, \`pur_bills\`, \`pur_orders\`). NEVER call \`get_recent_sales\` or return POS receipts for a purchase question!
   - Whenever the user asks about "sales", "revenue", "customer invoices", or "POS retail receipts": Call \`get_recent_sales\` or \`get_pos_performance\`.
3. FULL DATABASE QUERYING:
   - For specific questions, deep queries, custom filters, calculations, or any data not covered by standard tools: Use \`run_sql_query\` with a clear read-only SELECT statement.
   - To inspect database tables or columns: Use \`get_database_schema\`.
   - When asked about vouchers / payments / receipts / account balances: Use \`get_recent_payments_and_receipts\` or \`run_sql_query\`.
   - When asked about inventory / stock counts / low stock: Use \`get_inventory_health\` or \`run_sql_query\`.
4. DIRECT FACTUAL ANSWERS: When query results return, immediately output the exact numbers, transaction dates, document IDs, amounts in GH₵ (Ghana Cedis), customer/supplier names, and statuses.
5. ZERO DATA REFUSALS: You have complete access to the database. Never claim that data is not recorded or is only tracked in aggregates.
6. FORMATTING: Use clean, professional Markdown with bold labels, tables where helpful, and formatted currency (e.g. GH₵ 300.00).`;
}

/**
 * Helper to execute a single POST request to Groq or OpenRouter and safely parse the response text.
 */
async function callChatProvider(provider, apiKey, payload) {
  const url = provider === "openrouter" ? OPENROUTER_API_URL : GROQ_API_URL;
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://omnisuite-erp.com";
    headers["X-Title"] = "OmniSuite ERP Banks AI";
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsedData = null;
  try {
    parsedData = JSON.parse(rawText);
  } catch {
    parsedData = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    rawText,
    data: parsedData,
    provider,
  };
}

/**
 * Send a chat message to Banks AI with automated multi-turn tool calling and dual-provider auto-fallback.
 *
 * @param {Array<{role: string, content: string}>} messages Conversation history
 * @param {object} options Context options (scope, model, customApiKey, userContext)
 * @returns {Promise<{reply: string, toolCallsExecuted: Array<object>, model: string, provider: string}>}
 */
export async function chatWithBanks(messages = [], options = {}) {
  const groqKey = options.customApiKey || getApiKey();
  const openRouterKey = options.openRouterApiKey || getOpenRouterApiKey();

  if (!groqKey && !openRouterKey) {
    throw new Error(
      "No AI API Key is configured. Please configure your GROQ_API_KEY or OPENROUTER_API_KEY in System Settings."
    );
  }

  let requestedModel = options.model || activeWorkingModel;
  let primaryProvider = detectProvider(requestedModel);

  // If user selected OpenRouter model but has no OpenRouter key, fallback to Groq if key exists
  if (primaryProvider === "openrouter" && !openRouterKey && groqKey) {
    primaryProvider = "groq";
    requestedModel = "openai/gpt-oss-120b";
  } else if (primaryProvider === "groq" && !groqKey && openRouterKey) {
    primaryProvider = "openrouter";
    requestedModel = "stealth/ox-alpha";
  }

  let activeApiKey = primaryProvider === "openrouter" ? openRouterKey : groqKey;
  let model = requestedModel;
  const toolCallsExecuted = [];

  const systemPromptText = buildSystemPrompt(options.userContext || options.scope || {});

  // Build full message thread with dynamic RBAC system prompt
  const fullMessages = [
    { role: "system", content: systemPromptText },
    ...messages.map((m) => ({
      role: m.role === "user" || m.role === "assistant" || m.role === "system" || m.role === "tool" ? m.role : "user",
      content: m.content || "",
      ...(m.tool_calls ? { tool_calls: m.tool_calls } : {}),
      ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
    })),
  ];

  let currentMessages = [...fullMessages];
  let maxTurns = 6;
  let currentProvider = primaryProvider;

  while (maxTurns > 0) {
    maxTurns--;

    const payload = {
      model,
      messages: currentMessages,
      temperature: 0.2,
      max_tokens: 2048,
    };

    // Only supply tools if no tools have been executed yet (or if model is still gathering data)
    if (toolCallsExecuted.length === 0) {
      payload.tools = BANKS_TOOLS;
      payload.tool_choice = "auto";
    }

    let result = await callChatProvider(currentProvider, activeApiKey, payload);

    // If Groq returns 429 (Rate limit / Quota reached) or 503, automatically failover to OpenRouter
    if (!result.ok && currentProvider === "groq" && openRouterKey) {
      const isQuotaOrOverload =
        result.status === 429 ||
        result.status === 503 ||
        result.data?.error?.code === "rate_limit_exceeded" ||
        result.rawText?.includes("rate_limit") ||
        result.rawText?.includes("tokens per day");

      if (isQuotaOrOverload) {
        console.warn(`[Banks AI] Groq 429 Quota Exceeded. Automatically falling back to OpenRouter (stealth/ox-alpha)...`);
        currentProvider = "openrouter";
        activeApiKey = openRouterKey;
        model = "stealth/ox-alpha";
        payload.model = model;
        result = await callChatProvider(currentProvider, activeApiKey, payload);
      }
    }

    // Model candidate negotiation fallback within current provider
    if (!result.ok) {
      const candidateList = currentProvider === "openrouter" ? OPENROUTER_CANDIDATE_MODELS : GROQ_CANDIDATE_MODELS;
      let found = false;

      for (const candidate of candidateList) {
        if (candidate === model) continue;
        payload.model = candidate;
        const retryRes = await callChatProvider(currentProvider, activeApiKey, payload);
        if (retryRes.ok) {
          result = retryRes;
          model = candidate;
          activeWorkingModel = candidate;
          found = true;
          break;
        }
      }

      // If still not resolved and OpenRouter key is available, attempt OpenRouter as last resort
      if (!found && currentProvider === "groq" && openRouterKey) {
        currentProvider = "openrouter";
        activeApiKey = openRouterKey;
        for (const candidate of OPENROUTER_CANDIDATE_MODELS) {
          payload.model = candidate;
          const retryRes = await callChatProvider(currentProvider, activeApiKey, payload);
          if (retryRes.ok) {
            result = retryRes;
            model = candidate;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        const errMsg = result.data?.error?.message || result.rawText || "Model unavailable";
        throw new Error(`AI Provider Error (${currentProvider} ${result.status}): ${errMsg}`);
      }
    }

    const message = result.data?.choices?.[0]?.message;
    if (!message) {
      throw new Error("No response returned from AI engine.");
    }

    // Check if model called one or more tools
    if (message.tool_calls && message.tool_calls.length > 0) {
      currentMessages.push(message);

      for (const toolCall of message.tool_calls) {
        const fnName = toolCall.function?.name;
        let fnArgs = {};
        try {
          fnArgs = JSON.parse(toolCall.function?.arguments || "{}");
        } catch {
          fnArgs = {};
        }

        // Execute ERP tool query with RBAC scope
        const combinedScope = { ...(options.userContext || {}), ...(options.scope || {}) };
        const toolResult = await executeTool(fnName, fnArgs, combinedScope);
        toolCallsExecuted.push({
          toolName: fnName,
          arguments: fnArgs,
          result: toolResult,
        });

        // Add tool result to conversation context
        currentMessages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Loop back to synthesize tool results into final executive answer
      continue;
    }

    // Finished synthesis
    let finalReply = (message.content || "").trim();

    // Check reasoning fields if main content is empty
    if (!finalReply && message.reasoning_content) {
      finalReply = String(message.reasoning_content).trim();
    }
    if (!finalReply && message.reasoning) {
      finalReply = String(message.reasoning).trim();
    }

    // Strip internal thinking tags (<think> ... </think>)
    finalReply = finalReply.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // If reply is still empty after executing tools, synthesize a direct factual answer
    if (!finalReply && toolCallsExecuted.length > 0) {
      const toolSummaries = toolCallsExecuted.map(t => {
        const res = t.result;
        if (res?.mostRecentCompletedSale) {
          const s = res.mostRecentCompletedSale;
          return `The last recorded sale in the system was a **${s.type}** (Ref: **${s.receiptOrInvoiceNumber}**) on **${new Date(s.transactionDateTime).toLocaleString()}** for **GH₵ ${Number(s.amountGHS).toFixed(2)}** via **${s.paymentMethod}** (Status: ${s.status}).`;
        }
        if (res?.lastCompletedPOSSale) {
          const p = res.lastCompletedPOSSale;
          return `The last POS retail sale (Receipt: **${p.receipt_no}**) was processed on **${new Date(p.sale_datetime).toLocaleString()}** for **GH₵ ${Number(p.net_amount).toFixed(2)}** via **${p.payment_method}** (Status: ${p.status}).`;
        }
        if (res?.recentSalesInvoices && res.recentSalesInvoices.length > 0) {
          const inv = res.recentSalesInvoices[0];
          return `The most recent sales invoice is **${inv.invoice_no}** dated **${new Date(inv.invoice_date).toLocaleDateString()}** for **GH₵ ${Number(inv.total_amount).toFixed(2)}** (Status: ${inv.status}).`;
        }
        return "";
      }).filter(Boolean);

      if (toolSummaries.length > 0) {
        finalReply = toolSummaries.join("\n\n");
      } else {
        finalReply = "I have queried the database records according to your permissions, but no matching sales records were found.";
      }
    }

    return {
      reply: finalReply || "Hello! How can I assist you with your OmniSuite ERP records?",
      toolCallsExecuted,
      model,
      provider: currentProvider,
      usage: result.data?.usage || null,
    };
  }

  throw new Error("Maximum AI reasoning iterations reached without concluding.");
}

/**
 * Test Groq API key connectivity by calling the /models endpoint.
 */
export async function testGroqConnection(apiKey) {
  const rawKey = apiKey || getApiKey();
  if (!rawKey) return { success: false, message: "No Groq API key provided" };
  const key = String(rawKey).trim().replace(/^["']|["']$/g, "").trim();

  try {
    const res = await fetch(GROQ_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
      },
    });

    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!res.ok) {
      const errorMsg = data?.error?.message || rawText;
      return { success: false, message: errorMsg };
    }

    const modelIds = (data?.data || []).map((m) => m.id);

    return {
      success: true,
      message: "Connected to Groq Cloud successfully!",
      models: modelIds,
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}

/**
 * Test OpenRouter API key connectivity by calling the /models endpoint.
 */
export async function testOpenRouterConnection(apiKey) {
  const rawKey = apiKey || getOpenRouterApiKey();
  if (!rawKey) return { success: false, message: "No OpenRouter API key provided" };
  const key = String(rawKey).trim().replace(/^["']|["']$/g, "").trim();

  try {
    const res = await fetch(OPENROUTER_MODELS_URL, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${key}`,
        "HTTP-Referer": "https://omnisuite-erp.com",
        "X-Title": "OmniSuite ERP Banks AI",
      },
    });

    const rawText = await res.text();
    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {}

    if (!res.ok) {
      const errorMsg = data?.error?.message || rawText;
      return { success: false, message: errorMsg };
    }

    return {
      success: true,
      message: "Connected to OpenRouter successfully!",
    };
  } catch (e) {
    return { success: false, message: e.message };
  }
}
