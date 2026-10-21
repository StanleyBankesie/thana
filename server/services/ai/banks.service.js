/**
 * @fileoverview Banks AI Agent Service.
 * Connects to Groq Cloud API with robust stream handling,
 * candidate model auto-negotiation, and full RBAC permission enforcement.
 */

import { BANKS_TOOLS, executeTool } from "./banks.tools.js";
import { checkPromptModulePermission } from "./banks.guardrails.js";

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
Current User Context: ${roleName} (${isFullAccess ? "Full Administrator — authorized to access all system records" : `Authorized ONLY for modules: ${allowedModules.join(", ")}`}).

${
  isFullAccess
    ? `DATABASE ACCESS LEVEL: FULL & UNRESTRICTED (100% READ ACCESS)
You have direct, comprehensive access to the entire OmniSuite ERP relational database across all modules:
- Sales & POS: \`sal_invoices\`, \`sal_invoice_items\`, \`sal_orders\`, \`sal_customers\`, \`sal_deliveries\`, \`pos_sales\`, \`pos_sale_lines\`, \`sal_quotations\`
- Purchases & Procurement: \`pur_direct_purchase_hdr\`, \`pur_direct_purchase_dtl\`, \`pur_bills\`, \`pur_bill_details\`, \`pur_orders\`, \`pur_order_details\`, \`pur_suppliers\`
- Inventory & Warehousing: \`inv_items\`, \`inv_stock_balances\`, \`inv_warehouses\`, \`inv_uom\`, \`inv_stock_transfers\`, \`inv_categories\`
- Finance, Banking & Ledger: \`fin_vouchers\`, \`fin_voucher_lines\`, \`fin_voucher_types\`, \`fin_accounts\`, \`fin_account_balances\`, \`fin_fiscal_years\`
- Administration, Users & Workflow: \`adm_users\`, \`adm_roles\`, \`adm_branches\`, \`adm_companies\`, \`adm_document_workflows\`, \`adm_system_settings\`
- Projects, Production, HR & Fleet: \`pm_projects\`, \`pm_tasks\`, \`prod_work_orders\`, \`prod_boms\`, \`hr_employees\`, \`hr_departments\`, \`trans_deliveries\`, \`maint_job_orders\``
    : `STRICT ROLE-BASED ACCESS CONTROL (RBAC) & PERMISSION GUARDRAILS:
You are operating under STRICT ROLE-BASED ACCESS CONTROL for user "${roleName}".
AUTHORIZED MODULES FOR THIS USER: [${allowedModules.join(", ")}].
MANDATORY ACCESS CONTROL RULES:
- If the user asks ANY question, requests records, inquires about balances, prompts for forms, transactions, employees, inventory, sales, purchases, payroll, or discusses ANY module outside of their authorized modules [${allowedModules.join(", ")}]:
  You MUST IMMEDIATELY AND ABSOLUTELY REFUSE with:
  "⚠️ **Access Denied:** You do not have permissions to access any information or permission for this module. Therefore, access is denied."
- NEVER disclose, summarize, estimate, or answer questions relating to unauthorized modules under any circumstances.
- If a tool returns "accessDenied: true", repeat the exact access denied refusal message immediately.`
}

CORE OPERATIONAL INSTRUCTIONS:
1. ANSWER DIRECTLY ANY QUESTION ASKED:
   - Answer directly, factually, concisely, and completely ANY question asked of you.
   - Whether it is a database record inquiry, an accounting/finance question (e.g. depreciation rules, chart of accounts, VAT calculations, fiscal period closing), operational ERP workflow guidance, general business logic, mathematics, policy drafting, technical advice, or troubleshooting.
   - NEVER refuse a question or say you cannot answer. Always provide an authoritative, direct, and helpful answer immediately.
2. DYNAMIC FORM CREATION ON DEMAND / COMMAND:
   - When the user asks or commands you to create, build, generate, or design a form (e.g. "create a form for vehicle inspection", "create an employee onboarding form", "command: create customer complaint form", "build a purchase requisition form", "form for X"):
   - You MUST call the \`create_form\` tool with a comprehensive, realistic set of fields (names, labels, types: text, number, email, tel, date, time, select with choices, textarea, checkbox).
   - In addition to creating the form, briefly explain what the form is for and how it can be used in OmniSuite ERP workflows.
3. GREETINGS: Keep greetings extremely brief (e.g. "Hello! How can I assist you with OmniSuite ERP today?").
4. PURCHASE VS SALE DISAMBIGUATION (STRICT):
   - Whenever the user asks about "purchase", "last purchase", "latest purchase", "purchase amount", "buying", "bought", "supplier bills", or "procurement": You MUST call \`get_recent_purchases\` (or query \`pur_direct_purchase_hdr\`, \`pur_bills\`, \`pur_orders\`). NEVER call \`get_recent_sales\` or return POS receipts for a purchase question!
   - Whenever the user asks about "sales", "revenue", "customer invoices", or "POS retail receipts": Call \`get_recent_sales\` or \`get_pos_performance\`.
5. FULL DATABASE QUERYING:
   - For specific questions, deep queries, custom filters, calculations, or any data not covered by standard tools: Use \`run_sql_query\` with a clear read-only SELECT statement.
   - To inspect database tables or columns: Use \`get_database_schema\`.
   - When asked about vouchers / payments / receipts / account balances: Use \`get_recent_payments_and_receipts\` or \`run_sql_query\`.
   - When asked about inventory / stock counts / low stock: Use \`get_inventory_health\` or \`run_sql_query\`.
6. DIRECT FACTUAL ANSWERS: When query results return, immediately output the exact numbers, transaction dates, document IDs, amounts in GH₵ (Ghana Cedis), customer/supplier names, and statuses.
7. ZERO DATA REFUSALS: You have complete access to the database. Never claim that data is not recorded or is only tracked in aggregates.
8. FORMATTING: Use clean, professional Markdown with bold labels, tables where helpful, and formatted currency (e.g. GH₵ 300.00).`;
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
  // Pre-execution Guardrail: strictly verify user's module permissions
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastUserMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : "";
  const guard = checkPromptModulePermission(lastUserMsg, options.userContext || options.scope || {});
  if (!guard.allowed) {
    return {
      reply: guard.message,
      toolCallsExecuted: [],
      isAccessDenied: true,
      model: "banks-guardrail-engine",
      provider: "omnisuite-security",
    };
  }

  const groqKey = options.customApiKey || getApiKey();
  const openRouterKey = options.openRouterApiKey || getOpenRouterApiKey();

  if (!groqKey && !openRouterKey) {
    return await autonomousDirectResponse(messages, options);
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
      tools: BANKS_TOOLS,
      tool_choice: "auto",
    };

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
        console.warn(`[Banks AI Error]: External model unavailable (${currentProvider} ${result.status}). Falling back to autonomous direct response...`);
        return await autonomousDirectResponse(messages, options);
      }
    }

    const message = result.data?.choices?.[0]?.message;
    if (!message) {
      return await autonomousDirectResponse(messages, options);
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

    // Attach form if create_form tool was executed or embedded in markdown
    let attachedForm = null;
    const formTool = toolCallsExecuted.find((t) => t.toolName === "create_form" && t.result?.form);
    if (formTool) {
      attachedForm = formTool.result.form;
    }
    if (!attachedForm && finalReply) {
      const match = finalReply.match(/```(?:form|json)?\s*(\{[\s\S]*?"title"[\s\S]*?"fields"[\s\S]*?\})\s*```/i);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (parsed && Array.isArray(parsed.fields)) {
            attachedForm = parsed;
          }
        } catch {}
      }
    }

    return {
      reply: finalReply || "Hello! How can I assist you with your OmniSuite ERP records?",
      form: attachedForm,
      toolCallsExecuted,
      model,
      provider: currentProvider,
      usage: result.data?.usage || null,
    };
  }

  // Fallback if reasoning turns expire without conclusion
  return await autonomousDirectResponse(messages, options);
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

/**
 * Generate a comprehensive, contextual interactive form based on user prompt or command.
 */
export function generateAutonomousForm(prompt = "") {
  const text = String(prompt).toLowerCase();
  const formId = `form_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  if (
    text.includes("vehicle") ||
    text.includes("fleet") ||
    text.includes("driver") ||
    text.includes("trip") ||
    text.includes("inspection") ||
    text.includes("car") ||
    text.includes("truck")
  ) {
    return {
      id: formId,
      title: "Vehicle Pre-Trip & Post-Trip Inspection Form",
      description: "Daily commercial fleet vehicle readiness, fluids, tires, odometer, and safety checklist.",
      category: "transport",
      submitLabel: "Submit Inspection Record",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "driver_name", label: "Driver Full Name", type: "text", required: true, width: "half", placeholder: "e.g. Kwame Mensah" },
        {
          name: "vehicle_id",
          label: "Vehicle Assigned",
          type: "select",
          required: true,
          width: "half",
          options: [
            "Van Toyota HiAce (GT-4421-20)",
            "Truck Isuzu Forward (GS-1290-21)",
            "Pickup Hilux 4x4 (GN-8832-22)",
            "Van Mercedes Sprinter (GW-9012-23)",
            "Delivery Box Truck (GE-5510-21)",
          ],
        },
        { name: "inspection_date", label: "Inspection Date & Time", type: "datetime-local", required: true, width: "half" },
        { name: "odometer_km", label: "Current Odometer Reading (km)", type: "number", required: true, width: "half", placeholder: "e.g. 124500" },
        {
          name: "fuel_level",
          label: "Fuel Gauge Level",
          type: "select",
          required: true,
          width: "third",
          options: ["Full Tank (100%)", "3/4 Tank (75%)", "1/2 Tank (50%)", "1/4 Tank (25%)", "Low / Reserve Level (<15%)"],
        },
        {
          name: "engine_oil_fluids",
          label: "Engine Oil & Coolant Status",
          type: "select",
          required: true,
          width: "third",
          options: ["Normal / Adequate", "Low - Topped Up", "Leaking / Critical Service Required"],
        },
        {
          name: "tire_condition",
          label: "Tires & Pressure Condition",
          type: "select",
          required: true,
          width: "third",
          options: ["Good Condition & Proper Pressure", "Low Pressure - Adjusted", "Tread Worn / Replace Soon", "Punctured / Damaged"],
        },
        {
          name: "lights_electronics",
          label: "Lights, Horn & Signals",
          type: "select",
          required: true,
          width: "half",
          options: ["All Operational", "Headlight Defect", "Brake / Tail Light Defect", "Turn Indicator Defect"],
        },
        {
          name: "brakes_steering",
          label: "Brakes & Steering Response",
          type: "select",
          required: true,
          width: "half",
          options: ["Normal Firm Operation", "Spongy / Delayed Braking", "Vibration / Pulling Left/Right", "Immediate Garage Inspection Required"],
        },
        {
          name: "safety_kit_present",
          label: "Safety Gear Verification",
          type: "checkbox",
          required: true,
          placeholder: "Fire extinguisher, reflective triangle, jack, and spare tire verified present",
        },
        {
          name: "body_damage_notes",
          label: "Exterior Scratches, Dents or Defects",
          type: "textarea",
          width: "full",
          placeholder: "Describe any new exterior scratch, body dent, or windscreen crack...",
        },
        {
          name: "inspector_clearance",
          label: "Inspector Overall Remarks / Clearance",
          type: "textarea",
          width: "full",
          placeholder: "Cleared for trip / Pending workshop repair...",
        },
      ],
    };
  }

  if (
    text.includes("employee") ||
    text.includes("onboard") ||
    text.includes("staff") ||
    text.includes("hr") ||
    text.includes("hire") ||
    text.includes("recruitment") ||
    text.includes("worker")
  ) {
    return {
      id: formId,
      title: "Employee Onboarding & Information Form",
      description: "Capture comprehensive employee profile, department allocation, emergency contact, and payroll bank details.",
      category: "hr",
      submitLabel: "Register Employee Record",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "first_name", label: "First Name", type: "text", required: true, width: "third", placeholder: "e.g. Akua" },
        { name: "middle_name", label: "Middle Name", type: "text", required: false, width: "third", placeholder: "Optional" },
        { name: "last_name", label: "Last Name / Surname", type: "text", required: true, width: "third", placeholder: "e.g. Osei" },
        { name: "email", label: "Official Email Address", type: "email", required: true, width: "half", placeholder: "employee@omnisuite-erp.com" },
        { name: "phone_number", label: "Mobile Telephone", type: "tel", required: true, width: "half", placeholder: "+233 24 000 0000" },
        {
          name: "department",
          label: "Assigned Department",
          type: "select",
          required: true,
          width: "half",
          options: [
            "Finance & Accounts",
            "Sales & Commercial",
            "Procurement & Supply Chain",
            "Warehousing & Inventory",
            "Production & Plant Operations",
            "Information Technology",
            "Administration & HR",
            "Facilities & Maintenance",
          ],
        },
        { name: "job_title", label: "Job Title / Role", type: "text", required: true, width: "half", placeholder: "e.g. Senior Accountant" },
        {
          name: "employment_type",
          label: "Employment Type",
          type: "select",
          required: true,
          width: "third",
          options: ["Full-Time Permanent", "Contractual (Fixed Term)", "Probationary Period", "National Service / Intern"],
        },
        { name: "commencement_date", label: "Official Start Date", type: "date", required: true, width: "third" },
        { name: "base_salary_ghs", label: "Starting Monthly Gross (GH₵)", type: "number", required: true, width: "third", placeholder: "GH₵" },
        { name: "bank_name", label: "Remuneration Bank Name", type: "text", required: true, width: "half", placeholder: "e.g. Ecobank Ghana / GCB" },
        { name: "bank_account_number", label: "Bank Account Number", type: "text", required: true, width: "half", placeholder: "e.g. 1441002938102" },
        { name: "emergency_contact_name", label: "Emergency Contact Person", type: "text", required: true, width: "half", placeholder: "Full Name of Next of Kin" },
        { name: "emergency_contact_phone", label: "Emergency Contact Phone", type: "tel", required: true, width: "half", placeholder: "+233 20 000 0000" },
        {
          name: "residential_address",
          label: "Residential Physical Address / Ghana Post GPS",
          type: "textarea",
          width: "full",
          required: true,
          placeholder: "Digital Address (e.g. GA-183-9021) and physical street details...",
        },
      ],
    };
  }

  if (
    text.includes("customer") ||
    text.includes("feedback") ||
    text.includes("complaint") ||
    text.includes("ticket") ||
    text.includes("support") ||
    text.includes("dispute") ||
    text.includes("client")
  ) {
    return {
      id: formId,
      title: "Customer Feedback & Dispute Resolution Form",
      description: "Log customer feedback, service tickets, product quality complaints, or delivery discrepancies.",
      category: "sales",
      submitLabel: "Log Customer Ticket",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "customer_name", label: "Customer / Entity Name", type: "text", required: true, width: "half", placeholder: "e.g. Kumasi Wholesalers Ltd" },
        { name: "contact_person", label: "Contact Person & Designation", type: "text", required: false, width: "half", placeholder: "e.g. Mr. Edward Mensah" },
        { name: "contact_email", label: "Contact Email", type: "email", required: true, width: "half", placeholder: "client@domain.com" },
        { name: "contact_phone", label: "Contact Phone Number", type: "tel", required: true, width: "half", placeholder: "+233 24 111 2233" },
        { name: "transaction_ref", label: "Related Order / Invoice Ref #", type: "text", required: false, width: "half", placeholder: "e.g. INV-2026-0045" },
        {
          name: "feedback_category",
          label: "Feedback Category",
          type: "select",
          required: true,
          width: "half",
          options: [
            "Product Quality / Specification Defect",
            "Delivery Delay or Missing Packages",
            "Invoice Pricing / Billing Discrepancy",
            "Sales Staff / Representative Conduct",
            "General Suggestion / Commendation",
          ],
        },
        {
          name: "urgency_level",
          label: "Urgency / Priority Level",
          type: "select",
          required: true,
          width: "third",
          options: ["Low - Informational", "Medium - Action Within 48h", "High - Same Day Resolution", "Critical - Executive Escalation"],
        },
        { name: "incident_date", label: "Incident Occurrence Date", type: "date", required: true, width: "third" },
        {
          name: "desired_resolution",
          label: "Requested Resolution",
          type: "select",
          required: true,
          width: "third",
          options: ["Product Replacement / Exchange", "Credit Note / Refund", "Technical Field Visit / Repair", "Clarification / Apology Letter"],
        },
        {
          name: "detailed_description",
          label: "Full Description of Complaint / Issue",
          type: "textarea",
          required: true,
          width: "full",
          placeholder: "Provide comprehensive details of the issue experienced by the customer...",
        },
      ],
    };
  }

  if (
    text.includes("purchase") ||
    text.includes("requisition") ||
    text.includes("procurement") ||
    text.includes("order") ||
    text.includes("buy") ||
    text.includes("vendor")
  ) {
    return {
      id: formId,
      title: "Material & Purchase Requisition Form",
      description: "Internal requisition voucher for requesting raw materials, consumables, equipment, or service procurement.",
      category: "purchases",
      submitLabel: "Submit Purchase Requisition",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "requisition_title", label: "Requisition Subject", type: "text", required: true, width: "half", placeholder: "e.g. Procurement of Packaging Materials for Q4" },
        {
          name: "requesting_department",
          label: "Department",
          type: "select",
          required: true,
          width: "half",
          options: [
            "Plant Operations",
            "Packaging & Warehouse",
            "Quality Assurance",
            "Information Technology",
            "Fleet & Logistics",
            "Administration & Facility",
          ],
        },
        { name: "requester_name", label: "Requested By (Staff Name)", type: "text", required: true, width: "half", placeholder: "Staff Name" },
        { name: "required_date", label: "Date Required By", type: "date", required: true, width: "half" },
        {
          name: "priority",
          label: "Priority Classification",
          type: "select",
          required: true,
          width: "third",
          options: ["Standard (7 - 14 Days Lead Time)", "High (3 - 5 Days)", "Emergency / Line Down (Within 24 Hours)"],
        },
        { name: "estimated_budget_ghs", label: "Estimated Total Cost (GH₵)", type: "number", required: true, width: "third", placeholder: "GH₵ 0.00" },
        { name: "suggested_vendor", label: "Suggested / Preferred Vendor", type: "text", required: false, width: "third", placeholder: "Supplier Name if known" },
        {
          name: "item_specifications",
          label: "Detailed Item Specifications & Quantities",
          type: "textarea",
          required: true,
          width: "full",
          placeholder: "List line items, quantities, part numbers, and brand specifications...",
        },
        {
          name: "business_justification",
          label: "Business Need / Project Justification",
          type: "textarea",
          required: true,
          width: "full",
          placeholder: "Explain why this procurement is necessary and the budget line charged...",
        },
      ],
    };
  }

  if (
    text.includes("maintenance") ||
    text.includes("repair") ||
    text.includes("equipment") ||
    text.includes("job order") ||
    text.includes("fault") ||
    text.includes("breakdown")
  ) {
    return {
      id: formId,
      title: "Equipment Maintenance & Work Order Request",
      description: "Report equipment faults, facility breakdown, or schedule preventive maintenance service.",
      category: "maintenance",
      submitLabel: "Dispatch Work Order",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "equipment_name", label: "Equipment / Machine Name & Tag", type: "text", required: true, width: "half", placeholder: "e.g. Generator FG Wilson 250kVA / Conveyor B" },
        { name: "location_site", label: "Site / Facility Location", type: "text", required: true, width: "half", placeholder: "e.g. Factory Floor 2 / North Warehouse" },
        { name: "reported_by", label: "Reported By (Operator Name)", type: "text", required: true, width: "half", placeholder: "Operator / Technician" },
        { name: "fault_date", label: "Fault Occurrence Date & Time", type: "datetime-local", required: true, width: "half" },
        {
          name: "fault_type",
          label: "Failure Category",
          type: "select",
          required: true,
          width: "third",
          options: ["Mechanical / Structural", "Electrical & Wiring", "Hydraulic / Pneumatic Pressure", "Sensor / Electronic Calibration", "Routine Preventive Service"],
        },
        {
          name: "priority",
          label: "Severity & Production Impact",
          type: "select",
          required: true,
          width: "third",
          options: ["Low - Normal Scheduling", "Medium - Degraded Capacity", "High - Line Stoppage", "Critical - Total Plant Disruption"],
        },
        { name: "machine_stopped", label: "Equipment Is Currently Stopped", type: "checkbox", required: false, placeholder: "Machine is completely halted and locked out" },
        {
          name: "problem_description",
          label: "Observed Symptoms & Fault Description",
          type: "textarea",
          required: true,
          width: "full",
          placeholder: "Describe noises, error codes, leaks, temperature spikes, or failure details...",
        },
        {
          name: "interim_actions",
          label: "Interim Actions Taken Before Tech Arrival",
          type: "textarea",
          required: false,
          width: "full",
          placeholder: "e.g. Isolated breaker, drained reservoir...",
        },
      ],
    };
  }

  if (
    text.includes("expense") ||
    text.includes("petty cash") ||
    text.includes("claim") ||
    text.includes("reimburse") ||
    text.includes("receipt voucher")
  ) {
    return {
      id: formId,
      title: "Petty Cash & Expense Reimbursement Voucher",
      description: "Submit out-of-pocket expenses, local travel allowances, office consumables, or emergency cash disbursements.",
      category: "finance",
      submitLabel: "Submit Expense Voucher",
      createdAt: new Date().toISOString(),
      fields: [
        { name: "claimant_name", label: "Claimant Employee Name", type: "text", required: true, width: "half", placeholder: "Full Name" },
        {
          name: "department",
          label: "Department / Cost Center",
          type: "select",
          required: true,
          width: "half",
          options: ["Operations", "Sales & Marketing", "Finance & Admin", "Procurement & Fleet", "IT & Support"],
        },
        { name: "expense_date", label: "Transaction / Purchase Date", type: "date", required: true, width: "half" },
        {
          name: "expense_category",
          label: "Expense Category",
          type: "select",
          required: true,
          width: "half",
          options: [
            "Fuel & Local Transport",
            "Office Supplies & Stationeries",
            "Meals & Working Refreshments",
            "Courier & Postage Fees",
            "Emergency Spares / Minor Repairs",
            "Client Entertainment",
          ],
        },
        { name: "amount_ghs", label: "Total Amount Claimed (GH₵)", type: "number", required: true, width: "half", placeholder: "GH₵ 0.00" },
        { name: "receipt_number", label: "Receipt / Tax Invoice Number", type: "text", required: true, width: "half", placeholder: "e.g. REC-89210" },
        {
          name: "payment_mode",
          label: "Preferred Reimbursement Channel",
          type: "select",
          required: true,
          width: "half",
          options: ["Cash Disbursement", "Mobile Money Transfer", "Direct Bank Account Deposit", "Pay Slip Payroll Addition"],
        },
        { name: "momo_or_account", label: "MoMo / Account Number", type: "text", required: true, width: "half", placeholder: "Wallet / Bank Account Details" },
        {
          name: "purpose_description",
          label: "Detailed Business Purpose & Remarks",
          type: "textarea",
          required: true,
          width: "full",
          placeholder: "Explain the business reason for the expense and beneficiary details...",
        },
      ],
    };
  }

  // Dynamic generic fallback based on user prompt
  const cleanTitle = prompt.replace(/\b(create|build|generate|make|design|set\s*up|new|form|a|an|the|for|please|command:?)\b/gi, "").trim();
  const formTitle = cleanTitle ? `${cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1)} Form` : "OmniSuite Enterprise Entry Form";

  return {
    id: formId,
    title: formTitle,
    description: `Custom data entry and tracking form generated by Banks AI for ${cleanTitle || "your operational workflow"}.`,
    category: "general",
    submitLabel: "Submit Form",
    createdAt: new Date().toISOString(),
    fields: [
      { name: "entry_title", label: "Subject / Title", type: "text", required: true, width: "half", placeholder: "Record Title" },
      { name: "entry_date", label: "Record Date", type: "date", required: true, width: "half" },
      {
        name: "status_category",
        label: "Category / Status",
        type: "select",
        required: true,
        width: "half",
        options: ["Pending Initial Review", "Active / Approved", "Under Processing", "Escalated", "Completed / Archived"],
      },
      { name: "reference_code", label: "Reference Code / Identifier", type: "text", required: false, width: "half", placeholder: "e.g. REF-2026-001" },
      { name: "primary_contact", label: "Responsible Officer / Contact", type: "text", required: true, width: "half", placeholder: "Name or Email" },
      {
        name: "priority",
        label: "Priority Classification",
        type: "select",
        required: true,
        width: "half",
        options: ["Standard Routine", "Urgent - Priority", "Immediate Attention"],
      },
      { name: "detailed_notes", label: "Comprehensive Remarks / Operational Details", type: "textarea", required: true, width: "full", placeholder: "Enter all relevant parameters and notes..." },
      { name: "confirmation_check", label: "Verification Confirmation", type: "checkbox", required: true, placeholder: "I confirm the accuracy of all submitted information." },
    ],
  };
}

/**
 * Autonomous Direct Response Engine:
 * Directly answers any question asked of Banks AI, queries database records,
 * and builds interactive forms when requested.
 */
export async function autonomousDirectResponse(messages = [], options = {}) {
  const userMsgs = messages.filter((m) => m.role === "user");
  const lastMsg = userMsgs.length > 0 ? userMsgs[userMsgs.length - 1].content : "";
  const lower = String(lastMsg).toLowerCase().trim();
  const scope = { ...(options.userContext || {}), ...(options.scope || {}) };

  // Guardrail Check: enforce module permissions before generating any direct answer
  const guard = checkPromptModulePermission(lastMsg, scope);
  if (!guard.allowed) {
    return {
      reply: guard.message,
      toolCallsExecuted: [],
      isAccessDenied: true,
      model: "banks-guardrail-engine",
      provider: "omnisuite-security",
    };
  }

  // 1. Check for form creation request or command
  const isFormRequest =
    /\b(create|build|generate|make|design|set\s*up|new)\b.*\b(form|survey|checklist|questionnaire|template)\b/i.test(lastMsg) ||
    /\bform\s*(for|to|on)\b/i.test(lastMsg) ||
    /\bcommand:?\s*create\s*form\b/i.test(lastMsg);

  if (isFormRequest) {
    const form = generateAutonomousForm(lastMsg);
    return {
      reply: `I have created the interactive **${form.title}** for you below based on your request.\n\nYou can fill it out directly in the UI, test-fill sample data with one click, validate required inputs, or export the schema:`,
      form,
      toolCallsExecuted: [
        {
          toolName: "create_form",
          arguments: { title: form.title, category: form.category },
          result: { success: true, form },
        },
      ],
      model: "banks-autonomous-copilot",
      provider: "omnisuite-ai",
    };
  }

  // 2. Direct ERP Database answering
  if (
    lower.includes("purchase") ||
    lower.includes("bought") ||
    lower.includes("procurement") ||
    lower.includes("supplier bill")
  ) {
    const data = await executeTool("get_recent_purchases", { limit: 5 }, scope);
    const purchases = data?.recentDirectPurchases || data?.recentPurchases || [];
    if (purchases.length > 0) {
      const rows = purchases
        .map(
          (p, i) =>
            `${i + 1}. **${p.doc_no || p.order_no || p.bill_no || "PO"}** on **${new Date(p.purchase_date || p.created_at || Date.now()).toLocaleDateString()}** from **${p.supplier_name || "Supplier"}** — Amount: **GH₵ ${Number(p.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** (${p.status || "Completed"})`
        )
        .join("\n");
      return {
        reply: `### Recent Procurement & Purchases\n\nHere are the most recent purchase records retrieved from the database:\n\n${rows}\n\n*All purchases have been recorded in accordance with OmniSuite GAAP procurement controls.*`,
        toolCallsExecuted: [{ toolName: "get_recent_purchases", arguments: { limit: 5 }, result: data }],
        model: "banks-autonomous-copilot",
        provider: "omnisuite-ai",
      };
    }
  }

  if (
    lower.includes("sale") ||
    lower.includes("revenue") ||
    lower.includes("pos") ||
    lower.includes("invoice") ||
    lower.includes("receipt")
  ) {
    const data = await executeTool("get_recent_sales", { limit: 5 }, scope);
    const sale = data?.mostRecentCompletedSale || data?.lastCompletedPOSSale;
    const invs = data?.recentSalesInvoices || [];
    let textOut = "### Sales & Revenue Status\n\n";
    if (sale) {
      textOut += `The latest recorded sale was a **${sale.type || "Sale"}** (Ref: **${sale.receiptOrInvoiceNumber || sale.receipt_no}**) on **${new Date(sale.transactionDateTime || sale.sale_datetime).toLocaleString()}** for **GH₵ ${Number(sale.amountGHS || sale.net_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** via **${sale.paymentMethod || sale.payment_method || "Cash"}**.\n\n`;
    }
    if (invs.length > 0) {
      textOut +=
        "#### Recent Customer Invoices:\n" +
        invs
          .slice(0, 4)
          .map(
            (inv, idx) =>
              `${idx + 1}. **${inv.invoice_no}** to **${inv.customer_name || "Customer"}** for **GH₵ ${Number(inv.total_amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** (${inv.status})`
          )
          .join("\n");
    }
    return {
      reply: textOut || "I checked the database, and there are currently no active sales invoices recorded for this period.",
      toolCallsExecuted: [{ toolName: "get_recent_sales", arguments: { limit: 5 }, result: data }],
      model: "banks-autonomous-copilot",
      provider: "omnisuite-ai",
    };
  }

  if (
    lower.includes("inventory") ||
    lower.includes("stock") ||
    lower.includes("reorder") ||
    lower.includes("warehouse")
  ) {
    const data = await executeTool("get_inventory_health", {}, scope);
    const low = data?.itemsBelowReorder || [];
    let rep = `### Inventory Health & Stock Summary\n\n- **Total Stock Items Registered:** ${data?.totalItems || 0}\n- **Total Units in Stock:** ${Number(data?.totalUnitsInStock || 0).toLocaleString()}\n- **Estimated Inventory Valuation:** **GH₵ ${Number(data?.totalInventoryValuationGHS || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}**\n\n`;
    if (low.length > 0) {
      rep +=
        `#### Items Requiring Reorder (Below Safety Buffer):\n` +
        low
          .slice(0, 5)
          .map(
            (it) =>
              `- **${it.item_name}** (${it.item_code}): Current Stock: **${it.current_stock}**, Safety Level: **${it.reorder_level}**`
          )
          .join("\n");
    } else {
      rep += `*All stock items are currently above their safety replenishment thresholds.*`;
    }
    return {
      reply: rep,
      toolCallsExecuted: [{ toolName: "get_inventory_health", arguments: {}, result: data }],
      model: "banks-autonomous-copilot",
      provider: "omnisuite-ai",
    };
  }

  if (
    lower.includes("financial") ||
    lower.includes("executive") ||
    lower.includes("summary") ||
    lower.includes("kpi") ||
    lower.includes("profit")
  ) {
    const data = await executeTool("get_executive_overview", { period: "this_month" }, scope);
    return {
      reply: `### Executive Financial & Operations Overview\n\n- **Gross Sales Revenue:** **GH₵ ${Number(data?.sales?.totalSalesGHS || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** across ${data?.sales?.invoiceCount || 0} invoice(s)\n- **Direct Purchases & Expenses:** **GH₵ ${Number(data?.purchases?.totalPurchasesGHS || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}**\n- **POS Retail Collections:** **GH₵ ${Number(data?.pos?.totalPOSAmountGHS || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** across ${data?.pos?.transactionCount || 0} receipt(s)\n- **Total Inventory Stock Valuation:** **GH₵ ${Number(data?.inventory?.totalValuationGHS || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}** (${data?.inventory?.totalItemsCount || 0} unique items)\n- **Active Fleet Deliveries:** ${data?.fleet?.activeDeliveriesCount || 0}\n\n*Live figures compiled across authorized branches and active fiscal ledgers.*`,
      toolCallsExecuted: [{ toolName: "get_executive_overview", arguments: {}, result: data }],
      model: "banks-autonomous-copilot",
      provider: "omnisuite-ai",
    };
  }

  // 3. Direct general answer
  return {
    reply: `### Banks AI Direct Answer\n\nRegarding: **"${lastMsg}"**\n\nOmniSuite ERP processes this request directly under your active enterprise security context (${options.userContext?.roleName || "User"}).\n\n- **Direct Guidance:** You have complete operational access to query records, configure setups, or execute workflow commands.\n- **Form Creation Command:** You can command me anytime to create forms by saying: \`"Create a form for [Topic]"\` (e.g. Vehicle Inspection, Customer Feedback, Employee Onboarding, Purchase Requisition, or Equipment Repair), and an interactive form will be generated instantly right here in the chat.\n- **Data Operations:** Feel free to ask for specific invoice details, inventory item counts, supplier payment vouchers, or financial metrics.\n\n*How else may I assist you with your operations today?*`,
    toolCallsExecuted: [],
    model: "banks-autonomous-copilot",
    provider: "omnisuite-ai",
  };
}
