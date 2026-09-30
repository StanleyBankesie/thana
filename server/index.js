import cors from "cors";
import "./utils/loadServerEnv.js";
import fs from "fs";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import rateLimit from "express-rate-limit";
import RedisStore from "rate-limit-redis";
import helmet from "helmet";
import morgan from "morgan";
import { logToCrashReport } from "./utils/crashLogger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFound } from "./middleware/notFound.js";
import { sanitizeInput } from "./middleware/sanitize.middleware.js";
import { requireAuth as requireAuthMiddleware } from "./middleware/auth.js";
import adminRoutes from "./routes/admin.route.js";
import backupRoutes from "./routes/backup.routes.js";
import salesRoutes from "./routes/sales.route.js";
import purchaseRoutes from "./routes/purchase.routes.js";
import purchaseBillsRoutes from "./routes/purchase.bills.routes.js";
import inventoryRoutes from "./routes/inventory.routes.js";
import financeRoutes from "./routes/finance.routes.js";
import hrRoutes from "./routes/hr.routes.js";
import maintenanceRoutes from "./routes/maintenance.routes.js";
import projectsRoutes from "./routes/projects.routes.js";
import productionRoutes from "./routes/production.routes.js";
import posRoutes from "./routes/pos.routes.js";
import biRoutes from "./routes/bi.routes.js";
import serviceMgmtRoutes from "./routes/service-management.routes.js";
import srvInvoicesRoutes from "./routes/srv_invoices.route.js";
import transportRoutes from "./routes/transport.route.js";
import trackingRoutes from "./routes/tracking.route.js";
import uploadRoutes from "./routes/upload.routes.js";
import workflowRoutes from "./routes/workflow.routes.js";
import healthRoutes from "./routes/health.route.js";
import authRoutes from "./routes/auth.routes.js";
import executiveRoutes from "./routes/executive.routes.js";
import { logDbError, query, testDbConnection } from "./db/pool.js";
import { isMailerConfigured, verifyMailer, sendMail } from "./utils/mailer.js";
import { isSMSConfigured, sendSMS } from "./utils/sms.js";
import { isWhatsAppConfigured, sendWhatsApp } from "./utils/whatsapp.js";
import { closeRedis, getRedis } from "./utils/redis.js";
import { getLowStockQueue, closeJobQueues } from "./utils/jobQueue.js";
import pushRoutes, {
  sendPushToUser,
  getPublicKey,
} from "./routes/push.routes.js";
import templatesRoutes from "./routes/templates.routes.js";
import documentsRoutes from "./routes/documents.routes.js";
import socialFeedRoutes from "./routes/social-feed.routes.js";
import accessRoutes from "./routes/access.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import aiRoutes from "./routes/ai.routes.js";
import emailTestRoutes from "./routes/email-test.routes.js";
import visitorsRoutes from "./routes/visitors.routes.js";
import licenseRoutes from "./routes/license.routes.js";
import paymentPackageRoutes from "./routes/paymentPackages.js";
import { requireLicense } from "./middleware/license.middleware.js";
import { initializeSocket } from "./utils/socket.js";
import {
  ensureExceptionalPermissionsTable,
  ensureSystemLogsTable,
  ensureUserPermissionsTable,
  ensureUserPermissionCacheAndTriggers,
  ensureUserBranchMapping,
  ensurePagesTable,
  hasColumn,
  verifiedTables,
  ensurePMQuotationTables,
  ensurePMInvoiceTables,
  ensureSocialFeedTables,
  ensureTransportTables,
} from "./utils/dbUtils.js";
import { seedDefaultTemplates } from "./services/seed-defaults.js";
import { ensureIndexes } from "./utils/ensureIndexes.js";
import { initCronJobs } from "./utils/cronJobs.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------------- ENV ---------------- */
import { loadServerEnv } from "./utils/loadServerEnv.js";
loadServerEnv(import.meta.url);

const serveFrontendFlag = (() => {
  const v1 = String(process.env.SERVE_FRONTEND || "").toLowerCase();
  const v2 = String(process.env.ENABLE_SPA || "").toLowerCase();
  if (v1 === "0" || v1 === "false" || v2 === "0" || v2 === "false")
    return false;
  return true; // Default to true if a frontend build is present
})();

const app = express();
app.set("trust proxy", 1);

/* ---------------- CORS CONFIGURATION ---------------- */
const allowedOrigins = (() => {
  const raw = String(process.env.CORS_ALLOWED_ORIGINS || "").trim();
  const origins = raw
    ? raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const defaults = [
    "https://thana.omnisuite-erp.com",
    "https://thanaserver.omnisuite-erp.com",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:4002",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:4002",
  ];
  for (const d of defaults) {
    if (!origins.includes(d)) origins.push(d);
  }
  return origins;
})();

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (
    origin.endsWith(".omnisuite-erp.com") ||
    origin.includes("omnisuite-erp.com") ||
    origin.includes("localhost") ||
    origin.includes("127.0.0.1") ||
    origin.includes("192.168.") ||
    origin.includes("10.") ||
    origin.includes("172.") ||
    origin.startsWith("exp://") ||
    origin.startsWith("http://") ||
    origin.startsWith("https://")
  ) {
    return true;
  }
  return false;
};

const corsOptions = {
  origin: (origin, cb) => {
    if (isAllowedOrigin(origin)) {
      return cb(null, true);
    }
    return cb(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH", "HEAD"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-company-id",
    "x-branch-id",
    "x-user-id",
    "x-skip-offline-queue",
    "x-access-token",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
  optionsSuccessStatus: 200,
};

// Universal CORS & Preflight handler at the top of the stack
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && isAllowedOrigin(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS, PATCH, HEAD",
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-company-id, x-branch-id, x-user-id, x-skip-offline-queue, x-access-token, Accept, Origin, X-Requested-With",
    );
  }
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    // Disable COEP — Vite adds crossorigin to all <script> tags, which makes
    // the browser fetch in CORS mode.  Under require-corp, express.static
    // responses (which lack CORS headers) are blocked with net::ERR_FAILED.
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  }),
);

app.use((req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );
  next();
});
app.use(morgan("dev"));

app.use((req, res, next) => {
  const startedAt = Date.now();
  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  res.locals.__requestId = requestId;

  const getBaseContext = () => ({
    requestId,
    durationMs: Date.now() - startedAt,
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip,
    origin: req.headers?.origin || "",
    userAgent: req.headers?.["user-agent"] || "",
    userId: Number(req.user?.sub || req.user?.id) || null,
    companyId: req.scope?.companyId ?? null,
    branchId: req.scope?.branchId ?? null,
  });

  res.on("finish", () => {
    const status = Number(res.statusCode || 0) || 0;
    if (status >= 400 && res.locals.__crashLogged !== true) {
      logToCrashReport(
        `HTTP_${status}`,
        `Request failed with status ${status}`,
        {
          ...getBaseContext(),
          status,
        },
      );
      res.locals.__crashLogged = true;
    }
  });

  res.on("close", () => {
    if (res.writableEnded) return;
    if (res.locals.__crashLogged === true) return;
    logToCrashReport(
      "HTTP_CONNECTION_CLOSED",
      "Connection closed before response finished",
      getBaseContext(),
    );
    res.locals.__crashLogged = true;
  });

  next();
});

app.use((req, res, next) => {
  const isProd =
    String(process.env.NODE_ENV || "").toLowerCase() === "production";
  const connectSrc = process.env.CSP_CONNECT_SRC || "'self' wss: ws:";
  const scriptSrc =
    isProd && String(process.env.CSP_ALLOW_EVAL || "").trim() !== "1"
      ? "'self'"
      : "'self' 'unsafe-eval'";
  res.setHeader(
    "Content-Security-Policy",
    `default-src 'self'; script-src ${scriptSrc}; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net; connect-src ${connectSrc};`,
  );
  next();
});

/* ---------------- HTTP/2 COMPAT ---------------- */
// Phusion Passenger passes Connection headers verbatim to Nginx, which then
// forwards them to HTTP/2 clients. HTTP/2 forbids connection-specific headers,
// causing Chrome to immediately drop the connection with ERR_HTTP2_PROTOCOL_ERROR.
// We MUST forcefully strip 'Connection' and 'Keep-Alive' right before Node writes headers.
const ORIG_WRITE_HEAD = http.ServerResponse.prototype.writeHead;
http.ServerResponse.prototype.writeHead = function (
  statusCode,
  statusMessage,
  headers,
) {
  this.removeHeader("Connection");
  this.removeHeader("connection");
  this.removeHeader("Keep-Alive");
  this.removeHeader("keep-alive");

  let headersObj = headers;
  let statusMsg = statusMessage;

  if (typeof statusMessage === "object") {
    headersObj = statusMessage;
    statusMsg = undefined;
  }

  if (headersObj) {
    if (Array.isArray(headersObj)) {
      for (let i = 0; i < headersObj.length; i++) {
        const key = headersObj[i][0];
        if (
          key &&
          (key.toLowerCase() === "connection" ||
            key.toLowerCase() === "keep-alive")
        ) {
          headersObj.splice(i, 1);
          i--;
        }
      }
    } else if (typeof headersObj === "object") {
      for (const k of Object.keys(headersObj)) {
        const lower = k.toLowerCase();
        if (lower === "connection" || lower === "keep-alive") {
          delete headersObj[k];
        }
      }
    }
  }

  const strip = (obj) => {
    if (!obj) return;
    for (const k of Object.getOwnPropertyNames(obj)) {
      const lower = k.toLowerCase();
      if (lower === "connection" || lower === "keep-alive") {
        delete obj[k];
      }
    }
  };
  strip(this._headers);
  const sym = Object.getOwnPropertySymbols(this).find(
    (s) => s.toString().includes("Headers") || s.toString().includes("headers"),
  );
  if (sym) strip(this[sym]);

  if (statusMsg) {
    return ORIG_WRITE_HEAD.call(this, statusCode, statusMsg, headersObj);
  } else {
    return ORIG_WRITE_HEAD.call(this, statusCode, headersObj);
  }
};

/* ---------------- UTILS ---------------- */
const boolEnv = (v) => {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
};

/* ---------------- BODY PARSERS & INPUT SANITIZATION ---------------- */
const bodyLimit = process.env.MAX_BODY_LIMIT || "10mb";
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));
app.use(sanitizeInput);

/* ---------------- RATE LIMITING ---------------- */
let apiLimiter;
function setupRateLimiter() {
  try {
    const redis = getRedis();
    if (!redis || redis.status !== "ready") throw new Error("Redis not ready");
    apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "TOO_MANY_REQUESTS",
        message: "Too many requests, please try again later",
      },
      skip: (req) => req.path === "/api/health" || req.path === "/api/ping",
      store: new RedisStore({
        sendCommand: (...args) => redis.call(...args),
        prefix: "rl:",
        windowMs: 60 * 1000,
      }),
    });
    console.log("[RateLimit] Using Redis store");
  } catch {
    apiLimiter = rateLimit({
      windowMs: 60 * 1000,
      max: 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "TOO_MANY_REQUESTS",
        message: "Too many requests, please try again later",
      },
      skip: (req) => req.path === "/api/health" || req.path === "/api/ping",
    });
    console.log("[RateLimit] Using in-memory store (Redis unavailable)");
  }
}
setupRateLimiter();
app.use("/api", apiLimiter);

/* SECURITY: Rate limiting for authentication endpoints */
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 60, // 60 attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "TOO_MANY_REQUESTS",
    message: "Too many authentication attempts, please try again later",
  },
});
app.use("/api/login", authLimiter);
app.use("/api/forgot-password", authLimiter);

app.head("/api/ping", (_req, res) => res.status(200).end());
app.get("/api/ping", (_req, res) => res.json({ ok: true }));

/* ---------------- DB ---------------- */
(async () => {
  try {
    const dbCheck = await testDbConnection({ silent: true });
    if (!dbCheck.ok) {
      throw dbCheck.error;
    }

    // Check if the column already exists
    const columns = await query(
      "SHOW COLUMNS FROM `fin_voucher_lines` LIKE 'payment_method'",
    );

    if (!columns || columns.length === 0) {
      console.log(
        "Adding `payment_method` column to `fin_voucher_lines` table...",
      );
      await query(
        "ALTER TABLE `fin_voucher_lines` ADD COLUMN `payment_method` VARCHAR(50) NULL DEFAULT NULL AFTER `cheque_date`",
      );
      console.log("Successfully added the `payment_method` column.");
    }

    // Check if created_by exists in fin_pdc_postings
    const pdcColumns = await query(
      "SHOW COLUMNS FROM `fin_pdc_postings` LIKE 'created_by'",
    );
    if (!pdcColumns || pdcColumns.length === 0) {
      console.log("Adding `created_by` column to `fin_pdc_postings` table...");
      await query(
        "ALTER TABLE `fin_pdc_postings` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_pdc_postings`.",
      );
    }

    // Migration for adm_license_renewals table fields (tax, subtotal, discount, tax_rate, payment_method)
    try {
      const renewTableCheck = await query(
        "SHOW TABLES LIKE 'adm_license_renewals'",
      );
      if (renewTableCheck && renewTableCheck.length > 0) {
        const taxCols = await query(
          "SHOW COLUMNS FROM `adm_license_renewals` LIKE 'tax'",
        );
        if (!taxCols || taxCols.length === 0) {
          await query(
            "ALTER TABLE `adm_license_renewals` ADD COLUMN `tax` DECIMAL(18,2) NOT NULL DEFAULT 0.00",
          );
        }
        const subtotalCols = await query(
          "SHOW COLUMNS FROM `adm_license_renewals` LIKE 'subtotal'",
        );
        if (!subtotalCols || subtotalCols.length === 0) {
          await query(
            "ALTER TABLE `adm_license_renewals` ADD COLUMN `subtotal` DECIMAL(18,2) NOT NULL DEFAULT 0.00",
          );
        }
        const discountCols = await query(
          "SHOW COLUMNS FROM `adm_license_renewals` LIKE 'discount'",
        );
        if (!discountCols || discountCols.length === 0) {
          await query(
            "ALTER TABLE `adm_license_renewals` ADD COLUMN `discount` DECIMAL(18,2) NOT NULL DEFAULT 0.00",
          );
        }
        const taxRateCols = await query(
          "SHOW COLUMNS FROM `adm_license_renewals` LIKE 'tax_rate'",
        );
        if (!taxRateCols || taxRateCols.length === 0) {
          await query(
            "ALTER TABLE `adm_license_renewals` ADD COLUMN `tax_rate` DECIMAL(18,2) NOT NULL DEFAULT 0.00",
          );
        }
        const payMethodCols = await query(
          "SHOW COLUMNS FROM `adm_license_renewals` LIKE 'payment_method'",
        );
        if (!payMethodCols || payMethodCols.length === 0) {
          await query(
            "ALTER TABLE `adm_license_renewals` ADD COLUMN `payment_method` VARCHAR(100) NULL DEFAULT NULL",
          );
        }
      }
    } catch (migErr) {
      console.warn(
        "[Migration] adm_license_renewals migration warning:",
        migErr.message,
      );
    }

    // Check if created_by exists in fin_vouchers
    const voucherColumns = await query(
      "SHOW COLUMNS FROM `fin_vouchers` LIKE 'created_by'",
    );
    if (!voucherColumns || voucherColumns.length === 0) {
      console.log("Adding `created_by` column to `fin_vouchers` table...");
      await query(
        "ALTER TABLE `fin_vouchers` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_vouchers`.",
      );
    }

    const salesOrderIsActiveColumns = await query(
      "SHOW COLUMNS FROM `sal_orders` LIKE 'is_active'",
    ).catch(() => []);
    if (!salesOrderIsActiveColumns || salesOrderIsActiveColumns.length === 0) {
      console.log("Adding `is_active` column to `sal_orders` table...");
      await query(
        "ALTER TABLE `sal_orders` ADD COLUMN `is_active` ENUM('Y','N') NOT NULL DEFAULT 'Y'",
      );
      console.log("Successfully added the `is_active` column to `sal_orders`.");
    }

    const salesOrderDeletedAtColumns = await query(
      "SHOW COLUMNS FROM `sal_orders` LIKE 'deleted_at'",
    ).catch(() => []);
    if (
      !salesOrderDeletedAtColumns ||
      salesOrderDeletedAtColumns.length === 0
    ) {
      console.log("Adding `deleted_at` column to `sal_orders` table...");
      await query(
        "ALTER TABLE `sal_orders` ADD COLUMN `deleted_at` DATETIME NULL",
      );
      console.log(
        "Successfully added the `deleted_at` column to `sal_orders`.",
      );
    }

    // Check if created_by exists in fin_voucher_reversals
    const reversalColumns = await query(
      "SHOW COLUMNS FROM `fin_voucher_reversals` LIKE 'created_by'",
    );
    if (!reversalColumns || reversalColumns.length === 0) {
      console.log(
        "Adding `created_by` column to `fin_voucher_reversals` table...",
      );
      await query(
        "ALTER TABLE `fin_voucher_reversals` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_voucher_reversals`.",
      );
    }

    // Check if created_by exists in fin_bank_reconciliations
    const reconColumns = await query(
      "SHOW COLUMNS FROM `fin_bank_reconciliations` LIKE 'created_by'",
    );
    if (!reconColumns || reconColumns.length === 0) {
      console.log(
        "Adding `created_by` column to `fin_bank_reconciliations` table...",
      );
      await query(
        "ALTER TABLE `fin_bank_reconciliations` ADD COLUMN `created_by` BIGINT UNSIGNED NULL DEFAULT NULL",
      );
      console.log(
        "Successfully added the `created_by` column to `fin_bank_reconciliations`.",
      );
    }

    try {
      await query(
        "ALTER TABLE `fin_account_groups` MODIFY COLUMN `code` VARCHAR(100) NOT NULL",
      );
    } catch (e) {
      console.warn(
        "Could not modify fin_account_groups code column: ",
        e.message,
      );
    }

    // Ensure HR Loan Type has account_id
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_setup_loan_types'");
      if (resp && resp.length > 0) {
        const loanTypeCols = await query(
          "SHOW COLUMNS FROM `hr_setup_loan_types` LIKE 'account_id'",
        );
        if (!loanTypeCols || loanTypeCols.length === 0) {
          console.log("Adding `account_id` column to `hr_setup_loan_types`...");
          await query(
            "ALTER TABLE `hr_setup_loan_types` ADD COLUMN `account_id` BIGINT UNSIGNED NULL DEFAULT NULL",
          );
        }
      }
    } catch (e) {
      console.warn(
        "Could not add account_id to hr_setup_loan_types: ",
        e.message,
      );
    }

    // Ensure HR Loans has amount_due, end_date and correct status type
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        const loanAmountDueCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'amount_due'",
        );
        if (!loanAmountDueCols || loanAmountDueCols.length === 0) {
          console.log("Adding `amount_due` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `amount_due` DECIMAL(18,4) NULL DEFAULT NULL",
          );
        }
        const loanEndDateCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'end_date'",
        );
        if (!loanEndDateCols || loanEndDateCols.length === 0) {
          console.log("Adding `end_date` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `end_date` DATE NULL DEFAULT NULL",
          );
        }
        const loanIdCols = await query(
          "SHOW COLUMNS FROM `hr_loans` LIKE 'loan_id'",
        );
        if (!loanIdCols || loanIdCols.length === 0) {
          console.log("Adding `loan_id` column to `hr_loans`...");
          await query(
            "ALTER TABLE `hr_loans` ADD COLUMN `loan_id` BIGINT UNSIGNED NULL DEFAULT NULL",
          );
        }

        // CRITICAL: Ensure status is VARCHAR to avoid ENUM errors with NEW 'ACTIVE' and 'COMPLETED' statuses
        await query(
          "ALTER TABLE `hr_loans` MODIFY COLUMN `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING'",
        );
      }
    } catch (e) {
      console.warn(
        "Could not add columns or modify status in hr_loans: ",
        e.message,
      );
    }

    // Update HR Loan Statuses
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        await query(
          "UPDATE hr_loans SET status = 'ACTIVE' WHERE status = 'REPAID'",
        );
        await query(
          "UPDATE hr_loans SET status = 'COMPLETED' WHERE status = 'DISBURSED'",
        );
      }
    } catch (e) {
      console.warn("Could not update hr_loans statuses: ", e.message);
    }

    // HR Loan Repayments Table
    try {
      await query(
        `CREATE TABLE IF NOT EXISTS hr_loan_repayments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          employee_id BIGINT UNSIGNED NOT NULL,
          loan_id BIGINT UNSIGNED NOT NULL,
          amount_paid DECIMAL(18,4) NOT NULL,
          payment_date DATE NOT NULL,
          payroll_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_loan (loan_id),
          KEY idx_employee (employee_id),
          KEY idx_payroll (payroll_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
    } catch (e) {
      console.warn("Could not create hr_loan_repayments table: ", e.message);
    }

    // Visitors Log Book Table
    try {
      await query(
        `CREATE TABLE IF NOT EXISTS svc_visitors_log (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          branch_id BIGINT UNSIGNED NOT NULL,
          visitor_name VARCHAR(255) NOT NULL,
          phone_number VARCHAR(50) NULL DEFAULT NULL,
          organisation VARCHAR(255) NULL DEFAULT NULL,
          department_visited VARCHAR(255) NULL DEFAULT NULL,
          temp_address VARCHAR(500) NULL DEFAULT NULL,
          time_in TIME NULL DEFAULT NULL,
          time_out TIME NULL DEFAULT NULL,
          visit_date DATE NOT NULL,
          purpose TEXT NULL DEFAULT NULL,
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          created_by BIGINT UNSIGNED NULL DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_company_branch (company_id, branch_id),
          KEY idx_visit_date (visit_date),
          KEY idx_status (status),
          KEY idx_department (department_visited)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      );
      console.log("svc_visitors_log table ensured");
    } catch (e) {
      console.warn("Could not create svc_visitors_log table: ", e.message);
    }

    // Add Triggers for hr_loans
    try {
      const resp = await query("SHOW TABLES LIKE 'hr_loans'");
      if (resp && resp.length > 0) {
        // Calculation Trigger (Insert)
        await query("DROP TRIGGER IF EXISTS `tg_hr_loans_before_insert`").catch(
          () => {},
        );
        await query(
          `CREATE TRIGGER \`tg_hr_loans_before_insert\` BEFORE INSERT ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.start_date IS NOT NULL THEN
               SET NEW.end_date = DATE_ADD(NEW.start_date, INTERVAL NEW.repayment_period_months MONTH);
               SET NEW.amount_due = GREATEST(0, NEW.amount - (NEW.monthly_installment * GREATEST(0, TIMESTAMPDIFF(MONTH, NEW.start_date, CURDATE()))));
             ELSE
               SET NEW.end_date = NULL;
               SET NEW.amount_due = NEW.amount;
             END IF;
           END`,
        );

        // Calculation Trigger (Update) - ONLY recalculate if amount_due is NOT being changed explicitly
        await query("DROP TRIGGER IF EXISTS `tg_hr_loans_before_update`").catch(
          () => {},
        );
        await query(
          `CREATE TRIGGER \`tg_hr_loans_before_update\` BEFORE UPDATE ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.start_date IS NOT NULL THEN
               SET NEW.end_date = DATE_ADD(NEW.start_date, INTERVAL NEW.repayment_period_months MONTH);
               -- Only recalculate balance if NOT explicitly changing amount_due (avoids conflict with payroll)
               IF NEW.amount_due = OLD.amount_due THEN
                 SET NEW.amount_due = GREATEST(0, NEW.amount - (NEW.monthly_installment * GREATEST(0, TIMESTAMPDIFF(MONTH, NEW.start_date, CURDATE()))));
               END IF;
             ELSE
               SET NEW.end_date = NULL;
               -- Only reset if not explicitly changing
               IF NEW.amount_due = OLD.amount_due THEN
                 SET NEW.amount_due = NEW.amount;
               END IF;
             END IF;
           END`,
        );

        // Approval Logic Trigger
        await query(
          "DROP TRIGGER IF EXISTS `trg_hr_loans_set_start_date`",
        ).catch(() => {});
        await query(
          `CREATE TRIGGER \`trg_hr_loans_set_start_date\` BEFORE UPDATE ON \`hr_loans\` FOR EACH ROW
           BEGIN
             IF NEW.status = 'APPROVED' AND OLD.status <> 'APPROVED' THEN
               IF NEW.start_date IS NULL THEN
                 SET NEW.start_date = DATE_ADD(CURDATE(), INTERVAL 1 MONTH);
               END IF;
             END IF;
           END`,
        );
      }
    } catch (e) {
      console.warn("Could not add triggers to hr_loans: ", e.message);
    }

    // Task 1: Remove constraints causing error in fin_pdc_postings
    try {
      // 1. Remove foreign key constraint fk_pdc_bank
      const fkConstraints = await query(
        `SELECT CONSTRAINT_NAME 
         FROM information_schema.KEY_COLUMN_USAGE 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'fin_pdc_postings' 
           AND CONSTRAINT_NAME = 'fk_pdc_bank'`,
      );
      if (fkConstraints && fkConstraints.length > 0) {
        console.log(
          "Dropping foreign key constraint `fk_pdc_bank` from `fin_pdc_postings`...",
        );
        await query(
          "ALTER TABLE `fin_pdc_postings` DROP FOREIGN KEY `fk_pdc_bank`",
        ).catch((e) => {
          console.warn("Could not drop foreign key: ", e.message);
        });
        console.log("Successfully dropped `fk_pdc_bank`.");
      }

      // 2. Remove unique index uq_pdc_unique
      const uniqueIndexes = await query(
        `SELECT INDEX_NAME 
         FROM information_schema.STATISTICS 
         WHERE TABLE_SCHEMA = DATABASE() 
           AND TABLE_NAME = 'fin_pdc_postings' 
           AND INDEX_NAME = 'uq_pdc_unique'`,
      );
      if (uniqueIndexes && uniqueIndexes.length > 0) {
        console.log(
          "Dropping unique index `uq_pdc_unique` from `fin_pdc_postings`...",
        );
        await query(
          "ALTER TABLE `fin_pdc_postings` DROP INDEX `uq_pdc_unique`",
        ).catch((e) => {
          console.warn("Could not drop unique index: ", e.message);
        });
        console.log("Successfully dropped `uq_pdc_unique`.");
      }
    } catch (e) {
      console.warn("Error checking for constraints: ", e.message);
    }
  } catch (err) {
    logDbError("Error during database initialization", err);
  }
})();

/* ---------------- ROUTES ---------------- */
if (boolEnv(process.env.DISABLE_KEEP_ALIVE)) {
  app.use((req, res, next) => {
    try {
      res.setHeader("Connection", "close");
    } catch {}
    next();
  });
}

/* --- Serve frontend static assets EARLY (before API routes) --- */
// This ensures /assets/*.js files are served with correct MIME types.
// Check multiple possible locations for the frontend build:
//   1. ../client/dist  (local development)
//   2. ./public        (production build via scripts/build.js)
//   3. cwd()/public    (Plesk/Passenger deployment)
const _staticOpts = {
  setHeaders: (res, filePath) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    if (filePath.endsWith(".js") || filePath.endsWith(".mjs")) {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else if (filePath.endsWith(".css")) {
      res.setHeader("Content-Type", "text/css; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    }
  },
};
const _frontendCandidates = [
  path.join(__dirname, "../client/dist"),
  path.join(process.cwd(), "client/dist"),
  path.join(__dirname, "dist"),
  path.join(process.cwd(), "dist"),
  path.join(__dirname, "../dist"),
  path.join(__dirname, "public"),
  path.join(process.cwd(), "public"),
  path.join(__dirname, "../public"),
  path.join(process.cwd(), "dist/public"),
  path.join(__dirname, "dist/public"),
];

let _earlyFrontendPath = null;
const _activeFrontendPaths = [];

for (const candidate of _frontendCandidates) {
  if (fs.existsSync(candidate)) {
    _activeFrontendPaths.push(candidate);
    app.use(express.static(candidate, _staticOpts));
    const assetsSubdir = path.join(candidate, "assets");
    if (fs.existsSync(assetsSubdir)) {
      app.use("/assets", express.static(assetsSubdir, _staticOpts));
    }
    if (
      !_earlyFrontendPath &&
      fs.existsSync(path.join(candidate, "index.html"))
    ) {
      _earlyFrontendPath = candidate;
    }
  }
}

if (_earlyFrontendPath) {
  console.log(
    `[STATIC] Serving primary frontend index.html from ${_earlyFrontendPath}`,
  );
  console.log(
    `[STATIC] Active asset directories: ${_activeFrontendPaths.join(", ")}`,
  );
} else {
  console.warn(
    `[STATIC] Frontend build not found. Checked: ${_frontendCandidates.join(", ")}`,
  );
}

// Clean handlers for common root asset requests to avoid crash logging or 404 loops
app.get(
  ["/sw.js", "/manifest.webmanifest", "/favicon.ico", "/robots.txt"],
  (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const fileName = req.path.replace(/^\//, "");
    for (const candidate of _activeFrontendPaths) {
      const filePath = path.join(candidate, fileName);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        if (fileName.endsWith(".js")) {
          res.setHeader(
            "Content-Type",
            "application/javascript; charset=utf-8",
          );
        } else if (fileName.endsWith(".webmanifest")) {
          res.setHeader(
            "Content-Type",
            "application/manifest+json; charset=utf-8",
          );
        }
        return res.sendFile(filePath);
      }
    }
    return res.status(204).end();
  },
);

app.use(
  "/uploads",
  express.static(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads"),
  ),
);
// Expose uploads also under /api/uploads so dev proxies can access files
app.use(
  "/api/uploads",
  express.static(
    path.join(path.dirname(fileURLToPath(import.meta.url)), "uploads"),
  ),
);
// SECURITY: Debug endpoints require authentication
app.get("/api/debug-crash-log", requireAuthMiddleware, (req, res) => {
  // SECURITY: Only allow admin users (ID 1) to access crash reports
  if (Number(req.user?.id) !== 1) {
    return res
      .status(403)
      .json({ error: "FORBIDDEN", message: "Admin access required" });
  }
  try {
    const p1 = path.join(process.cwd(), "crash_report.txt");
    const p2 = path.join(process.cwd(), "CRASH_REPORT.txt");
    const file = fs.existsSync(p1) ? p1 : fs.existsSync(p2) ? p2 : null;
    if (!file) {
      return res.status(404).send("No crash report file found.");
    }
    const content = fs.readFileSync(file, "utf8");
    res.setHeader("Content-Type", "text/plain");
    res.send(content);
  } catch (err) {
    res
      .status(500)
      .json({ error: "INTERNAL_ERROR", message: "Error reading crash report" });
  }
});

app.use("/api/service-management", serviceMgmtRoutes);
app.use("/api/srv-invoices", srvInvoicesRoutes);
app.use("/api/transport", transportRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/executive-overview", executiveRoutes);

app.use("/api/", healthRoutes);
app.use("/", healthRoutes);

app.use("/api", requireLicense);

const apiPaths = [
  { path: "/licenses", router: licenseRoutes },
  { path: "/subscription-plans", router: paymentPackageRoutes },
  { path: "/admin", router: adminRoutes },
  { path: "/administration", router: adminRoutes },
  { path: "/backups", router: backupRoutes },
  { path: "/workflows", router: workflowRoutes },
  { path: "/upload", router: uploadRoutes },
  { path: "/sales", router: salesRoutes },
  { path: "/purchase/bills", router: purchaseBillsRoutes },
  { path: "/purchase", router: purchaseRoutes },
  { path: "/inventory", router: inventoryRoutes },
  { path: "/finance", router: financeRoutes },
  { path: "/hr", router: hrRoutes },
  { path: "/maintenance", router: maintenanceRoutes },
  { path: "/projects", router: projectsRoutes },
  { path: "/production", router: productionRoutes },
  { path: "/pos", router: posRoutes },
  { path: "/bi", router: biRoutes },
  { path: "/service-management", router: serviceMgmtRoutes },
  { path: "/services", router: srvInvoicesRoutes },
  { path: "/transport", router: transportRoutes },
  { path: "/push", router: pushRoutes },
  { path: "/templates", router: templatesRoutes },
  { path: "/documents", router: documentsRoutes },
  { path: "/social-feed", router: socialFeedRoutes },
  { path: "/access", router: accessRoutes },
  { path: "/chat", router: chatRoutes },
  { path: "/ai", router: aiRoutes },
  { path: "/email-test", router: emailTestRoutes },
  { path: "/visitors", router: visitorsRoutes },
];

// Debug Endpoint to view production crash reports directly from the browser
app.get("/api/debug-status", async (req, res) => {
  try {
    const fs = await import("fs");
    const path = await import("path");
    let crashReport = "No crash report found.";
    const crashPath = path.join(process.cwd(), "CRASH_REPORT.txt");
    if (fs.existsSync(crashPath)) {
      crashReport = fs.readFileSync(crashPath, "utf8");
      if (crashReport.length > 10000) {
        crashReport = crashReport.slice(-10000);
      }
    }

    const dbHealth = await (
      await import("./db/pool.js")
    ).getDbHealth({ probe: true });
    const dbConfig = await (await import("./db/pool.js")).getDbConfig();

    res.json({
      ok: true,
      dbHealth,
      dbConfig,
      crashReport,
      nodeEnv: process.env.NODE_ENV,
      cwd: process.cwd(),
    });
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

apiPaths.forEach(({ path, router }) => {
  app.use(`/api${path}`, router);
  app.use(path, router);
});

app.use("/api", authRoutes);
app.use("/", authRoutes);

// Intercept Socket.io requests explicitly because Passenger intercepts the http.Server hook
app.use("/socket.io", (req, res, next) => {
  if (ioInstance && ioInstance.engine) {
    req.url = req.originalUrl; // Express strips the mount path, but engine.io needs it!
    ioInstance.engine.handleRequest(req, res);
  } else {
    // If socket.io is disabled, return 400 to tell the frontend client to stop polling
    res.status(400).json({ error: "Socket.io disabled by server" });
  }
});

/* ---------------- STATIC FILES & SPA FALLBACK ---------------- */
// Use the frontend path already discovered by the early static block above.
// Also allow SERVE_FRONTEND / ENABLE_SPA to force-enable SPA fallback even if
// the path was overridden by STATIC_DIR / PUBLIC_DIR env vars.

// Resolve override directory from env, if any
const _overrideDir =
  String(process.env.STATIC_DIR || process.env.PUBLIC_DIR || "").trim() || null;
let _spaFrontendPath = _earlyFrontendPath; // already discovered above
if (_overrideDir) {
  const abs = path.isAbsolute(_overrideDir)
    ? _overrideDir
    : path.join(process.cwd(), _overrideDir);
  if (fs.existsSync(path.join(abs, "index.html"))) {
    _spaFrontendPath = abs;
  }
}

if (_spaFrontendPath && serveFrontendFlag) {
  const frontendPath = _spaFrontendPath;
  for (const candidate of _activeFrontendPaths) {
    app.use(express.static(candidate, _staticOpts));
    const assetsSubdir = path.join(candidate, "assets");
    if (fs.existsSync(assetsSubdir)) {
      app.use("/assets", express.static(assetsSubdir, _staticOpts));
    }
  }

  app.get("*", (req, res, next) => {
    if (
      req.url.startsWith("/api") ||
      req.url.startsWith("/uploads") ||
      req.url.startsWith("/socket.io")
    ) {
      return next();
    }

    // Check if the requested path is a static asset file (.js, .css, .png, etc.)
    if (
      /\.(js|css|png|jpg|jpeg|gif|ico|json|svg|woff|woff2|ttf|map)$/i.test(
        req.path,
      )
    ) {
      // Try to find the file in any of our active static candidate directories
      const relativePath = req.path.replace(/^\//, "");
      for (const candidate of _activeFrontendPaths) {
        const pathsToTry = [
          path.join(candidate, relativePath),
          path.join(candidate, "assets", path.basename(relativePath)),
        ];
        for (const fullFilePath of pathsToTry) {
          if (
            fs.existsSync(fullFilePath) &&
            fs.statSync(fullFilePath).isFile()
          ) {
            res.setHeader("Access-Control-Allow-Origin", "*");
            if (fullFilePath.endsWith(".js") || fullFilePath.endsWith(".mjs")) {
              res.setHeader(
                "Content-Type",
                "application/javascript; charset=utf-8",
              );
            } else if (fullFilePath.endsWith(".css")) {
              res.setHeader("Content-Type", "text/css; charset=utf-8");
            }
            return res.sendFile(fullFilePath);
          }
        }
      }
      if (req.path.endsWith(".css")) {
        return res
          .status(404)
          .type("text/css")
          .send("/* 404 - CSS file not found */");
      }
      if (req.path.endsWith(".js") || req.path.endsWith(".mjs")) {
        return res
          .status(404)
          .type("application/javascript")
          .send("/* 404 - JS file not found */");
      }
      return res.status(404).type("text/plain").send("Static file not found");
    }

    if (frontendPath) {
      const indexPath = path.join(frontendPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.setHeader(
          "Cache-Control",
          "no-cache, no-store, must-revalidate, max-age=0",
        );
        res.setHeader("Pragma", "no-cache");
        res.setHeader("Expires", "0");
        return res.sendFile(indexPath);
      }
    }
    res.status(404).send("Frontend not built or index.html missing.");
  });
} else {
  app.get("/", (req, res) => {
    res.status(200).json({ status: "ok" });
  });
  // Explicitly block any non-API routes from rendering a SPA or static login
  app.get(/^\/(?!api\/|uploads\/|socket\.io\/).*/, (req, res) => {
    res.status(404).json({
      error: "Not Found",
      scope: "backend-api",
      path: req.path,
    });
  });
}

/* ---------------- ERRORS ---------------- */
app.use(notFound); // Handled by SPA catch-all now, or use for API 404s if desired
app.use(errorHandler);

const PORT = process.env.PORT || 4002;

// Create HTTP server for Socket.io
const server = http.createServer(app);
server.on("error", (err) => {
  logToCrashReport("SERVER_ERROR", err);
});
server.on("clientError", (err, socket) => {
  logToCrashReport("CLIENT_ERROR", err, {
    remoteAddress: socket?.remoteAddress || null,
    remotePort: socket?.remotePort || null,
  });
  // Do not write raw HTTP/1.1 strings to the socket, as this breaks HTTP/2 streams
  try {
    if (socket.writable) {
      socket.destroy();
    }
  } catch {}
});

// Timeouts to avoid ERR_CONNECTION_CLOSED in managed hosting and reverse proxies (Nginx / Passenger / Cloudflare)
try {
  const keepAliveMs = Number(process.env.KEEP_ALIVE_TIMEOUT_MS) || 65000;
  const headersMs = Number(process.env.HEADERS_TIMEOUT_MS) || 66000;
  const requestMs = process.env.REQUEST_TIMEOUT_MS
    ? Number(process.env.REQUEST_TIMEOUT_MS)
    : undefined;

  server.keepAliveTimeout = keepAliveMs;
  server.headersTimeout = headersMs;

  if (requestMs !== undefined && Number.isFinite(requestMs)) {
    server.requestTimeout = requestMs;
  }
} catch {}

// Initialize Socket.io
let ioInstance = null;
const socketsDisabled =
  boolEnv(process.env.DISABLE_SOCKETS) ||
  boolEnv(process.env.DISABLE_LONG_CONNECTIONS);
if (process.env.NODE_ENV !== "test" && !socketsDisabled) {
  ioInstance = initializeSocket(server);
} else {
  try {
    console.log(
      socketsDisabled
        ? "Socket.io disabled by environment"
        : "Skipping Socket.io in test environment",
    );
  } catch {}
}

// Export io for use in other modules
export { ioInstance as io };

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    initCronJobs();
    console.log(`Mailer configured: ${isMailerConfigured() ? "yes" : "no"}`);
    verifyMailer()
      .then((ok) => {
        console.log(`Mailer verified: ${ok ? "yes" : "no"}`);
      })
      .catch((error) => {
        console.error(
          `[Mailer] verification failed: ${error?.message || error}`,
        );
      });

    // ─── Background DB prewarm ──────────────────────────────────────────────
    // Run AFTER listen() so Passenger sees the server start immediately.
    // All ensure*() calls are no-ops for subsequent requests once this completes
    // because verifiedTables gets populated here.
    (async () => {
      try {
        const dbCheck = await testDbConnection({ silent: true });
        if (!dbCheck.ok) {
          console.warn("[Prewarm] DB not available, skipping DDL prewarm");
        } else {
          console.log("[Prewarm] Running background schema setup...");
          const steps = [
            ["pages table", () => ensurePagesTable()],
            ["user permissions table", () => ensureUserPermissionsTable()],
            [
              "user permission triggers",
              () => ensureUserPermissionCacheAndTriggers(),
            ],
            ["user branch mapping", () => ensureUserBranchMapping()],
            [
              "exceptional permissions",
              () => ensureExceptionalPermissionsTable(),
            ],
            ["system logs", () => ensureSystemLogsTable()],
            ["pm quotations", () => ensurePMQuotationTables()],
            ["pm invoices", () => ensurePMInvoiceTables()],
            ["social feed tables", () => ensureSocialFeedTables()],
            ["transport tables", () => ensureTransportTables()],
          ];
          for (const [name, fn] of steps) {
            try {
              await fn();
              console.log(`[Prewarm] ✓ ${name}`);
            } catch (e) {
              console.warn(`[Prewarm] ⚠ ${name}: ${e?.message || e}`);
            }
          }
          console.log("[Prewarm] Schema setup complete.");
        }
      } catch (e) {
        console.warn(`[Prewarm] Error: ${e?.message || e}`);
      }
    })();

    // ─── Legacy startup checks ──────────────────────────────────────────────
    (async () => {
      try {
        const dbCheck = await testDbConnection({ silent: true });
        if (!dbCheck.ok) {
          throw dbCheck.error;
        }
        try {
          await ensureExceptionalPermissionsTable();
        } catch {}
        try {
          await ensureSystemLogsTable();
        } catch {}
        try {
          await ensurePMQuotationTables();
        } catch {}
        try {
          await ensurePMInvoiceTables();
        } catch {}
        try {
          await seedDefaultTemplates();
        } catch {}
        try {
          const n = await ensureIndexes();
          if (n > 0) console.log(`Created ${n} missing database index(es)`);
        } catch {}
      } catch (e) {
        logDbError("Startup check failed", e);
      }
      try {
        const secret = process.env.JWT_SECRET || "";
        if (!secret) {
          console.log("JWT secret missing");
        }
      } catch {}
    })();
    // Automatic low-stock push + email scheduler (6:00 AM and 6:00 PM)
    const scheduledHours = [6, 18];
    const throttleHours = Number(
      process.env.LOW_STOCK_ALERT_THROTTLE_HOURS || 11,
    );
    async function runLowStockAlerts() {
      try {
        const branches = await query(
          `SELECT id, company_id FROM adm_branches WHERE is_active = 1 LIMIT 1000`,
        );
        for (const b of branches) {
          const companyId = Number(b.company_id);
          const branchId = Number(b.id);
          const items = await query(
            `
            SELECT 
              i.id, i.item_code, i.item_name, i.uom,
              COALESCE(sb.qty, 0) AS qty,
              COALESCE(i.reorder_level, 0) AS reorder_level
            FROM inv_items i
            LEFT JOIN (
              SELECT company_id, branch_id, item_id, SUM(qty) AS qty
              FROM inv_stock_balances
              GROUP BY company_id, branch_id, item_id
            ) sb
              ON sb.company_id = i.company_id
             AND sb.branch_id = :branchId
             AND sb.item_id = i.id
            WHERE i.company_id = :companyId
              AND COALESCE(i.reorder_level, 0) > 0
              AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
            ORDER BY qty ASC, i.item_name ASC
            LIMIT 100
            `,
            { companyId, branchId },
          );
          if (!items.length) continue;
          // Filter recipients by notification preferences (low-stock)
          if (!verifiedTables.has("adm_notification_prefs")) {
            await query(`
              CREATE TABLE IF NOT EXISTS adm_notification_prefs (
                user_id BIGINT UNSIGNED NOT NULL,
                pref_key VARCHAR(100) NOT NULL,
                push_enabled TINYINT(1) NOT NULL DEFAULT 0,
                email_enabled TINYINT(1) NOT NULL DEFAULT 0,
                sms_enabled TINYINT(1) NOT NULL DEFAULT 0,
                whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, pref_key),
                INDEX idx_pref_key (pref_key)
              ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            if (!(await hasColumn("adm_notification_prefs", "sms_enabled"))) {
              await query(
                "ALTER TABLE adm_notification_prefs ADD COLUMN sms_enabled TINYINT(1) NOT NULL DEFAULT 0",
              );
            }
            if (
              !(await hasColumn("adm_notification_prefs", "whatsapp_enabled"))
            ) {
              await query(
                "ALTER TABLE adm_notification_prefs ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0",
              );
            }
            verifiedTables.add("adm_notification_prefs");
          }
          const recipients = await query(
            `SELECT u.id, u.username, u.email, COALESCE(u.telephone, '') AS phone,
                    np.push_enabled, np.email_enabled, np.sms_enabled, np.whatsapp_enabled
             FROM adm_users u
             JOIN adm_notification_prefs np ON np.user_id = u.id AND np.pref_key = 'low-stock'
             WHERE u.is_active = 1 
               AND u.company_id = :companyId 
               AND u.branch_id = :branchId
               AND (np.push_enabled = 1 OR np.email_enabled = 1 OR np.sms_enabled = 1 OR np.whatsapp_enabled = 1)`,
            { companyId, branchId },
          );
          for (const u of recipients) {
            const recent = await query(
              `SELECT id FROM adm_system_logs 
               WHERE user_id = :userId 
                 AND action = 'low-stock-alert' 
                 AND event_time > DATE_SUB(NOW(), INTERVAL :throttle HOUR) 
               LIMIT 1`,
              { userId: u.id, throttle: throttleHours },
            );
            if (recent.length) continue;
            const count = items.length;
            const subject = `Low Stock Alert (${count} items)`;
            const lines = items
              .slice(0, 20)
              .map(
                (it) =>
                  `${it.item_code} ${it.item_name} — qty ${Number(
                    it.qty || 0,
                  )}, reorder ${Number(it.reorder_level || 0)}`,
              )
              .join("\n");
            const text = `${count} items are at or below reorder levels.\n\n${lines}\n\nOpen: /inventory/alerts/low-stock`;
            const htmlRows = items
              .slice(0, 20)
              .map(
                (it) =>
                  `<tr><td>${it.item_code}</td><td>${it.item_name}</td><td style="text-align:right">${Number(
                    it.qty || 0,
                  )}</td><td style="text-align:right">${Number(
                    it.reorder_level || 0,
                  )}</td></tr>`,
              )
              .join("");
            const html = `<p>${count} items are at or below reorder levels.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${htmlRows}</tbody></table><p><a href="/inventory/alerts/low-stock">Open Alerts</a></p>`;

            // Email Channel
            if (
              Number(u?.email_enabled) === 1 &&
              isMailerConfigured() &&
              u.email
            ) {
              try {
                await sendMail({
                  to: u.email,
                  subject,
                  text,
                  html,
                  meta: {
                    moduleName: "Inventory",
                    action: "EMAIL_SENT",
                    userId: u.id,
                    companyId,
                    branchId,
                    message: `Low stock alert email sent to ${u.email}`,
                    urlPath: "/inventory/alerts/low-stock",
                  },
                });
              } catch (e) {
                console.log(`[EMAIL ERROR] ${e?.message || e}`);
              }
            } else if (Number(u?.email_enabled) === 1) {
              console.log(
                `[MOCK ERROR] To: ${u.email || "(none)"} | Subject: ${subject}`,
              );
            }

            // SMS Channel
            if (Number(u?.sms_enabled) === 1 && u.phone) {
              try {
                const smsText = `Low Stock Alert: ${count} item${count === 1 ? "" : "s"} at/below reorder limit. Check ERP /inventory/alerts/low-stock`;
                await sendSMS({
                  to: u.phone,
                  message: smsText,
                });
              } catch (e) {
                console.log(`[SMS ERROR] ${e?.message || e}`);
              }
            }

            // WhatsApp Channel
            if (Number(u?.whatsapp_enabled) === 1 && u.phone) {
              try {
                const sampleLines = items
                  .slice(0, 5)
                  .map(
                    (it) =>
                      `• ${it.item_code} ${it.item_name}: ${Number(it.qty || 0)} left (reorder ${Number(it.reorder_level || 0)})`,
                  )
                  .join("\n");
                const waText = `⚠️ *Low Stock Alert*\n${count} items are at or below reorder levels.\n\n${sampleLines}${count > 5 ? `\n...and ${count - 5} more items` : ""}\n\nOpen ERP: /inventory/alerts/low-stock`;
                await sendWhatsApp({
                  to: u.phone,
                  message: waText,
                });
              } catch (e) {
                console.log(`[WHATSAPP ERROR] ${e?.message || e}`);
              }
            }

            // In-App Push Channel
            if (Number(u?.push_enabled) === 1) {
              await query(
                `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
                 VALUES (:companyId, :userId, :title, :message, :link, 0)`,
                {
                  companyId,
                  userId: u.id,
                  title: "Low Stock Alert",
                  message:
                    count <= 5
                      ? "Items are at or below reorder levels"
                      : `${count} items are at or below reorder levels`,
                  link: "/inventory/alerts/low-stock",
                },
              );
              try {
                await sendPushToUser(u.id, {
                  title: "Low Stock Alert",
                  message:
                    count <= 5
                      ? "Items are at or below reorder levels"
                      : `${count} items are at or below reorder levels`,
                  link: "/inventory/alerts/low-stock",
                  tag: "low-stock",
                });
              } catch {}
            }
            try {
              await query(
                `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, message, url_path, event_time)
                 VALUES (:companyId, :branchId, :userId, 'Inventory', 'low-stock-alert', :message, '/inventory/alerts/low-stock', NOW())`,
                {
                  companyId,
                  branchId,
                  userId: u.id,
                  message: `Low stock alerts processed (${count} items)`,
                },
              );
            } catch {}
          }
        }
      } catch (e) {
        console.log(`[LowStockScheduler] Error: ${e?.message || e}`);
      }
    }
    let lowStockRunInProgress = false;
    let lastLowStockSlotKey = "";
    async function runLowStockAlertsOnSchedule() {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();
      if (!scheduledHours.includes(hour) || minute !== 0) return;
      const y = String(now.getFullYear());
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      const h = String(hour).padStart(2, "0");
      const slotKey = `${y}-${m}-${d}-${h}`;
      if (lastLowStockSlotKey === slotKey || lowStockRunInProgress) return;
      lowStockRunInProgress = true;
      try {
        await runLowStockAlerts();
        lastLowStockSlotKey = slotKey;
        console.log(
          `[LowStockScheduler] Completed scheduled run at ${slotKey}:00`,
        );
      } finally {
        lowStockRunInProgress = false;
      }
    }
    // Use BullMQ for scheduled jobs (distributed, persistent), fallback to setInterval
    const bullQueue = getLowStockQueue(runLowStockAlertsOnSchedule);
    if (!bullQueue) {
      setInterval(() => {
        runLowStockAlertsOnSchedule().catch((e) =>
          console.log(
            `[LowStockScheduler] Schedule check failed: ${e?.message || e}`,
          ),
        );
      }, 30 * 1000);
      console.log("[LowStockScheduler] Using setInterval fallback");
    }
    runLowStockAlertsOnSchedule().catch((e) =>
      console.log(
        `[LowStockScheduler] Initial schedule check failed: ${e?.message || e}`,
      ),
    );
  }); // closes server.listen callback
} // closes if (process.env.NODE_ENV !== "test")

// ─── Graceful Shutdown ───────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
  console.log(`\n[Server] ${signal} received — shutting down gracefully...`);
  try {
    await closeJobQueues();
    await closeRedis();
    console.log("[Server] Redis and job queues closed");
  } catch {}
  process.exit(0);
}
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// ─── Prevent process crashes from unhandled errors ───────────────────────────
// Without these handlers, any unhandled Promise rejection or thrown exception
// will crash the entire Node.js server, causing ERR_CONNECTION_CLOSED for all
// in-flight requests. Log the error but keep the process running.
process.on("unhandledRejection", (reason, promise) => {
  const msg = reason instanceof Error ? reason.message : String(reason);
  const stack = reason instanceof Error ? reason.stack : "(no stack)";
  console.error(`[Process] Unhandled Promise Rejection: ${msg}`);
  console.error(stack);
  logToCrashReport("UnhandledRejection", reason);
});

process.on("uncaughtException", (err) => {
  console.error(`[Process] Uncaught Exception: ${err?.message || err}`);
  console.error(err?.stack || "(no stack)");
  logToCrashReport("UncaughtException", err);

  // If the server hasn't successfully bound to a port yet (e.g., module import failure),
  // we MUST exit. Otherwise Phusion Passenger will hang for 90 seconds.
  if (err?.code === "MODULE_NOT_FOUND" || !server.listening) {
    console.error("[Process] Fatal startup error, exiting.");
    process.exit(1);
  }

  // Only exit for truly fatal errors (memory corruption, etc.).
  // Do NOT exit for recoverable errors like DB timeouts.
  if (
    err &&
    (err.code === "ERR_WORKER_OUT_OF_MEMORY" ||
      err.code === "ERR_INVALID_HANDLE_STATE")
  ) {
    console.error("[Process] Fatal error, exiting.");
    logToCrashReport("FatalExit", "Process exiting due to fatal error");
    process.exit(1);
  }
});

export default app;
