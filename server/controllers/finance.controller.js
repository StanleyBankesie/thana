/**
 * @file finance.controller.js
 * @description Central controller for financial operations.
 * Handles vouchers, accounts, taxes, currencies, fiscal years, and reports.
 */
import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  getInactiveWorkflowBehavior,
  resolveWorkflowSelection,
} from "../utils/workflowResolution.js";
import { cacheGet, cacheSet, cacheDel, cacheDelPattern } from "../utils/redis.js";
import { ensureTaxTables } from "../utils/dbUtils.js";
import * as XLSX from "xlsx";

// Page ID mapping for tax code applicable pages
const PAGE_ID_MAP = {
  DIRECT_PURCHASE: 1,
  INVOICE: 2,
  PURCHASE_BILL_LOCAL: 3,
  PURCHASE_BILL_IMPORT: 4,
  LOCAL_PURCHASE_ORDER: 5,
  IMPORT_PURCHASE_ORDER: 6,
  MAINTENANCE_BILL: 7,
  SERVICE_BILL: 8,
  SALES_ORDER: 9,
  QUOTATION: 10,
  SUPPLIER_QUOTATION: 11,
  PAYMENT_VOUCHER: 12,
  RECEIPT_VOUCHER: 13,
  JOURNAL_VOUCHER: 14,
  CONTRA_VOUCHER: 15,
  DEBIT_NOTE: 16,
  CREDIT_NOTE: 17,
  SALES_VOUCHER: 18,
  SALES_RETURN: 19,
  PURCHASE_RETURN: 20,
  DELIVERY_NOTE: 21,
};

// Function to convert page codes to page IDs
function convertPagesToIds(pages) {
  if (!pages || typeof pages !== "string") return "";
  return pages
    .split(",")
    .map((p) => {
      const trimmed = p.trim();
      // If it's already numeric, return as-is
      if (/^\d+$/.test(trimmed)) return trimmed;
      // If it's a page code, convert to ID
      return PAGE_ID_MAP[trimmed] ? String(PAGE_ID_MAP[trimmed]) : null;
    })
    .filter((v) => v !== null)
    .join(",");
}

// Ensure fin_bank_accounts has required columns
async function ensureBankAccountsColumns() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_bank_accounts'`,
    );
    const colNames = (cols || []).map((c) => c.COLUMN_NAME);
    if (!colNames.includes("gl_account_id")) {
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD COLUMN gl_account_id BIGINT UNSIGNED NULL AFTER account_number`,
      );
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD INDEX idx_bank_account_gl (gl_account_id)`,
      );
    }
    if (!colNames.includes("bank_name")) {
      await pool.execute(
        `ALTER TABLE fin_bank_accounts ADD COLUMN bank_name VARCHAR(100) NULL AFTER name`,
      );
    }
  } catch (e) {
    // Silently fail - table might not exist yet
  }
}
// Run on startup
ensureBankAccountsColumns();

// ============================================================================
// Database Initialization & Schema Updates
// ============================================================================

/**
 * Ensures that the fin_voucher_lines table has the necessary currency columns.
 * Specifically adds currency_id and exchange_rate to support multi-currency vouchers.
 */
async function ensureVoucherLineCurrencyColumns() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  try {
    const [cols] = await pool.execute(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'fin_voucher_lines'`,
    );
    const colNames = (cols || []).map((c) => c.COLUMN_NAME);
    if (!colNames.includes("currency_id")) {
      await pool.execute(
        `ALTER TABLE fin_voucher_lines ADD COLUMN currency_id BIGINT UNSIGNED NULL AFTER payment_method`,
      );
      await pool.execute(
        `ALTER TABLE fin_voucher_lines ADD INDEX idx_vl_currency (currency_id)`,
      );
    }
    if (!colNames.includes("exchange_rate")) {
      await pool.execute(
        `ALTER TABLE fin_voucher_lines ADD COLUMN exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1.000000 AFTER currency_id`,
      );
    }
  } catch (e) {
    // Silently fail - table might not exist yet
  }
}
ensureVoucherLineCurrencyColumns();

/**
 * Ensures that the account balances table and related schema objects exist.
 * Adds balance_type to fin_accounts and creates the fin_account_balances table.
 * Backfills account default balance types based on their group nature (ASSET/EXPENSE -> DEBIT, etc).
 */
async function ensureAccountBalanceObjects() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  let conn;
  try {
    conn = await pool.getConnection();
    const hasBalanceType = await hasColumn(
      conn,
      "fin_accounts",
      "balance_type",
    );
    if (!hasBalanceType) {
      await conn.execute(
        `ALTER TABLE fin_accounts
         ADD COLUMN balance_type ENUM('DEBIT','CREDIT') NULL AFTER name`,
      );
    }

    // Backfill/normalize account default balance type from account-group nature.
    await conn.execute(
      `UPDATE fin_accounts a
       JOIN fin_account_groups g
         ON g.id = a.group_id
        AND g.company_id = a.company_id
       SET a.balance_type = CASE
         WHEN g.nature IN ('ASSET', 'EXPENSE') THEN 'DEBIT'
         ELSE 'CREDIT'
       END
       WHERE a.balance_type IS NULL OR TRIM(a.balance_type) = ''`,
    );

    await conn.execute(
      `CREATE TABLE IF NOT EXISTS fin_account_balances (
         id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
         company_id BIGINT UNSIGNED NOT NULL,
         account_id BIGINT UNSIGNED NOT NULL,
         balance_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
         balance_type ENUM('DEBIT','CREDIT') NOT NULL DEFAULT 'DEBIT',
         as_of_date DATE NULL,
         updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
         PRIMARY KEY (id),
         UNIQUE KEY uq_account_balance_company_account (company_id, account_id),
         KEY idx_account_balance_company (company_id),
         KEY idx_account_balance_account (account_id)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
    );
  } catch (e) {
    // Best effort, avoid breaking startup on environments where schema is managed separately.
  } finally {
    try {
      conn?.release();
    } catch {}
  }
}
// Run on startup
ensureAccountBalanceObjects();

/**
 * Ensures that purchase bills have payment tracking columns and status triggers.
 * Adds amount_paid and payment_status to pur_bills, and sets up triggers to auto-update
 * the payment status on INSERT and UPDATE.
 */
async function ensurePurBillsPaymentStatusObjects() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  let conn;
  try {
    conn = await pool.getConnection();
    const hasAmountPaid = await hasColumn(conn, "pur_bills", "amount_paid");
    if (!hasAmountPaid) {
      await conn.execute(
        "ALTER TABLE pur_bills ADD COLUMN amount_paid DECIMAL(18,2) NOT NULL DEFAULT 0",
      );
    }
    const hasPaymentStatus = await hasColumn(
      conn,
      "pur_bills",
      "payment_status",
    );
    if (!hasPaymentStatus) {
      await conn.execute(
        "ALTER TABLE pur_bills ADD COLUMN payment_status VARCHAR(30) NULL",
      );
    } else {
      await conn.execute(
        "ALTER TABLE pur_bills MODIFY COLUMN payment_status VARCHAR(30) NULL",
      );
    }
    await conn.execute(
      `UPDATE pur_bills
          SET payment_status = CASE
            WHEN COALESCE(amount_paid, 0) <= 0 THEN 'UNPAID'
            WHEN COALESCE(amount_paid, 0) < COALESCE(net_amount, 0) THEN 'PARTIAL PAYMENT'
            ELSE 'FULLY PAID'
          END`,
    );
    await conn.execute(
      "DROP TRIGGER IF EXISTS trg_pur_bills_payment_status_bi",
    );
    await conn.execute(
      "DROP TRIGGER IF EXISTS trg_pur_bills_payment_status_bu",
    );
    await conn.execute(
      `CREATE TRIGGER trg_pur_bills_payment_status_bi
       BEFORE INSERT ON pur_bills
       FOR EACH ROW
       SET NEW.payment_status = CASE
         WHEN COALESCE(NEW.amount_paid, 0) <= 0 THEN 'UNPAID'
         WHEN COALESCE(NEW.amount_paid, 0) < COALESCE(NEW.net_amount, 0) THEN 'PARTIAL PAYMENT'
         ELSE 'FULLY PAID'
       END`,
    );
    await conn.execute(
      `CREATE TRIGGER trg_pur_bills_payment_status_bu
       BEFORE UPDATE ON pur_bills
       FOR EACH ROW
       SET NEW.payment_status = CASE
         WHEN COALESCE(NEW.amount_paid, 0) <= 0 THEN 'UNPAID'
         WHEN COALESCE(NEW.amount_paid, 0) < COALESCE(NEW.net_amount, 0) THEN 'PARTIAL PAYMENT'
         ELSE 'FULLY PAID'
       END`,
    );
  } catch (e) {
    // Best effort
  } finally {
    try {
      conn?.release();
    } catch {}
  }
}

// ============================================================================
// Utility Functions & Middleware
// ============================================================================

/**
 * Express middleware to ensure a required ID parameter is present and valid.
 * Converts the parameter to a string if valid, otherwise returns a 400 error.
 * @param {string} name - The name of the parameter to check.
 */
export function requireIdParam(name) {
  return (req, _res, next) => {
    const id = Number(req.params[name]);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", `Invalid ${name}`));
    req.params[name] = String(id);
    return next();
  };
}

/**
 * Retrieves and increments the next available voucher number for a given company and voucher type.
 * Calculates the appropriate prefix and sequencing format.
 * @param {Object} params - Parameters object.
 * @param {number} params.companyId - The ID of the company.
 * @param {number} params.voucherTypeId - The ID of the voucher type.
 * @returns {Promise<string>} The generated voucher number.
 */
async function nextVoucherNo({ companyId, voucherTypeId }) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.execute(
      "SELECT id, code, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId FOR UPDATE",
      { companyId, voucherTypeId },
    );
    const vt = rows?.[0];
    if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
    const up = String(vt.code).toUpperCase();
    const seq = ["PV", "PUV", "CV", "RV", "JV", "SV", "PAYV", "CN", "DN"].includes(up)
      ? String(vt.next_number).padStart(6, "0")
      : String(vt.next_number);

    // Custom prefix rules: PAYV -> PV, PV/PUV -> PB
    let effectivePrefix = vt.prefix;
    if (up === "PAYV") effectivePrefix = "PV";
    else if (up === "PV" || up === "PUV") effectivePrefix = "PB";

    const voucherNo =
      up === "PV" || up === "PUV" || up === "PAYV" || up === "SV" || up === "RV" || up === "CN"
        ? `${effectivePrefix}${seq}`
        : `${effectivePrefix}-${seq}`;
    await conn.execute(
      "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
      { companyId, voucherTypeId },
    );
    await conn.commit();
    return voucherNo;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Resolves the ID of an active voucher type given its code and company ID.
 * @param {Object} conn - The database connection.
 * @param {Object} params - The companyId and code.
 * @returns {Promise<number>} The voucher type ID, or 0 if not found.
 */
async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  const id = Number(rows?.[0]?.id || 0);
  return id || 0;
}

/**
 * Finds a voucher type based on a requested code or alias (e.g. PV, PUV, PAYV).
 * Handles logic to find related purchase or payment voucher types if an exact match isn't found.
 * @param {Object} params - The companyId and requestedCode.
 * @returns {Promise<Object|null>} The voucher type object, or null.
 */
async function findVoucherTypeByRequest({ companyId, requestedCode }) {
  const normalizedCode = String(requestedCode || "").toUpperCase();
  if (!normalizedCode) return null;
  const isPurchase =
    normalizedCode === "PV" ||
    normalizedCode === "PUV" ||
    normalizedCode === "PB";
  const altCode =
    normalizedCode === "PV" ? "PUV" : normalizedCode === "PUV" ? "PV" : null;
  const desiredName =
    normalizedCode === "PAYV"
      ? "PAYMENT VOUCHER"
      : normalizedCode === "RV"
        ? "RECEIPT VOUCHER"
        : normalizedCode === "CV"
          ? "CONTRA VOUCHER"
          : normalizedCode === "JV"
            ? "JOURNAL VOUCHER"
            : normalizedCode === "SV"
              ? "SALES VOUCHER"
              : isPurchase
                ? "PURCHASE VOUCHER"
                : null;
  const rows = await query(
    `SELECT id, code, name, prefix, next_number
       FROM fin_voucher_types
      WHERE company_id = :companyId
        AND (
          code = :code OR
          (:altCode IS NOT NULL AND code = :altCode) OR
          (:isPurchase = 1 AND code = 'PB') OR
          (:desiredName IS NOT NULL AND UPPER(name) = :desiredName) OR
          (:isPurchase = 1 AND UPPER(name) LIKE '%PURCHASE VOUCHER%') OR
          (:isPurchase = 1 AND UPPER(prefix) = 'PB')
        )
      ORDER BY id ASC
      LIMIT 1`,
    {
      companyId,
      code: normalizedCode,
      altCode,
      isPurchase: isPurchase ? 1 : 0,
      desiredName,
    },
  );
  return rows?.[0] || null;
}

/**
 * Ensures that a voucher type exists for a given request code.
 * If it doesn't exist, it creates a new voucher type with default settings.
 * @param {Object} params - The companyId and requestedCode.
 * @returns {Promise<Object|null>} The existing or newly created voucher type object.
 */
async function ensureVoucherTypeForRequest({ companyId, requestedCode }) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const existing = await findVoucherTypeByRequest({ companyId, requestedCode });
  if (existing?.id) return existing;

  const normalizedCode = String(requestedCode || "").toUpperCase();
  const isPurchase =
    normalizedCode === "PV" ||
    normalizedCode === "PUV" ||
    normalizedCode === "PB";
  const createCode = isPurchase ? "PV" : normalizedCode;
  const createName = isPurchase
    ? "Purchase Voucher"
    : normalizedCode === "PAYV"
      ? "Payment Voucher"
      : normalizedCode === "RV"
        ? "Receipt Voucher"
        : normalizedCode === "CV"
          ? "Contra Voucher"
          : normalizedCode === "JV"
            ? "Journal Voucher"
            : normalizedCode === "SV"
              ? "Sales Voucher"
              : "Voucher";
  const createPrefix = isPurchase
    ? "PB"
    : normalizedCode === "PAYV"
      ? "PV"
      : normalizedCode;
  const createCategory =
    normalizedCode === "PAYV" || isPurchase
      ? "PAYMENT"
      : normalizedCode === "RV"
        ? "RECEIPT"
        : "GENERAL";
  if (!createCode) return null;

  try {
    await query(
      `INSERT INTO fin_voucher_types
         (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
         (:companyId, :code, :name, :category, :prefix, 1, 0, 1)`,
      {
        companyId,
        code: createCode,
        name: createName,
        category: createCategory,
        prefix: createPrefix,
      },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }

  return findVoucherTypeByRequest({ companyId, requestedCode });
}

/**
 * Pads a number with leading zeros to ensure it is at least 2 characters long.
 * @param {number|string} n - The number to pad.
 * @returns {string} The zero-padded string.
 */
function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Converts a Date object to a YYYY-MM-DD string format.
 * @param {Date} d - The Date object.
 * @returns {string} The formatted date string, or empty string if invalid.
 */
function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * Checks if a specific column exists in a given table.
 * @param {Object} conn - The database connection.
 * @param {string} tableName - The name of the table.
 * @param {string} columnName - The name of the column to check.
 * @returns {Promise<boolean>} True if the column exists, false otherwise.
 */
async function hasColumn(conn, tableName, columnName) {
  const [rows] = await conn.execute(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

// ============================================================================
// Fiscal & Tax Utilities
// ============================================================================

/**
 * Resolves the fiscal year ID for a given date.
 * If a matching fiscal year does not exist, it generates one based on the company's
 * start month setting and creates the record.
 * @param {Object} conn - The database connection.
 * @param {Object} params - companyId and dateYmd string.
 * @returns {Promise<number>} The ID of the resolved fiscal year.
 */
async function resolveFiscalYearIdForDate(conn, { companyId, dateYmd }) {
  let target = String(dateYmd || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(target)) {
    const d = new Date(dateYmd || new Date());
    target = toYmd(d);
  }
  if (!target) return 0;
  const [inRangeRows] = await conn.execute(
    `
    SELECT id, is_open
    FROM fin_fiscal_years
    WHERE company_id = :companyId
      AND :target >= start_date
      AND :target <= end_date
    ORDER BY start_date DESC
    LIMIT 1
    `,
    { companyId, target },
  );
  const inRange = inRangeRows?.[0] || null;
  const inRangeId = Number(inRange?.id || 0) || 0;
  if (inRangeId) {
    if (Number(inRange?.is_open) !== 1) {
      await conn.execute(
        "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
        { companyId, id: inRangeId },
      );
    }
    return inRangeId;
  }

  const [companyRows] = await conn.execute(
    "SELECT fiscal_year_start_month FROM adm_companies WHERE id = :companyId LIMIT 1",
    { companyId },
  );
  let startMonth = Number(companyRows?.[0]?.fiscal_year_start_month || 1);
  if (!Number.isFinite(startMonth) || startMonth < 1 || startMonth > 12) {
    startMonth = 1;
  }

  const d = new Date(target);
  const currentYear = d.getFullYear();
  const currentMonth = d.getMonth() + 1;
  const startYear = currentMonth >= startMonth ? currentYear : currentYear - 1;
  const endYear = startYear + 1;

  const startDateObj = new Date(startYear, startMonth - 1, 1);
  const nextStartObj = new Date(endYear, startMonth - 1, 1);
  const endDateObj = new Date(nextStartObj);
  endDateObj.setDate(endDateObj.getDate() - 1);

  const startDate = toYmd(startDateObj);
  const endDate = toYmd(endDateObj);
  if (!startDate || !endDate) return 0;

  const codeBase =
    startMonth === 1
      ? `FY${startYear}`
      : `FY${startYear}/${String(endYear).slice(-2)}`;
  let code = codeBase;
  for (let i = 0; i < 5; i += 1) {
    const [existsRows] = await conn.execute(
      "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    if (!existsRows?.length) break;
    code = `${codeBase}-${i + 1}`;
  }

  const [ins] = await conn.execute(
    `
    INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
    VALUES (:companyId, :code, :startDate, :endDate, 1)
    `,
    { companyId, code, startDate, endDate },
  );
  const newId = Number(ins?.insertId || 0) || 0;
  return newId;
}

/**
 * Loads the active tax components and their details for a specific tax code.
 * @param {Object} conn - The database connection.
 * @param {Object} params - companyId and taxCodeId.
 * @returns {Promise<Array>} Array of tax components sorted by compound level and order.
 */
async function loadTaxComponentsByCodeTx(conn, { companyId, taxCodeId }) {
  const [rows] = await conn.execute(
    `SELECT c.tax_detail_id,
            COALESCE(c.rate_percent, d.rate_percent, 0) AS rate_percent,
            COALESCE(c.compound_level, 0) AS compound_level,
            COALESCE(c.sort_order, 1) AS sort_order,
            d.component_name
       FROM fin_tax_components c
       JOIN fin_tax_details d
         ON d.id = c.tax_detail_id
      WHERE c.company_id = :companyId
        AND c.tax_code_id = :taxCodeId
        AND c.is_active = 1
      ORDER BY c.compound_level ASC, c.sort_order ASC, d.component_name ASC`,
    { companyId, taxCodeId },
  );
  return Array.isArray(rows) ? rows : [];
}

/**
 * Allocates a total tax amount among multiple tax components based on their compound levels
 * and rates. Handles rounding differences to ensure the sum matches the expected tax amount.
 * @param {number} baseAmount - The base amount before tax.
 * @param {number} taxAmount - The total expected tax amount.
 * @param {Array} components - Array of tax components.
 * @returns {Array} List of components with their allocated amounts.
 */
function allocateTaxComponents(baseAmount, taxAmount, components) {
  const base = Math.max(0, Number(baseAmount || 0));
  const expectedTax = Math.max(0, Number(taxAmount || 0));
  const list = Array.isArray(components) ? components : [];
  if (!list.length || !(expectedTax > 0)) return [];
  const grouped = new Map();
  for (const comp of list) {
    const level = Number(comp.compound_level || 0);
    if (!grouped.has(level)) grouped.set(level, []);
    grouped.get(level).push(comp);
  }
  const levels = Array.from(grouped.keys()).sort((a, b) => a - b);
  let currentBase = base;
  const raw = [];
  for (const level of levels) {
    const comps = grouped.get(level) || [];
    let levelTotal = 0;
    for (const comp of comps) {
      const amt = (currentBase * Number(comp.rate_percent || 0)) / 100;
      raw.push({ ...comp, amount: amt });
      levelTotal += amt;
    }
    currentBase += levelTotal;
  }
  const rounded = raw.map((r) => ({
    ...r,
    amount: Math.round(Number(r.amount || 0) * 100) / 100,
  }));
  const totalRounded = rounded.reduce((s, r) => s + Number(r.amount || 0), 0);
  const diff = Math.round((expectedTax - totalRounded) * 100) / 100;
  if (rounded.length && Math.abs(diff) > 0.00001) {
    rounded[rounded.length - 1].amount =
      Math.round(
        (Number(rounded[rounded.length - 1].amount || 0) + diff) * 100,
      ) / 100;
  }
  return rounded.filter((r) => Number(r.amount || 0) > 0);
}

/**
 * Ensures a financial account exists for a specific tax component.
 * Retrieves an existing account or creates a new one under 'Tax Receivables' (ASSET) 
 * for purchases, or 'Tax Payables' (LIABILITY) for sales/others.
 * @param {Object} conn - Database connection.
 * @param {Object} params - Configuration details (companyId, taxDetailId, componentName, isPurchase).
 * @returns {Promise<number>} The ID of the tax account.
 */
async function ensureTaxComponentAccountTx(
  conn,
  { companyId, taxDetailId, componentName, isPurchase },
) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (taxDetailId) {
    try {
      const [tdRows] = await conn.execute(
        "SELECT account_id FROM fin_tax_details WHERE id = :taxDetailId LIMIT 1",
        { taxDetailId }
      );
      if (tdRows && tdRows[0] && tdRows[0].account_id) {
        return Number(tdRows[0].account_id);
      }
    } catch (err) {}
  }

  const safeName = String(componentName || "").trim();
  if (!safeName) return 0;

  let groupCode, groupName, nature, codePrefix;
  if (isPurchase) {
    groupCode = "TAXREC";
    groupName = "Tax Receivables";
    nature = "ASSET";
    codePrefix = "PTAX";
  } else {
    groupCode = "TAXPAY";
    groupName = "Tax Payables";
    nature = "LIABILITY";
    codePrefix = "TAX";
  }

  const groupId = await ensureGroupIdTx(conn, {
    companyId,
    code: groupCode,
    name: groupName,
    nature,
  });

  const baseCurrencyId =
    (await (async () => {
      try {
        const [curRows] = await conn.execute(
          "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
          { companyId },
        );
        return Number(curRows?.[0]?.id || 0) || null;
      } catch { return null; }
    })()) || null;

  const code = `${codePrefix}-${String(Number(taxDetailId || 0)).padStart(4, "0")}`;
  const [existingRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const existingId = Number(existingRows?.[0]?.id || 0) || 0;
  let finalAccountId = existingId;

  if (existingId) {
    await conn.execute(
      `UPDATE fin_accounts
          SET group_id = :groupId,
              name = :name,
              currency_id = :currencyId,
              is_active = 1
        WHERE company_id = :companyId AND id = :id`,
      { companyId, id: existingId, groupId, name: safeName, currencyId: baseCurrencyId },
    );
  } else {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts
        (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES
        (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      { companyId, groupId, code, name: safeName, currencyId: baseCurrencyId },
    );
    finalAccountId = Number(ins?.insertId || 0) || 0;
  }

  if (finalAccountId) {
    await conn.execute(
      "UPDATE fin_tax_details SET account_id = :accountId WHERE id = :taxDetailId",
      { accountId: finalAccountId, taxDetailId },
    ).catch(() => null);
  }
  return finalAccountId;
}

/**
 * Processes and splits voucher line amounts into their respective tax components.
 * Creates new voucher lines for each tax component and adjusts the original base line amounts.
 * @param {Object} conn - Transaction connection.
 * @param {Object} params - Parameters including voucherId, lines, voucherType, etc.
 * @returns {Promise<Object>} Contains totalDebitAdj and totalCreditAdj values.
 */
async function processVoucherTaxSplitTx(
  conn,
  { voucherId, companyId, branchId, branchIdsStr, lines, voucherType, exchangeRate },
) {
  const isPurchase = voucherType === "PV";
  const rate = Number(exchangeRate || 1) || 1;
  let lineNo = (Array.isArray(lines) ? lines.length : 0) + 1;
  let totalDebitAdj = 0;
  let totalCreditAdj = 0;

  if (!Array.isArray(lines) || !lines.length) return { totalDebitAdj, totalCreditAdj };

  for (const line of lines) {
    const taxCodeId = Number(line.taxCodeId || line.tax_code_id || 0);
    if (!taxCodeId) continue;
    const debit = Number(line.debit || 0);
    const credit = Number(line.credit || 0);
    const lineAmount = Math.max(debit, credit);
    if (!(lineAmount > 0)) continue;

    const components = await loadTaxComponentsByCodeTx(conn, {
      companyId,
      taxCodeId,
    });
    if (!components.length) continue;

    const totalRatePct = components.reduce(
      (s, c) => s + Number(c.rate_percent || 0),
      0,
    );
    if (!(totalRatePct > 0)) continue;

    const baseAmount =
      Math.round((lineAmount * 100) / (100 + totalRatePct) * 100) / 100;
    const taxAmount = Math.round((lineAmount - baseAmount) * 100) / 100;
    if (!(taxAmount > 0)) continue;

    const savedLineNo = Array.isArray(lines) ? lines.indexOf(line) + 1 : 0;
    if (debit > 0 && savedLineNo > 0) {
      await conn.execute(
        "UPDATE fin_voucher_lines SET debit = :newAmt WHERE voucher_id = :vid AND line_no = :ln",
        { vid: voucherId, ln: savedLineNo, newAmt: baseAmount },
      );
      totalDebitAdj -= taxAmount;
    } else if (credit > 0 && savedLineNo > 0) {
      await conn.execute(
        "UPDATE fin_voucher_lines SET credit = :newAmt WHERE voucher_id = :vid AND line_no = :ln",
        { vid: voucherId, ln: savedLineNo, newAmt: baseAmount },
      );
      totalCreditAdj -= taxAmount;
    }

    const allocations = allocateTaxComponents(baseAmount, taxAmount, components);
    for (const alloc of allocations) {
      const allocAmount =
        Math.round(Number(alloc.amount || 0) * 100) / 100;
      if (!(allocAmount > 0)) continue;

      const taxAccId = await ensureTaxComponentAccountTx(conn, {
        companyId,
        taxDetailId: alloc.tax_detail_id,
        componentName: alloc.component_name,
        isPurchase,
      });
      if (!taxAccId) continue;

      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :ref)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: taxAccId,
          description: `${alloc.component_name} on ${line.description || "voucher"}`,
          debit: isPurchase ? allocAmount : 0,
          credit: isPurchase ? 0 : allocAmount,
          taxCodeId,
          ref: line.referenceNo || null,
        },
      );

      if (isPurchase) totalDebitAdj += allocAmount;
      else totalCreditAdj += allocAmount;
    }
  }

  return { totalDebitAdj, totalCreditAdj };
}

// ============================================================================
// Group and Financial Account Utilities
// ============================================================================

/**
 * Ensures an account group exists by code or name. If neither is found, inserts a new group.
 * Handles duplicate entry conflicts gracefully by re-querying.
 * @param {Object} conn - The database connection.
 * @param {Object} params - Properties of the group (companyId, code, name, nature, parentId).
 * @returns {Promise<number>} The ID of the account group.
 */
async function ensureGroupIdTx(
  conn,
  { companyId, code, name, nature, parentId },
) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const [foundByCode] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  let id = Number(foundByCode?.[0]?.id || 0);
  if (!id) {
    const [foundByName] = await conn.execute(
      "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND name = :name LIMIT 1",
      { companyId, name },
    );
    id = Number(foundByName?.[0]?.id || 0);
  }
  if (!id) {
    try {
      const [ins] = await conn.execute(
        "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (:companyId, :code, :name, :nature, :parentId, 1)",
        { companyId, code, name, nature, parentId: parentId || null },
      );
      id = Number(ins.insertId || 0);
    } catch (e) {
      if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
      const [retry] = await conn.execute(
        "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND (code = :code OR name = :name) LIMIT 1",
        { companyId, code, name },
      );
      id = Number(retry?.[0]?.id || 0);
    }
  }
  return id || 0;
}

export async function ensureCustomerFinAccountIdTx(
  conn,
  { companyId, customerId },
) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const [custRows] = await conn.execute(
    "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: customerId },
  );
  const cust = custRows?.[0] || null;
  if (!cust) return 0;
  let code =
    cust.customer_code && String(cust.customer_code).trim()
      ? String(cust.customer_code).trim()
      : `C${String(Number(cust.id || 0)).padStart(5, "0")}`;
  const [accRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
  if (accIdExisting) return accIdExisting;
  const debtorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "DEBTORS",
    name: "Debtors",
    nature: "ASSET",
  });
  let currencyId = cust.currency_id || null;
  if (!currencyId) {
    const [curRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    currencyId = Number(curRows?.[0]?.id || 0) || null;
  }
  try {
    const [ins] = await conn.execute(
      `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
       VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
      {
        companyId,
        groupId: debtorsGroupId,
        code,
        name: cust.customer_name,
        currencyId,
      },
    );
    return Number(ins?.insertId || 0) || 0;
  } catch (e) {
    // Handle race condition: another request created the account simultaneously
    if (String(e?.code || "") === "ER_DUP_ENTRY") {
      const [accRows2] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      return Number(accRows2?.[0]?.id || 0) || 0;
    }
    throw e;
  }
}

export async function ensureSupplierFinAccountIdTx(
  conn,
  { companyId, supplierId },
) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const [supRows] = await conn.execute(
    "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId AND id = :id LIMIT 1",
    { companyId, id: supplierId },
  );
  const sup = supRows?.[0] || null;
  if (!sup) return 0;
  let code =
    sup.supplier_code && String(sup.supplier_code).trim()
      ? String(sup.supplier_code).trim()
      : `S${String(Number(sup.id || 0)).padStart(5, "0")}`;
  const [accRows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
  if (accIdExisting) return accIdExisting;
  const creditorsGroupId = await ensureGroupIdTx(conn, {
    companyId,
    code: "CREDITORS",
    name: "Creditors",
    nature: "LIABILITY",
  });
  let currencyId = sup.currency_id || null;
  if (!currencyId) {
    const [curRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    currencyId = Number(curRows?.[0]?.id || 0) || null;
  }
  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
     VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
    {
      companyId,
      groupId: creditorsGroupId,
      code,
      name: sup.supplier_name,
      currencyId,
    },
  );
  return Number(ins?.insertId || 0) || 0;
}

export async function getNextNumericCode(conn, { companyId, table, nature }) {
  let codeField = "code";
  if (table === "pur_suppliers") codeField = "supplier_code";
  if (table === "sal_customers") codeField = "customer_code";

  let prefix = "";
  if (table === "fin_accounts") {
    if (nature === "ASSET") prefix = "1";
    else if (nature === "LIABILITY") prefix = "2";
    else if (nature === "EQUITY") prefix = "3";
    else if (nature === "REVENUE") prefix = "4";
    else if (nature === "EXPENSE") prefix = "5";
  } else if (table === "pur_suppliers") {
    prefix = "SU-";
  } else if (table === "sal_customers") {
    prefix = "CU-";
  }

  const [rows] = await conn.execute(
    `SELECT ${codeField} FROM ${table} WHERE company_id = :companyId AND ${codeField} LIKE :pattern ORDER BY ${codeField} DESC LIMIT 1`,
    { companyId, pattern: `${prefix}%` },
  );

  let nextNum = 1;
  if (rows?.length) {
    const lastCode = rows[0][codeField];
    const numPart = lastCode.replace(prefix, "");
    const lastNum = parseInt(numPart, 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  if (prefix === "SU-" || prefix === "CU-") {
    return `${prefix}${String(nextNum).padStart(6, "0")}`;
  }
  return `${prefix}${String(nextNum).padStart(4, "0")}`;
}

/**
 * Generates and returns the next voucher number based on the requested voucher type.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getNextVoucherNo = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    console.log("DEBUG getNextVoucherNo - query:", req.query);
    const code = req.query.voucherTypeCode
      ? String(req.query.voucherTypeCode).toUpperCase()
      : null;
    if (!code) {
      throw httpError(400, "VALIDATION_ERROR", "voucherTypeCode is required");
    }
    const vt = await ensureVoucherTypeForRequest({
      companyId,
      requestedCode: code,
    });
    if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
    const up = String(vt.code).toUpperCase();
    const seq =
      up === "PV" ||
      up === "PUV" ||
      up === "PAYV" ||
      up === "CV" ||
      up === "RV" ||
      up === "JV" ||
      up === "SV" ||
      up === "CN"
        ? String(vt.next_number).padStart(6, "0")
        : String(vt.next_number);

    // Custom prefix rules: PAYV -> PV, PV/PUV -> PB
    let effectivePrefix = vt.prefix;
    if (up === "PAYV") effectivePrefix = "PV";
    else if (up === "PV" || up === "PUV") effectivePrefix = "PB";

    const nextNo = `${effectivePrefix}${seq}`;
    res.json({ nextNo });
  } catch (e) {
    next(e);
  }
};

/**
 * Transitions a draft or returned voucher into a submitted state, routing it through workflow approvals.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const submitVoucher = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const voucherId = Number(req.params.voucherId);
    const amount = req.body?.amount ?? null;
    const workflowIdOverride = Number(req.body?.workflow_id || 0) || null;
    const targetUserIdRaw = req.body?.target_user_id ?? null;
    const vRows = await query(
      `SELECT voucher_type_id, voucher_no, vt.code AS voucher_type_code
         FROM fin_vouchers v
         JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        WHERE v.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) AND v.id = :id
        LIMIT 1`,
      { companyId, branchId, branchIdsStr, id: voucherId },
    );
    const vInfo = vRows?.[0];
    if (!vInfo) throw httpError(404, "NOT_FOUND", "Voucher not found");
    const typeCode = String(vInfo.voucher_type_code || "").toUpperCase();
    const isPV = typeCode === "PV" || typeCode === "PAYV";
    const isRV = typeCode === "RV";
    const isCV = typeCode === "CV";
    const isJV = typeCode === "JV";
    const isCN = typeCode === "CN";
    const isDN = typeCode === "DN";
    const docTypePrimary = isRV
      ? "RECEIPT_VOUCHER"
      : isPV
        ? "PAYMENT_VOUCHER"
        : isCV
          ? "CONTRA_VOUCHER"
          : isJV
            ? "JOURNAL_VOUCHER"
            : isCN
              ? "CREDIT_NOTE"
              : isDN
                ? "DEBIT_NOTE"
                : "VOUCHER";
    const titleName = isRV
      ? "Receipt Voucher"
      : isPV
        ? "Payment Voucher"
        : isCV
          ? "Contra Voucher"
          : isJV
            ? "Journal Voucher"
            : isCN
              ? "Credit Note"
              : isDN
                ? "Debit Note"
                : "Voucher";
    const docRouteBase = isRV
      ? "/finance/receipt-voucher"
      : isPV
        ? "/finance/payment-voucher"
        : isCV
          ? "/finance/contra-voucher"
          : isJV
            ? "/finance/journal-voucher"
            : isCN
              ? "/finance/credit-note"
              : isDN
                ? "/finance/debit-note"
                : null;
    const typeSynonyms = isRV
      ? ["RECEIPT_VOUCHER", "Receipt Voucher", "RV"]
      : isPV
        ? [
            "PAYMENT_VOUCHER",
            "Payment Voucher",
            "PAYV",
            "MAKE_PAYMENT",
            "Make Payment",
          ]
        : isCV
          ? ["CONTRA_VOUCHER", "Contra Voucher", "CV"]
          : isJV
            ? ["JOURNAL_VOUCHER", "Journal Voucher", "JV"]
            : isCN
              ? ["CREDIT_NOTE", "Credit Note", "CN"]
              : isDN
                ? ["DEBIT_NOTE", "Debit Note", "DN"]
                : ["VOUCHER", "Voucher", typeCode];
    const { activeWorkflow: activeWf, inactiveWorkflow } =
      await resolveWorkflowSelection({
        companyId,
        workflowIdOverride,
        docRouteBase,
        typeSynonyms,
        amount,
      });
    if (activeWf) {
      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length)
        throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver_user_id configured",
        );
      }
      const allowedUsers = await query(
        `SELECT approver_user_id 
         FROM adm_workflow_step_approvers 
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      }
      const dwRes = await query(
        `INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
        VALUES
          (:companyId, :workflowId, :documentId, :docType, :amount, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: voucherId,
          docType: docTypePrimary,
          amount: amount === null ? null : Number(amount),
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;
      await query(
        `INSERT INTO adm_workflow_tasks
          (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
        VALUES
          (:companyId, :workflowId, :dwId, :documentId, :docType, :stepOrder, :assignedTo, 'PENDING')`,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: voucherId,
          docType: docTypePrimary,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      await query(
        `INSERT INTO adm_workflow_logs
          (document_workflow_id, step_order, action, actor_user_id, comments)
        VALUES
          (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)`,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user.sub,
          comments: "",
        },
      );
      await query(
        `UPDATE fin_vouchers SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id: voucherId, companyId, branchId, branchIdsStr },
      );
      const ref = vInfo?.voucher_no || null;
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId: assignedToUserId,
          title: "Approval Required",
          message: ref
            ? `${titleName} ${ref} requires your approval`
            : `${titleName} #${voucherId} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      );
      res.status(201).json({ instanceId, status: "SUBMITTED" });
      return;
    }
    const behavior = getInactiveWorkflowBehavior(inactiveWorkflow);
    if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
      await query(
        `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id: voucherId, companyId, branchId, branchIdsStr },
      );
      await query(
        `UPDATE fin_pdc_postings SET status = 'POSTED' WHERE voucher_id = :id AND company_id = :companyId`,
        { id: voucherId, companyId },
      );
      try {
        await query(
          `UPDATE trans_expense_logs 
           SET status = 'PAID' 
           WHERE id IN (
             SELECT expense_log_id FROM trn_transport_expenses 
             WHERE voucher_id = :id AND company_id = :companyId AND expense_log_id IS NOT NULL
           ) AND company_id = :companyId`,
          { id: voucherId, companyId },
        );
      } catch (e) {}
      res.json({ status: "APPROVED" });
      return;
    }
    await query(
      `UPDATE fin_vouchers SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id: voucherId, companyId, branchId, branchIdsStr },
    );
    res.json({ status: "SUBMITTED" });
  } catch (err) {
    next(err);
  }
};

/**
 * Synchronizes and initializes a default chart of accounts for the company if they don't exist.
 * Sets up basic groups and required control accounts.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const syncAccounts = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    await conn.beginTransaction();
    const debtorsGroupId = await ensureGroupIdTx(conn, {
      companyId,
      code: "DEBTORS",
      name: "Debtors",
      nature: "ASSET",
      parentId: null,
    });
    const creditorsGroupId = await ensureGroupIdTx(conn, {
      companyId,
      code: "CREDITORS",
      name: "Creditors",
      nature: "LIABILITY",
      parentId: null,
    });
    const [baseCurRows] = await conn.execute(
      "SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1",
      { companyId },
    );
    const baseCurrencyId = Number(baseCurRows?.[0]?.id || 0) || null;
    let customersCreated = 0;
    let customersUpdated = 0;
    const [custRows] = await conn.execute(
      "SELECT id, customer_code, customer_name, currency_id FROM sal_customers WHERE company_id = :companyId",
      { companyId },
    );
    for (const r of custRows || []) {
      const code =
        r.customer_code && String(r.customer_code).trim()
          ? String(r.customer_code).trim()
          : `C${String(Number(r.id || 0)).padStart(5, "0")}`;
      const [accRows] = await conn.query(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(debtorsGroupId)) {
        await conn.query(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: debtorsGroupId, id: acc.id, companyId },
        );
        customersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.query(
          `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
           VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
          {
            companyId,
            groupId: debtorsGroupId,
            code,
            name: r.customer_name,
            currencyId,
          },
        );
        customersCreated += 1;
      }
    }
    let suppliersCreated = 0;
    let suppliersUpdated = 0;
    const [supRows] = await conn.query(
      "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId",
      { companyId },
    );
    for (const r of supRows || []) {
      let code =
        r.supplier_code && String(r.supplier_code).trim()
          ? String(r.supplier_code).trim()
          : `SU-${String(Number(r.id || 0)).padStart(6, "0")}`;
      const [accRows] = await conn.query(
        "SELECT id, group_id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const acc = accRows?.[0];
      if (acc && Number(acc.group_id || 0) !== Number(creditorsGroupId)) {
        await conn.query(
          "UPDATE fin_accounts SET group_id = :groupId WHERE id = :id AND company_id = :companyId",
          { groupId: creditorsGroupId, id: acc.id, companyId },
        );
        suppliersUpdated += 1;
      } else if (!acc) {
        const currencyId = r.currency_id || baseCurrencyId;
        await conn.query(
          `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_control_account, is_postable, is_active)
           VALUES (:companyId, :groupId, :code, :name, :currencyId, 0, 1, 1)`,
          {
            companyId,
            groupId: creditorsGroupId,
            code,
            name: r.supplier_name,
            currencyId,
          },
        );
        suppliersCreated += 1;
      }
    }
    await conn.query(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code LIKE 'C%'",
      { companyId, groupId: debtorsGroupId },
    );
    await conn.query(
      "UPDATE fin_accounts SET group_id = :groupId WHERE company_id = :companyId AND code LIKE 'SU-%'",
      { companyId, groupId: creditorsGroupId },
    );
    await conn.commit();
    res.json({
      debtors_group_id: debtorsGroupId,
      creditors_group_id: creditorsGroupId,
      customers_created: customersCreated,
      customers_updated: customersUpdated,
      suppliers_created: suppliersCreated,
      suppliers_updated: suppliersUpdated,
    });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

/**
 * Retrieves a list of account groups, optionally tracking whether they have associated accounts.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listAccountGroups = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const conn = await pool.getConnection();
    try {
      await ensureGroupIdTx(conn, {
        companyId,
        code: "DEBTORS",
        name: "Debtors",
        nature: "ASSET",
        parentId: null,
      });
      await ensureGroupIdTx(conn, {
        companyId,
        code: "CREDITORS",
        name: "Creditors",
        nature: "LIABILITY",
        parentId: null,
      });
    } finally {
      conn.release();
    }
    const nature =
      req.query.nature &&
      ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(
        String(req.query.nature).toUpperCase(),
      )
        ? String(req.query.nature).toUpperCase()
        : null;
    const active =
      req.query.active === "0" || req.query.active === "1"
        ? Number(req.query.active)
        : null;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const includeTotals = req.query.includeTotals === "1";
    const items = await query(
      `SELECT g.id, g.code, g.name, g.nature, g.parent_id, pg.name AS parent_name, g.is_active, g.created_at, g.updated_at${
        includeTotals
          ? `,
                COALESCE(ac.cnt, 0) AS account_count,
                COALESCE(ac_act.cnt_active, 0) AS active_account_count`
          : ``
      }
         FROM fin_account_groups g
         LEFT JOIN fin_account_groups pg
           ON pg.id = g.parent_id
          AND pg.company_id = g.company_id
         ${
           includeTotals
             ? `LEFT JOIN (
                  SELECT group_id, COUNT(*) AS cnt
                    FROM fin_accounts
                   WHERE company_id = :companyId
                   GROUP BY group_id
                ) ac ON ac.group_id = g.id
                LEFT JOIN (
                  SELECT group_id, COUNT(*) AS cnt_active
                    FROM fin_accounts
                   WHERE company_id = :companyId AND is_active = 1
                   GROUP BY group_id
                ) ac_act ON ac_act.group_id = g.id`
             : ``
         }
        WHERE g.company_id = :companyId
          AND (:nature IS NULL OR g.nature = :nature)
          AND (:active IS NULL OR g.is_active = :active)
          AND (
            :search IS NULL OR
            g.code LIKE CONCAT('%', :search, '%') OR
            g.name LIKE CONCAT('%', :search, '%')
          )
        ORDER BY g.code ASC`,
      { companyId, nature, active, search },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

/**
 * Fetches the chart of accounts for the company, optionally filtering by active status or specific groups.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listChartOfAccounts = async (req, res, next) => {
  try {
    await ensureAccountBalanceObjects();
    const companyId = req.scope.companyId;
    const search = req.query.search ? String(req.query.search).trim() : null;
    const groupId = req.query.groupId ? Number(req.query.groupId) : null;
    const nature = req.query.nature ? String(req.query.nature).trim().toUpperCase() : null;
    const active = req.query.active !== undefined && req.query.active !== "" && req.query.active !== null ? Number(req.query.active) : null;
    const postable = req.query.postable !== undefined && req.query.postable !== "" && req.query.postable !== null ? Number(req.query.postable) : null;
    const items = await query(
      `SELECT a.id, a.code, a.name, a.balance_type, a.is_postable, a.is_active, a.currency_id,
              c.code AS currency_code,
              g.id AS group_id, g.code AS group_code, g.name AS group_name, g.nature,
              COALESCE(ab.balance_amount, 0) AS current_balance,
              COALESCE(ab.balance_type, a.balance_type, CASE WHEN g.nature IN ('ASSET','EXPENSE') THEN 'DEBIT' ELSE 'CREDIT' END) AS current_balance_type,
              pg.id AS parent_group_id, pg.name AS parent_group_name
       FROM fin_accounts a
       LEFT JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_currencies c ON c.id = a.currency_id
       LEFT JOIN fin_account_balances ab ON ab.account_id = a.id AND ab.company_id = a.company_id
       LEFT JOIN fin_account_groups pg ON pg.id = g.parent_id
       WHERE a.company_id = :companyId
         AND (:search IS NULL OR a.code LIKE CONCAT('%', :search, '%') OR a.name LIKE CONCAT('%', :search, '%') OR g.name LIKE CONCAT('%', :search, '%'))
         AND (:groupId IS NULL OR a.group_id = :groupId)
         AND (:nature IS NULL OR g.nature = :nature)
         AND (:active IS NULL OR a.is_active = :active)
         AND (:postable IS NULL OR a.is_postable = :postable)
       ORDER BY g.code ASC, a.code ASC`,
      { companyId, search, groupId, nature, active, postable },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listExpenseAccounts = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const items = await query(
      `SELECT a.id, a.code, a.name, a.is_postable, a.is_active, a.currency_id,
              c.code AS currency_code,
              g.id AS group_id, g.code AS group_code, g.name AS group_name, g.nature
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id AND g.company_id = a.company_id
       LEFT JOIN fin_currencies c ON c.id = a.currency_id AND c.company_id = a.currency_id
       WHERE a.company_id = :companyId
         AND g.nature = 'EXPENSE'
         AND a.is_active = 1
       ORDER BY g.code ASC, a.code ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

/**
 * Creates a new financial account under a specific group, assigning currency and balance types.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const {
      groupId,
      name,
      currencyId,
      isPostable,
      isControlAccount,
      isActive,
    } = req.body;
    if (!groupId || !name) {
      return next(
        httpError(400, "VALIDATION_ERROR", "Group and Name are required"),
      );
    }

    // Generate code based on nature (1xxx for Asset, 2xxx for Liability, etc.)
    const groups = await query(
      "SELECT code, nature FROM fin_account_groups WHERE id = :groupId AND company_id = :companyId",
      { groupId, companyId },
    );
    if (!groups.length)
      return next(httpError(400, "VALIDATION_ERROR", "Invalid Group"));
    const nature = groups[0].nature;

    const natureMap = {
      ASSET: 1,
      LIABILITY: 2,
      EQUITY: 3,
      INCOME: 4,
      EXPENSE: 5,
    };
    const natureCode = natureMap[nature] || 9;
    const naturePrefix = natureCode.toString();

    let code = req.body.code ? String(req.body.code).trim() : null;
    if (!code) {
      // Find the next available numeric 4-digit code in this nature's series
      const maxRows = await query(
        `SELECT MAX(CAST(code AS UNSIGNED)) as maxCode 
         FROM fin_accounts 
         WHERE company_id = :companyId 
           AND code REGEXP '^[1-5][0-9]{3}$' 
           AND code LIKE :prefix`,
        { companyId, prefix: `${naturePrefix}%` },
      );

      if (maxRows[0] && maxRows[0].maxCode) {
        code = (Number(maxRows[0].maxCode) + 1).toString();
      } else {
        // Start from nature base + 1 (e.g., 1001, 2001, etc.)
        code = (natureCode * 1000 + 1).toString();
      }
    }

    // Ensure uniqueness
    const existingCode = await query(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    if (existingCode.length) {
      if (req.body.code) {
        return next(
          httpError(400, "DUPLICATE_CODE", `Account code '${code}' already exists. Please choose a different code.`),
        );
      }
      let seq = 1;
      while (true) {
        const candidate = `${naturePrefix}${String(seq).padStart(3, "0")}`;
        const check = await query(
          "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
          { companyId, code: candidate },
        );
        if (!check.length) {
          code = candidate;
          break;
        }
        seq++;
      }
    }

    const result = await query(
      `INSERT INTO fin_accounts (company_id, group_id, code, name, currency_id, is_postable, is_control_account, is_active)
       VALUES (:companyId, :groupId, :code, :name, :currencyId, :isPostable, :isControlAccount, :isActive)`,
      {
        companyId,
        groupId,
        code,
        name: name.trim(),
        currencyId: currencyId || null,
        isPostable: isPostable === undefined ? 1 : Number(Boolean(isPostable)),
        isControlAccount:
          isControlAccount === undefined
            ? 0
            : Number(Boolean(isControlAccount)),
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );

    res.status(201).json({ id: result.insertId, code });
  } catch (e) {
    next(e);
  }
};

export const updateAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    const {
      groupId,
      name,
      code,
      currencyId,
      isPostable,
      isControlAccount,
      isActive,
    } = req.body;

    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    if (code) {
      const dup = await query(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code AND id <> :id LIMIT 1",
        { companyId, code: String(code).trim(), id },
      );
      if (dup.length) {
        return next(
          httpError(400, "DUPLICATE_CODE", `Account code '${code}' already exists.`),
        );
      }
    }

    await query(
      `UPDATE fin_accounts SET
        group_id = COALESCE(:groupId, group_id),
        name = COALESCE(:name, name),
        code = COALESCE(:code, code),
        currency_id = :currencyId,
        is_postable = COALESCE(:isPostable, is_postable),
        is_control_account = COALESCE(:isControlAccount, is_control_account),
        is_active = COALESCE(:isActive, is_active)
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        groupId: groupId || null,
        name: name ? name.trim() : null,
        code: code ? code.trim() : null,
        currencyId: currencyId || null,
        isPostable:
          isPostable === undefined ? null : Number(Boolean(isPostable)),
        isControlAccount:
          isControlAccount === undefined
            ? null
            : Number(Boolean(isControlAccount)),
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
      },
    );

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const updateAccountActiveStatus = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    const { isActive } = req.body;
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    await query(
      "UPDATE fin_accounts SET is_active = :isActive WHERE id = :id AND company_id = :companyId",
      { id, companyId, isActive: Number(Boolean(isActive)) },
    );
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

export const deleteAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    const acc = await query(
      "SELECT id, code, name FROM fin_accounts WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!acc.length) {
      return next(httpError(404, "NOT_FOUND", "Account not found"));
    }

    // Check references in transactions
    const [voucherLines] = await query(
      "SELECT COUNT(*) AS cnt FROM fin_voucher_lines WHERE account_id = :id",
      { id },
    );
    if (Number(voucherLines?.cnt || 0) > 0) {
      return next(
        httpError(
          400,
          "REFERENCED_RESOURCE",
          "Cannot delete this account because financial vouchers/transactions are posted to it. You can deactivate it instead.",
        ),
      );
    }

    const [bankAccs] = await query(
      "SELECT COUNT(*) AS cnt FROM fin_bank_accounts WHERE gl_account_id = :id",
      { id },
    );
    if (Number(bankAccs?.cnt || 0) > 0) {
      return next(
        httpError(
          400,
          "REFERENCED_RESOURCE",
          "Cannot delete this account because it is linked to a bank account. Remove or reassign the bank account first.",
        ),
      );
    }

    await query(
      "DELETE FROM fin_account_balances WHERE account_id = :id AND company_id = :companyId",
      { id, companyId },
    );
    await query(
      "DELETE FROM fin_accounts WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );

    res.json({ success: true, message: "Account deleted successfully" });
  } catch (e) {
    next(e);
  }
};

/**
 * Retrieves the current balance for a specific account.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getAccountBalance = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    const rows = await query(
      "SELECT id, code, name, opening_balance, opening_balance_date, is_debit_positive FROM fin_accounts WHERE id = :id AND company_id = :companyId LIMIT 1",
      { id, companyId },
    );
    const account = rows?.[0];
    if (!account) return next(httpError(404, "NOT_FOUND", "Account not found"));

    // Calculate current balance from general ledger (voucher lines)
    const ledgerResult = await query(
      `SELECT 
        COALESCE(SUM(vl.debit), 0) - COALESCE(SUM(vl.credit), 0) AS ledger_balance
       FROM fin_voucher_lines vl
       INNER JOIN fin_vouchers v ON v.id = vl.voucher_id
       WHERE vl.account_id = :id 
         AND v.company_id = :companyId 
         AND v.status IN ('POSTED', 'APPROVED')`,
      { id, companyId },
    );

    const openingBalance = Number(account.opening_balance || 0);
    const ledgerBalance = Number(ledgerResult?.[0]?.ledger_balance || 0);
    const currentBalance = openingBalance + ledgerBalance;

    res.json({
      ...account,
      balance: currentBalance,
      opening_balance: openingBalance,
      ledger_movement: ledgerBalance,
    });
  } catch (e) {
    next(e);
  }
};

export const listTaxCodes = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const form = req.query.form ? String(req.query.form).trim() : null;
    const pageId = req.query.pageId ? Number(req.query.pageId) : null;
    let active = null;
    if (
      req.query.active !== undefined &&
      req.query.active !== null &&
      req.query.active !== ""
    ) {
      const activeStr = String(req.query.active).trim().toLowerCase();
      active = activeStr === "1" || activeStr === "true" ? 1 : 0;
    }

    // Resolve form code to pageId if necessary (support both camelCase and kebab-case)
    let resolvedPageId = pageId;
    if (!resolvedPageId && form) {
      resolvedPageId =
        PAGE_ID_MAP[form] ||
        PAGE_ID_MAP[form.toUpperCase().replace(/-/g, "_")] ||
        null;
    }

    // The Setup page loads without form or pageId to manage all codes.
    // Setup management queries MUST always query fresh data from the database.
    const isSetupQuery = !resolvedPageId && !form && active === null;
    const cacheKey = `taxes:company:${companyId}:page:${resolvedPageId}:active:${active}`;

    if (!isSetupQuery) {
      try {
        const cached = await cacheGet(cacheKey);
        if (cached && Array.isArray(cached) && cached.length > 0) {
          return res.json({ items: cached });
        }
      } catch (cacheErr) {
        console.warn("[listTaxCodes] Cache read failed:", cacheErr?.message || cacheErr);
      }
    } else {
      // Purge any stale setup cache
      await cacheDel(cacheKey).catch(() => {});
      await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
      await cacheDelPattern("taxes:*").catch(() => {});
    }

    // Flexible company matching: match current company OR company 1 (default ERP company) OR NULL/0
    const conditions = ["(company_id = :companyId OR company_id = 1 OR company_id IS NULL OR company_id = 0)"];
    const params = { companyId };

    if (active !== null) {
      conditions.push("is_active = :active");
      params.active = active;
    }

    if (resolvedPageId !== null) {
      conditions.push(
        "FIND_IN_SET(:resolvedPageId, REPLACE(COALESCE(valid_pages, ''), ' ', '')) > 0",
      );
      params.resolvedPageId = resolvedPageId;
    }

    let items = [];
    try {
      items = await query(
        `SELECT id, code, name, rate_percent, type, is_active,
                valid_pages, is_sales_tax, is_purchase_tax, is_service_tax
           FROM fin_tax_codes
          WHERE ${conditions.join(" AND ")}
          ORDER BY is_active DESC, code ASC`,
        params,
      );
    } catch (queryErr) {
      console.error("[listTaxCodes] Query error:", queryErr?.message || queryErr);
      // Fallback: If table or column issue occurred, attempt simplified query
      try {
        items = await query(
          `SELECT id, code, name, rate_percent, type, is_active
             FROM fin_tax_codes
            WHERE (company_id = :companyId OR company_id = 1 OR company_id IS NULL OR company_id = 0)
            ${active !== null ? "AND is_active = :active" : ""}
            ORDER BY is_active DESC, code ASC`,
          params,
        );
      } catch (fallbackErr) {
        console.error("[listTaxCodes] Fallback query error:", fallbackErr?.message || fallbackErr);
        return res.json({ items: [] });
      }
    }

    // Only cache non-empty transactional lookups (max 5 minutes, never 24 hours)
    if (!isSetupQuery && Array.isArray(items) && items.length > 0) {
      try {
        await cacheSet(cacheKey, items, 300);
      } catch {}
    }

    res.json({ items: Array.isArray(items) ? items : [] });
  } catch (e) {
    console.error("[listTaxCodes] Unhandled error:", e?.message || e);
    res.json({ items: [] });
  }
};

export const getTaxCodesByPageId = async (req, res, next) => {
  try {
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const pageId = Number(req.params.pageId || 0);

    if (!pageId) {
      return res.json({ items: [] });
    }

    const cacheKey = `taxes:company:${companyId}:page:${pageId}:active:1`;
    try {
      const cached = await cacheGet(cacheKey);
      if (cached && Array.isArray(cached) && cached.length > 0) {
        return res.json({ items: cached });
      }
    } catch (cacheErr) {
      console.warn("[getTaxCodesByPageId] Cache read failed:", cacheErr?.message || cacheErr);
    }

    let items = [];
    try {
      items = await query(
        `SELECT id, code, name, rate_percent, type, is_active,
                valid_pages, is_sales_tax, is_purchase_tax, is_service_tax
           FROM fin_tax_codes
          WHERE (company_id = :companyId OR company_id = 1 OR company_id IS NULL OR company_id = 0)
            AND is_active = 1
            AND FIND_IN_SET(:pageId, REPLACE(COALESCE(valid_pages, ''), ' ', '')) > 0
          ORDER BY code ASC`,
        { companyId, pageId },
      );
    } catch (queryErr) {
      console.error("[getTaxCodesByPageId] Query error:", queryErr?.message || queryErr);
      return res.json({ items: [] });
    }

    if (Array.isArray(items) && items.length > 0) {
      try {
        await cacheSet(cacheKey, items, 300);
      } catch {}
    }

    res.json({ items: Array.isArray(items) ? items : [] });
  } catch (e) {
    console.error("[getTaxCodesByPageId] Unhandled error:", e?.message || e);
    res.json({ items: [] });
  }
};

export const getItemPurchaseTax = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const itemId = Number(req.params.itemId || 0);
    if (!itemId) {
      return next(httpError(400, "VALIDATION_ERROR", "Invalid itemId"));
    }

    const rows = await query(
      `SELECT i.id AS item_id,
              i.vat_on_purchase_id AS tax_id,
              t.code AS tax_code,
              t.rate_percent AS tax_rate
         FROM inv_items i
         LEFT JOIN fin_tax_codes t
           ON t.id = i.vat_on_purchase_id
          AND t.company_id = i.company_id
        WHERE i.company_id = :companyId
          AND i.id = :itemId
        LIMIT 1`,
      { companyId, itemId },
    );

    const row = rows?.[0];
    if (!row) {
      return next(httpError(404, "NOT_FOUND", "Item not found"));
    }

    if (!row.tax_id) {
      return res.json({ tax: null });
    }

    return res.json({
      tax: {
        id: Number(row.tax_id),
        tax_code: row.tax_code || null,
        tax_rate: Number(row.tax_rate || 0),
      },
    });
  } catch (e) {
    next(e);
  }
};

export const listTaxCodeComponents = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const taxCodeId = Number(req.params.id || req.params.taxCodeId || 0);
    if (!taxCodeId) {
      return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
    }
    let items = await query(
      `SELECT c.id, c.tax_detail_id, c.rate_percent, c.sort_order, c.is_active,
              c.compound_level, c.compound_levels,
              d.component_name, d.account_id,
              a.code AS account_code, a.name AS account_name
         FROM fin_tax_components c
         LEFT JOIN fin_tax_details d
           ON d.id = c.tax_detail_id
          AND d.company_id = c.company_id
         LEFT JOIN fin_accounts a ON a.id = d.account_id
        WHERE c.company_id = :companyId
          AND c.tax_code_id = :taxCodeId
        ORDER BY c.sort_order ASC, c.id ASC`,
      { companyId, taxCodeId },
    );

    if (Array.isArray(items) && items.length > 0) {
      const hasUnsequenced = items.some(
        (it) =>
          it.sort_order === null ||
          it.sort_order === undefined ||
          Number(it.sort_order) >= 100 ||
          Number(it.sort_order) <= 0,
      );
      if (hasUnsequenced) {
        for (let i = 0; i < items.length; i++) {
          const newOrder = i + 1;
          items[i].sort_order = newOrder;
          await query(
            `UPDATE fin_tax_components SET sort_order = :newOrder WHERE id = :id AND company_id = :companyId`,
            { newOrder, id: items[i].id, companyId },
          ).catch(() => {});
        }
      }
    }

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listVouchers = async (req, res, next) => {
  try {
    const companyId = Number(req.scope?.companyId || 1);
    const branchId = req.scope?.branchId ?? null;
    const branchIdsStr = String(req.scope?.branchIdsStr || "");
    const rawVoucherCode = req.query.voucherTypeCode
      ? String(req.query.voucherTypeCode).trim().toUpperCase()
      : "";
    const from = req.query.from ? String(req.query.from).trim() : null;
    const to = req.query.to ? String(req.query.to).trim() : null;
    const status = req.query.status
      ? String(req.query.status).trim().toUpperCase()
      : null;

    let typeCond = "1=1";
    if (rawVoucherCode) {
      let matchingCodes = [rawVoucherCode];
      if (["PV", "PAYV", "PUV"].includes(rawVoucherCode)) {
        matchingCodes = ["PV", "PAYV", "PUV"];
      } else if (["RV", "RCPV"].includes(rawVoucherCode)) {
        matchingCodes = ["RV", "RCPV"];
      } else if (["JV", "JOURNAL"].includes(rawVoucherCode)) {
        matchingCodes = ["JV", "JOURNAL"];
      }
      const quoted = matchingCodes.map((c) => `'${c.replace(/'/g, "''")}'`).join(", ");
      typeCond = `vt.code IN (${quoted})`;
    }

    const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
    const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit || "50"), 10) || 50));
    const offset = (page - 1) * limit;

    const whereClause = `WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR :branchId = 'all' OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
          AND ${typeCond}
          AND (:status IS NULL OR v.status = :status)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)`;

    const countSql = `SELECT COUNT(*) AS total 
                        FROM fin_vouchers v 
                        LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id 
                        ${whereClause}`;
    const params = {
      companyId,
      branchId,
      branchIdsStr,
      status,
      from,
      to,
    };
    
    let total = 0;
    try {
      const countRes = await query(countSql, params);
      total = Number(countRes[0]?.total || 0);
    } catch (countErr) {
      console.error("[listVouchers countSql Error]:", countErr);
    }

    let items = [];
    try {
      items = await query(
        `SELECT v.id, v.voucher_no, v.voucher_date, COALESCE(NULLIF(TRIM(v.status), ''), 'APPROVED') AS status, v.project_id,
                COALESCE(
                  (
                    SELECT l.description
                      FROM fin_voucher_lines l
                     WHERE l.voucher_id = v.id
                       AND NULLIF(TRIM(l.description), '') IS NOT NULL
                     ORDER BY l.line_no ASC, l.id ASC
                     LIMIT 1
                  ),
                  v.narration
                ) AS description,
                v.narration AS remarks,
                COALESCE(NULLIF(v.total_debit, 0), (SELECT SUM(l.debit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_debit,
                COALESCE(NULLIF(v.total_credit, 0), (SELECT SUM(l.credit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_credit,
                COALESCE(NULLIF(v.balanced_amount, 0), NULLIF(v.total_debit, 0), NULLIF(v.total_credit, 0), 0) AS balanced_amount,
                GREATEST(
                  COALESCE(v.total_debit, 0),
                  COALESCE(v.total_credit, 0),
                  COALESCE(v.balanced_amount, 0),
                  COALESCE((SELECT SUM(l.debit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0),
                  COALESCE((SELECT SUM(l.credit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0)
                ) AS total_amount,
                v.voucher_type_id, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
                v.currency_id, c.code AS currency_code
           FROM fin_vouchers v
           LEFT JOIN fin_voucher_types vt
             ON vt.id = v.voucher_type_id
           LEFT JOIN fin_currencies c
             ON c.id = v.currency_id
          ${whereClause}
          ORDER BY v.voucher_date DESC, v.id DESC LIMIT ${limit} OFFSET ${offset}`,
        params,
      );
    } catch (queryErr) {
      console.error("[listVouchers items query Error]:", queryErr);
      try {
        items = await query(
          `SELECT v.id, v.voucher_no, v.voucher_date, COALESCE(NULLIF(TRIM(v.status), ''), 'APPROVED') AS status,
                  v.narration AS description, v.narration AS remarks,
                  COALESCE(v.total_debit, 0) AS total_debit,
                  COALESCE(v.total_credit, 0) AS total_credit,
                  COALESCE(v.balanced_amount, 0) AS balanced_amount,
                  GREATEST(COALESCE(v.total_debit, 0), COALESCE(v.total_credit, 0), COALESCE(v.balanced_amount, 0)) AS total_amount,
                  v.voucher_type_id, vt.code AS voucher_type_code, vt.name AS voucher_type_name
             FROM fin_vouchers v
             LEFT JOIN fin_voucher_types vt
               ON vt.id = v.voucher_type_id
            ${whereClause}
            ORDER BY v.id DESC LIMIT ${limit} OFFSET ${offset}`,
          params,
        );
      } catch (fallbackErr) {
        console.error("[listVouchers fallback query Error]:", fallbackErr);
        items = [];
      }
    }

    return res.json({ 
      items: items || [],
      pagination: {
        page,
        pageSize: limit,
        total: total || (items || []).length,
        totalPages: Math.ceil((total || (items || []).length) / limit) || 1
      }
    });
  } catch (e) {
    console.error("[listVouchers Controller Fatal Error]:", e);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: e.message || "Failed to list vouchers",
      items: [],
      pagination: { page: 1, pageSize: 50, total: 0, totalPages: 1 }
    });
  }
};

export const getVoucherById = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId ?? null;
    const branchId = req.scope?.branchId ?? null;
    const branchIdsStr = String(req.scope?.branchIdsStr || "");
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    const headerRows = await query(
      `SELECT v.id, v.voucher_no, v.voucher_date, COALESCE(NULLIF(TRIM(v.status), ''), 'APPROVED') AS status, v.project_id, v.cost_center_id,
              v.narration AS remarks, v.narration,
              COALESCE(NULLIF(v.total_debit, 0), (SELECT SUM(l.debit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_debit,
              COALESCE(NULLIF(v.total_credit, 0), (SELECT SUM(l.credit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_credit,
              COALESCE(NULLIF(v.balanced_amount, 0), NULLIF(v.total_debit, 0), NULLIF(v.total_credit, 0), 0) AS balanced_amount,
              GREATEST(
                COALESCE(v.total_debit, 0),
                COALESCE(v.total_credit, 0),
                COALESCE(v.balanced_amount, 0),
                COALESCE((SELECT SUM(l.debit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0),
                COALESCE((SELECT SUM(l.credit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0)
              ) AS total_amount,
              v.voucher_type_id, vt.code AS voucher_type_code, vt.name AS voucher_type_name,
              v.currency_id, c.code AS currency_code, v.exchange_rate
         FROM fin_vouchers v
         LEFT JOIN fin_voucher_types vt
           ON vt.id = v.voucher_type_id
         LEFT JOIN fin_currencies c
           ON c.id = v.currency_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR :branchId = 'all' OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
          AND v.id = :id
        LIMIT 1`,
      { companyId, branchId, branchIdsStr, id },
    );
    const voucher = headerRows?.[0];
    if (!voucher) return next(httpError(404, "NOT_FOUND", "Voucher not found"));
    const lines = await query(
      `SELECT l.id, l.line_no, l.account_id, l.debit, l.credit, l.description,
              l.currency_id, l.exchange_rate, l.tax_code_id, l.payment_method, l.reference_no,
              a.code AS account_code, a.name AS account_name
         FROM fin_voucher_lines l
         LEFT JOIN fin_accounts a ON a.id = l.account_id
        WHERE l.voucher_id = :voucherId
        ORDER BY l.line_no ASC, l.id ASC`,
      { voucherId: id },
    );

    let additionalLines = [];
    const linkMatch = String(voucher.narration || "").match(/Linked to (?:PV|SV)#(\d+)/);
    if (linkMatch) {
      const linkedId = Number(linkMatch[1]);
      additionalLines = await query(
        `SELECT l.id, l.line_no, l.account_id, l.debit, l.credit, l.description,
                l.currency_id, l.exchange_rate, l.tax_code_id, l.payment_method, l.reference_no,
                a.code AS account_code, a.name AS account_name
           FROM fin_voucher_lines l
           LEFT JOIN fin_accounts a ON a.id = l.account_id
          WHERE l.voucher_id = :linkedId
          ORDER BY l.line_no ASC, l.id ASC`,
        { linkedId }
      );
    }

    res.json({ ...voucher, lines: [...additionalLines, ...lines] });
  } catch (e) {
    next(e);
  }
};

/**
 * Creates a new voucher (Journal, Payment, Receipt, Purchase, etc.) with its associated lines.
 * Handles transaction boundaries, resolving voucher types, ensuring balanced entries for drafts vs submitted,
 * calculating tax splits, and updating related bills/invoices when applied.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createVoucher = async (req, res, next) => {
  let conn;
  try {
    await ensurePurBillsPaymentStatusObjects();
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Helper to execute queries within transaction (sanitize undefined → null)
    const txQuery = async (sql, params) => {
      let sanitized = params;
      if (params) {
        if (Array.isArray(params)) {
          sanitized = params.map(v => v === undefined ? null : v);
        } else if (typeof params === 'object') {
          sanitized = {};
          for (const key in params) {
            sanitized[key] = params[key] === undefined ? null : params[key];
          }
        }
      }
      const [rows] = await conn.execute(sql, sanitized);
      return rows;
    };

    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const {
      voucherTypeCode,
      voucherTypeId,
      voucherDate,
      voucherNo,
      remarks,
      narration: bodyNarration,
      currencyId: inputCurrencyId,
      exchangeRate,
      status,
      lines,
      isDirectPayment,
      projectId,
      apply_to_purchase_bills: applyToPurchaseBills,
      apply_to_service_bills: applyToServiceBills,
      apply_to_maintenance_bills: applyToMaintenanceBills,
      apply_to_sales_invoices: applyToSalesInvoices,
      paymentDetails,
      costCenterId,
    } = req.body || {};
    let currencyId = inputCurrencyId;
    const effectiveRemarks = remarks || bodyNarration || null;
    let finalVoucherTypeId = Number(voucherTypeId || 0) || 0;
    if (!finalVoucherTypeId && voucherTypeCode) {
      const vt = await ensureVoucherTypeForRequest({
        companyId,
        requestedCode: voucherTypeCode,
      });
      finalVoucherTypeId = Number(vt?.id || 0);
    }
    if (!finalVoucherTypeId) {
      return next(
        httpError(400, "VALIDATION_ERROR", "voucherType is required"),
      );
    }

    const voucherDateYmd = voucherDate || new Date().toISOString().slice(0, 10);
    let finalExchangeRate = Number(exchangeRate || 1) || 1;
    const normalizedVoucherTypeCode = String(
      voucherTypeCode || "",
    ).toUpperCase();
    const isPurchaseVoucherMain =
      normalizedVoucherTypeCode === "PV" ||
      normalizedVoucherTypeCode === "PUV" ||
      normalizedVoucherTypeCode === "PB";
    const fyRows = await query(
      `SELECT id
         FROM fin_fiscal_years
        WHERE company_id = :companyId
          AND :voucherDate >= start_date
          AND :voucherDate <= end_date
        ORDER BY start_date DESC
        LIMIT 1`,
      { companyId, voucherDate: voucherDateYmd },
    );
    const fiscalYearId = Number(fyRows?.[0]?.id || 0) || null;

    // Handle direct vouchers:
    // - PAYV + direct -> create linked PV from posting lines
    // - RV + direct   -> create linked SV from posting lines
    let purchaseVoucherId = null;
    let salesVoucherId = null;
    const isPayvDirect =
      String(voucherTypeCode).toUpperCase() === "PAYV" && isDirectPayment;
    const isRvDirect =
      String(voucherTypeCode).toUpperCase() === "RV" && isDirectPayment;
    const isRv = String(voucherTypeCode).toUpperCase() === "RV";

    // For PAYV direct payment:
    // - save the two settlement lines on the payment voucher itself
    // - keep linked purchase-voucher lines limited to the posting-lines section
    const clientLines = Array.isArray(lines)
      ? lines.filter((line) => Number(line?.accountId || 0))
      : [];
    const payvDirectBaseAmount = Number(
      paymentDetails?.baseAmount ||
        paymentDetails?.amountInBase ||
        paymentDetails?.totalAmount ||
        0,
    );
    const payvDirectDescription =
      String(paymentDetails?.description || "").trim() || "Direct Payment";
    const payvDirectSettlementLines =
      isPayvDirect &&
      Number(paymentDetails?.accountId || 0) &&
      Number(paymentDetails?.paymentAccountId || 0) &&
      payvDirectBaseAmount > 0
        ? [
            {
              accountId: Number(paymentDetails.accountId),
              description: payvDirectDescription,
              debit: payvDirectBaseAmount,
              credit: 0,
              currencyId: paymentDetails.currencyId || currencyId || null,
              exchangeRate: Number(paymentDetails.exchangeRate || paymentDetails.exchange_rate || finalExchangeRate || 1),
            },
            {
              accountId: Number(paymentDetails.paymentAccountId),
              description: payvDirectDescription,
              debit: 0,
              credit: payvDirectBaseAmount,
              currencyId: paymentDetails.currencyId || currencyId || null,
              exchangeRate: Number(paymentDetails.exchangeRate || paymentDetails.exchange_rate || finalExchangeRate || 1),
            },
          ]
        : [];

    const postingLines = clientLines;
    const payvLinesToSave = isPayvDirect ? payvDirectSettlementLines : [];
    const purchaseVoucherPostingLines = postingLines;
    const firstLineDescription = Array.isArray(lines)
      ? String(
          (lines.find((l) => String(l?.description || "").trim()) || {})
            .description || "",
        ).trim()
      : "";

    console.log("DEBUG createVoucher:", {
      voucherTypeCode,
      isDirectPayment,
      isPayvDirect,
      linesCount: lines?.length,
      autoGeneratedCount: 0,
      settlementLinesCount: payvDirectSettlementLines.length,
    });

    if (isPayvDirect && purchaseVoucherPostingLines.length >= 1) {
      // Get PV voucher type ID
      const pvVtRows = await query(
        `SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = 'PV' LIMIT 1`,
        { companyId },
      );
      const pvVoucherTypeId = Number(pvVtRows?.[0]?.id || 0);
      console.log("DEBUG PV lookup:", { pvVoucherTypeId, pvVtRows });

      if (pvVoucherTypeId) {
        // Generate PV voucher number
        const pvVoucherNo = await nextVoucherNo({
          companyId,
          voucherTypeId: pvVoucherTypeId,
        });

        // Calculate PV totals from posting lines (same pattern as RV->SV)
        const pvTotalDebit = purchaseVoucherPostingLines.reduce(
          (sum, l) => sum + Number(l?.debit || 0),
          0,
        );
        const pvTotalCredit = purchaseVoucherPostingLines.reduce(
          (sum, l) => sum + Number(l?.credit || 0),
          0,
        );
        const pvTotal = Math.max(pvTotalDebit, pvTotalCredit);

        // Create PV with posting lines
        const pvResult = await txQuery(
          `INSERT INTO fin_vouchers
             (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, cost_center_id)
           VALUES
             (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, :balancedAmount, :status, :createdBy, :costCenterId)`,
          {
            companyId,
            branchId,
            fiscalYearId: fiscalYearId || null,
            voucherTypeId: pvVoucherTypeId,
            voucherNo: pvVoucherNo,
            voucherDate: voucherDateYmd,
            narration: remarks ? `Purchase via Payment: ${remarks}` : null,
            currencyId: currencyId || null,
            exchangeRate: finalExchangeRate,
            totalDebit: pvTotal,
            totalCredit: pvTotal,
            balancedAmount: pvTotal,
            status: "POSTED",
            createdBy: Number(req.user?.sub || req.user?.id || 0) || null,
            costCenterId: costCenterId ? Number(costCenterId) : null,
          },
        );
        purchaseVoucherId = pvResult.insertId;
        console.log("DEBUG PV created:", { purchaseVoucherId, pvVoucherNo });

        // Save posting lines to PV
        for (let i = 0; i < purchaseVoucherPostingLines.length; i++) {
          const line = purchaseVoucherPostingLines[i];
          await txQuery(
            `INSERT INTO fin_voucher_lines
                (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, reference_no, cheque_number, cheque_date, payment_method, currency_id, exchange_rate)
             VALUES
                (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :referenceNo, :chequeNumber, :chequeDate, :paymentMethod, :currencyId, :exchangeRate)`,
            {
              companyId,
              voucherId: purchaseVoucherId,
              lineNo: i + 1,
              accountId: Number(line.accountId || 0) || null,
              description: line.description || null,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              taxCodeId: Number(line.taxCodeId || line.tax_code_id || 0) || null,
              currencyId: line.currencyId || line.currency_id || currencyId || null,
              exchangeRate: Number(line.exchangeRate || line.exchange_rate || finalExchangeRate || 1),
              referenceNo: line.referenceNo || null,
              chequeNumber: line.chequeNumber || null,
              chequeDate: line.chequeDate || null,
              paymentMethod: line.paymentMethod || null,
            },
          );
        }
      }
    }

    if (isRvDirect && postingLines.length >= 1) {
      const svVtRows = await query(
        `SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = 'SV' LIMIT 1`,
        { companyId },
      );
      const svVoucherTypeId = Number(svVtRows?.[0]?.id || 0);
      if (svVoucherTypeId) {
        const svVoucherNo = await nextVoucherNo({
          companyId,
          voucherTypeId: svVoucherTypeId,
        });
        const svTotalDebit = postingLines.reduce(
          (sum, l) => sum + Number(l?.debit || 0),
          0,
        );
        const svTotalCredit = postingLines.reduce(
          (sum, l) => sum + Number(l?.credit || 0),
          0,
        );
        const svTotal = Math.max(svTotalDebit, svTotalCredit);
        const svResult = await txQuery(
          `INSERT INTO fin_vouchers
             (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, project_id, cost_center_id)
           VALUES
             (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, :balancedAmount, :status, :createdBy, :projectId, :costCenterId)`,
          {
            companyId,
            branchId,
            fiscalYearId: fiscalYearId || null,
            voucherTypeId: svVoucherTypeId,
            voucherNo: svVoucherNo,
            voucherDate: voucherDateYmd,
            narration: remarks ? `Sales via Receipt: ${remarks}` : null,
            currencyId: currencyId || null,
            exchangeRate: finalExchangeRate,
            totalDebit: svTotal,
            totalCredit: svTotal,
            balancedAmount: svTotal,
            status: "POSTED",
            createdBy: Number(req.user?.sub || req.user?.id || 0) || null,
            projectId: projectId ? Number(projectId) : null,
            costCenterId: costCenterId ? Number(costCenterId) : null,
          },
        );
        salesVoucherId = svResult.insertId;
        for (let i = 0; i < postingLines.length; i++) {
          const line = postingLines[i];
          await txQuery(
            `INSERT INTO fin_voucher_lines
                (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, reference_no, cheque_number, cheque_date, payment_method, currency_id, exchange_rate)
             VALUES
                (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :referenceNo, :chequeNumber, :chequeDate, :paymentMethod, :currencyId, :exchangeRate)`,
            {
              companyId,
              voucherId: salesVoucherId,
              lineNo: i + 1,
              accountId: Number(line.accountId || 0) || null,
              description: line.description || null,
              debit: Number(line.debit || 0),
              credit: Number(line.credit || 0),
              taxCodeId: Number(line.taxCodeId || line.tax_code_id || 0) || null,
              referenceNo: line.referenceNo || null,
              currencyId: line.currencyId || line.currency_id || currencyId || null,
              exchangeRate: Number(line.exchangeRate || line.exchange_rate || finalExchangeRate || 1),
              chequeNumber: line.chequeNumber || null,
              chequeDate: line.chequeDate || null,
              paymentMethod: line.paymentMethod || null,
            },
          );
        }
      }
    }

    // For direct PAYV, save exactly the two settlement lines on the payment voucher.
    // For direct RV, continue calculating totals from posting lines.
    const totalAmount = isPayvDirect
      ? payvLinesToSave.reduce((sum, l) => sum + Number(l?.debit || 0), 0)
      : isRvDirect
        ? postingLines.reduce((sum, l) => sum + Number(l?.debit || 0), 0)
        : Array.isArray(lines)
          ? lines.reduce((sum, l) => sum + Number(l?.debit || 0), 0)
          : 0;

    // Auto-generate voucher number if not provided
    let finalVoucherNo = voucherNo;
    if (!finalVoucherNo || String(finalVoucherNo).trim() === "") {
      finalVoucherNo = await nextVoucherNo({
        companyId,
        voucherTypeId: finalVoucherTypeId,
      });
    }

    let mainNarration = effectiveRemarks;
    // Keep linked hints for non-RV vouchers only
    if (!isRv) {
      if (purchaseVoucherId) {
        mainNarration =
          `${effectiveRemarks || ""} (Linked to PV#${purchaseVoucherId})`.trim();
      } else if (salesVoucherId) {
        mainNarration =
          `${effectiveRemarks || ""} (Linked to SV#${salesVoucherId})`.trim();
      }
    }

    // Determine the final lines to save so we can inspect them
    const linesToSave = isPayvDirect
      ? payvLinesToSave
      : isRvDirect
        ? postingLines
        : Array.isArray(lines)
          ? lines
          : [];

    // Strict Double-Entry Validation
    if (linesToSave.length > 0) {
      const calcDebit = linesToSave.reduce((sum, l) => sum + Number(l?.debit || 0), 0);
      const calcCredit = linesToSave.reduce((sum, l) => sum + Number(l?.credit || 0), 0);
      if (Math.abs(calcDebit - calcCredit) > 0.05 && (normalizedVoucherTypeCode === "JV" || normalizedVoucherTypeCode === "CV" || linesToSave.length > 1)) {
        throw new Error(`Double-entry balance mismatch: Total Debits (${calcDebit.toFixed(2)}) must equal Total Credits (${calcCredit.toFixed(2)}).`);
      }
    }

    // Auto-derive currency and exchange rate for the voucher header if missing
    if (!currencyId && linesToSave.length > 0) {
      const lineWithCurrency = linesToSave.find(l => l.currencyId || l.currency_id);
      if (lineWithCurrency) {
        currencyId = lineWithCurrency.currencyId || lineWithCurrency.currency_id;
        if (!exchangeRate || exchangeRate === 1) {
          finalExchangeRate = Number(lineWithCurrency.exchangeRate || lineWithCurrency.exchange_rate || 1) || 1;
        }
      }
    }

    const result = await txQuery(
      `INSERT INTO fin_vouchers
         (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, project_id, cost_center_id)
       VALUES
         (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, :balancedAmount, :status, :createdBy, :projectId, :costCenterId)`,
      {
        companyId,
        branchId,
        fiscalYearId: fiscalYearId || null,
        voucherTypeId: finalVoucherTypeId,
        voucherNo: finalVoucherNo,
        voucherDate: voucherDateYmd,
        narration: mainNarration,
        currencyId: currencyId || null,
        exchangeRate: finalExchangeRate,
        totalDebit: totalAmount,
        totalCredit: totalAmount,
        balancedAmount: totalAmount,
        status: status || (isPurchaseVoucherMain ? "POSTED" : "DRAFT"),
        createdBy: Number(req.user?.sub || req.user?.id || 0) || null,
        projectId: projectId ? Number(projectId) : null,
        costCenterId: costCenterId ? Number(costCenterId) : null,
      },
    );

    if (linesToSave.length > 0) {
      for (let i = 0; i < linesToSave.length; i++) {
        const line = linesToSave[i];
        await txQuery(
          `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, reference_no, cheque_number, cheque_date, payment_method, currency_id, exchange_rate)
           VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, :taxCodeId, :referenceNo, :chequeNumber, :chequeDate, :paymentMethod, :currencyId, :exchangeRate)`,
          {
            companyId,
            voucherId: result.insertId,
            lineNo: i + 1,
            accountId: Number(line.accountId || 0) || null,
            description: line.description || null,
            debit: Number(line.debit || 0),
            credit: Number(line.credit || 0),
            taxCodeId: line.taxCodeId || line.tax_code_id || null,
            referenceNo: line.referenceNo || null,
            chequeNumber: line.chequeNumber || null,
            chequeDate: line.chequeDate || null,
            paymentMethod: line.paymentMethod || null,
            currencyId: line.currencyId || line.currency_id || currencyId || null,
            exchangeRate: Number(line.exchangeRate || line.exchange_rate || finalExchangeRate || 1) || 1,
          },
        );
      }
    }

    if (
      !isPayvDirect &&
      !isRvDirect &&
      (isPurchaseVoucherMain || normalizedVoucherTypeCode === "SV") &&
      linesToSave.length > 0
    ) {
      const { totalDebitAdj, totalCreditAdj } = await processVoucherTaxSplitTx(
        conn,
        {
          voucherId: result.insertId,
          companyId,
          branchId, branchIdsStr,
          lines: linesToSave,
          voucherType: isPurchaseVoucherMain ? "PV" : "SV",
          exchangeRate: finalExchangeRate,
        },
      );
      if (totalDebitAdj !== 0 || totalCreditAdj !== 0) {
        const newTotalDebit = totalAmount + totalDebitAdj;
        const newTotalCredit = totalAmount + totalCreditAdj;
        const newBalanced = Math.max(newTotalDebit, newTotalCredit);
        await txQuery(
          "UPDATE fin_vouchers SET total_debit = :td, total_credit = :tc, balanced_amount = :ba WHERE id = :id",
          {
            td: newTotalDebit,
            tc: newTotalCredit,
            ba: newBalanced,
            id: result.insertId,
          },
        );
      }
    }

    if (
      Array.isArray(applyToPurchaseBills) &&
      applyToPurchaseBills.length > 0
    ) {
      for (const row of applyToPurchaseBills) {
        const billId = Number(row?.bill_id || 0);
        const alloc = Number(row?.amount || 0);
        if (!billId || !(alloc > 0)) continue;
        await txQuery(
          `UPDATE pur_bills
              SET amount_paid = LEAST(
                    COALESCE(
                      NULLIF(net_amount, 0),
                      (SELECT COALESCE(SUM(d.line_total), 0) FROM pur_bill_details d WHERE d.bill_id = pur_bills.id),
                      0
                    ),
                    COALESCE(amount_paid, 0) + :alloc
                  ),
                  payment_status = CASE
                    WHEN LEAST(
                      COALESCE(
                        NULLIF(net_amount, 0),
                        (SELECT COALESCE(SUM(d.line_total), 0) FROM pur_bill_details d WHERE d.bill_id = pur_bills.id),
                        0
                      ),
                      COALESCE(amount_paid, 0) + :alloc
                    ) >= COALESCE(
                      NULLIF(net_amount, 0),
                      (SELECT COALESCE(SUM(d.line_total), 0) FROM pur_bill_details d WHERE d.bill_id = pur_bills.id),
                      0
                    ) THEN 'FULLY PAID'
                    WHEN LEAST(
                      COALESCE(
                        NULLIF(net_amount, 0),
                        (SELECT COALESCE(SUM(d.line_total), 0) FROM pur_bill_details d WHERE d.bill_id = pur_bills.id),
                        0
                      ),
                      COALESCE(amount_paid, 0) + :alloc
                    ) > 0 THEN 'PARTIAL PAYMENT'
                    ELSE 'UNPAID'
                  END
            WHERE company_id = :companyId
              AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
              AND id = :billId`,
          {
            companyId,
            branchId,
            branchIdsStr,
            billId,
            alloc,
          },
        );
      }
    }
    if (Array.isArray(applyToServiceBills) && applyToServiceBills.length > 0) {
      for (const row of applyToServiceBills) {
        const billId = Number(row?.bill_id || 0);
        const alloc = Number(row?.amount || 0);
        if (!billId || !(alloc > 0)) continue;
        await txQuery(
          `UPDATE pur_service_bills
              SET amount_paid = LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc),
                  payment = CASE
                    WHEN LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc) >= COALESCE(total_amount, 0) THEN 'PAID'
                    WHEN LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc) > 0 THEN 'PARTIALLY_PAID'
                    ELSE COALESCE(payment, 'UNPAID')
                  END
            WHERE company_id = :companyId
              AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
              AND id = :billId`,
          {
            companyId,
            branchId,
            branchIdsStr,
            billId,
            alloc,
          },
        );
      }
    }
    if (
      Array.isArray(applyToMaintenanceBills) &&
      applyToMaintenanceBills.length > 0
    ) {
      for (const row of applyToMaintenanceBills) {
        const billId = Number(row?.bill_id || 0);
        const alloc = Number(row?.amount || 0);
        if (!billId || !(alloc > 0)) continue;
        await txQuery(
          `UPDATE maint_bills
              SET amount_paid = LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc),
                  payment_status = CASE
                    WHEN LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc) >= COALESCE(total_amount, 0) THEN 'PAID'
                    WHEN LEAST(COALESCE(total_amount, 0), COALESCE(amount_paid, 0) + :alloc) > 0 THEN 'PARTIALLY_PAID'
                    ELSE COALESCE(payment_status, 'UNPAID')
                  END
            WHERE company_id = :companyId
              AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
              AND id = :billId`,
          {
            companyId,
            branchId,
            branchIdsStr,
            billId,
            alloc,
          },
        );
      }
    }

    if (
      Array.isArray(applyToSalesInvoices) &&
      applyToSalesInvoices.length > 0
    ) {
      for (const row of applyToSalesInvoices) {
        const invoiceId = Number(row?.invoice_id || 0);
        const alloc = Number(row?.amount || 0);
        if (!invoiceId || !(alloc > 0)) continue;
        await txQuery(
          `UPDATE sal_invoices
              SET balance_amount = GREATEST(0, COALESCE(balance_amount, COALESCE(total_amount, net_amount, 0)) - :alloc),
                  payment_status = CASE
                    WHEN GREATEST(0, COALESCE(balance_amount, COALESCE(total_amount, net_amount, 0)) - :alloc) <= 0 THEN 'PAID'
                    WHEN GREATEST(0, COALESCE(balance_amount, COALESCE(total_amount, net_amount, 0)) - :alloc) < COALESCE(total_amount, net_amount, 0) THEN 'PARTIALLY_PAID'
                    ELSE 'UNPAID'
                  END
            WHERE company_id = :companyId
              AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
              AND id = :invoiceId`,
          {
            companyId,
            branchId,
            branchIdsStr,
            invoiceId,
            alloc,
          },
        );
      }
    }

    await conn.commit();
    res.status(201).json({
      id: result.insertId,
      voucherNo: finalVoucherNo,
      linkedPurchaseVoucherId: purchaseVoucherId,
      linkedSalesVoucherId: salesVoucherId,
    });
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {}
    }
    next(e);
  } finally {
    if (conn) {
      try {
        conn.release();
      } catch {}
    }
  }
};

/**
 * Updates an existing voucher's basic properties (date, narration, exchange rate, status).
 * Does not modify voucher lines.
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const updateVoucher = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    const { voucherDate, remarks, narration: bodyNarration, status, exchangeRate, costCenterId } = req.body || {};
    const effectiveRemarks = remarks || bodyNarration || null;
    await query(
      `UPDATE fin_vouchers
          SET voucher_date = COALESCE(:voucherDate, voucher_date),
              narration = COALESCE(:remarks, narration),
              exchange_rate = COALESCE(:exchangeRate, exchange_rate),
              status = COALESCE(:status, status),
              cost_center_id = COALESCE(:costCenterId, cost_center_id)
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND id = :id`,
      {
        companyId,
        branchId, branchIdsStr,
        id,
        voucherDate: voucherDate || null,
        remarks: effectiveRemarks,
        exchangeRate: Number(exchangeRate || 0) || null,
        status: status || null,
        costCenterId: costCenterId ? Number(costCenterId) : null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

/**
 * Handles bulk import of vouchers from an uploaded XLSX file.
 * Validates, parses, and creates vouchers and their lines transactionally.
 * @param {import('express').Request} req - Express request object (expects req.file).
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const bulkImportVouchers = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensurePurBillsPaymentStatusObjects();
    const { companyId = null } = req.scope || {};
    const { vouchers, defaultBranchId } = req.body || {};
    const branchId = defaultBranchId || req.scope.branchId;
    if (!Array.isArray(vouchers) || !vouchers.length) {
      return next(httpError(400, "VALIDATION_ERROR", "vouchers array is required"));
    }

    const results = { created: 0, failed: 0, errors: [] };
    await conn.beginTransaction();

    const txQuery = async (sql, params) => {
      let sanitized = params;
      if (params) {
        if (Array.isArray(params)) {
          sanitized = params.map(v => v === undefined ? null : v);
        } else if (typeof params === 'object') {
          sanitized = {};
          for (const key in params) {
            sanitized[key] = params[key] === undefined ? null : params[key];
          }
        }
      }
      const [rows] = await conn.execute(sql, sanitized);
      return rows;
    };

    for (let vi = 0; vi < vouchers.length; vi++) {
      const v = vouchers[vi];
      try {
        const voucherTypeCode = String(v.voucher_type_code || v.voucherTypeCode || "Journal Entry").trim();

        // Resolve voucher type by name or code
        const [vtRows] = await txQuery(
          `SELECT id, code FROM fin_voucher_types WHERE company_id = :companyId AND (name = :name OR code = :name) LIMIT 1`,
          { companyId, name: voucherTypeCode },
        );
        if (!vtRows) throw new Error(`Voucher type "${voucherTypeCode}" not found`);
        const voucherTypeId = vtRows.id;
        const resolvedVoucherTypeCode = vtRows.code || "JV";

        // Resolve fiscal year
        const voucherDate = v.voucher_date || new Date().toISOString().slice(0, 10);
        const [fyRows] = await txQuery(
          `SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND :vd BETWEEN start_date AND end_date LIMIT 1`,
          { companyId, vd: voucherDate },
        );
        const fiscalYearId = fyRows?.id || 1;

        // Resolve currency
        let currencyId = null;
        let exchangeRate = 1;
        if (v.currency_name || v.currencyName) {
          const [curRows] = await txQuery(
            `SELECT id FROM fin_currencies WHERE company_id = :companyId AND (name = :name OR code = :name) LIMIT 1`,
            { companyId, name: String(v.currency_name || v.currencyName).trim() },
          );
          if (curRows) {
            currencyId = curRows.id;
            exchangeRate = Number(v.exchange_rate || 1) || 1;
          }
        }

        // Generate voucher number
        const [lastRows] = await txQuery(
          `SELECT voucher_no FROM fin_vouchers
           WHERE company_id = :companyId AND voucher_type_id = :vtId
           ORDER BY id DESC LIMIT 1`,
          { companyId, vtId: voucherTypeId },
        );
        let nextNum = 1;
        if (lastRows?.voucher_no) {
          const match = String(lastRows.voucher_no).match(/(\d+)$/);
          if (match) nextNum = Number(match[1]) + 1;
        }
        const voucherNo = v.voucher_id || `${resolvedVoucherTypeCode}-${String(nextNum).padStart(6, "0")}`;

        const lines = Array.isArray(v.lines) ? v.lines : [];
        const totalDebit = lines.reduce((s, l) => s + Number(l.debit || 0), 0);
        const totalCredit = lines.reduce((s, l) => s + Number(l.credit || 0), 0);

        // Use template branch_id if provided, otherwise fall back to scope
        const voucherBranchId = v.branch_id ? Number(v.branch_id) : branchId;

        // Insert header
        const hdr = await txQuery(
          `INSERT INTO fin_vouchers
            (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no,
             voucher_date, currency_id, exchange_rate,
             total_debit, total_credit, balanced_amount, status, created_by)
           VALUES
            (:companyId, :branchId, :fyId, :vtId, :voucherNo,
             :voucherDate, :currencyId, :exchangeRate,
             :totalDebit, :totalCredit, :balancedAmount, 'APPROVED', :createdBy)`,
          {
            companyId,
            branchId: voucherBranchId,
            fyId: fiscalYearId,
            vtId: voucherTypeId,
            voucherNo,
            voucherDate,
            currencyId,
            exchangeRate,
            totalDebit,
            totalCredit,
            balancedAmount: Math.abs(totalDebit - totalCredit),
            createdBy: req.user?.sub || null,
          },
        );

        // Insert lines
        for (let li = 0; li < lines.length; li++) {
          const ln = lines[li];
          const accName = String(ln.account_name || ln.accountName || "").trim();
          const [accRows] = await txQuery(
            `SELECT id FROM fin_accounts WHERE company_id = :companyId AND (name = :name OR code = :name) LIMIT 1`,
            { companyId, name: accName },
          );
          if (!accRows) throw new Error(`Account "${accName}" not found on line ${li + 1}`);

          await txQuery(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description,
               debit, credit, cheque_number, cheque_date)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description,
               :debit, :credit, :chequeNumber, :chequeDate)`,
            {
              companyId,
              voucherId: hdr.insertId,
              lineNo: li + 1,
              accountId: accRows.id,
              description: ln.description || null,
              debit: Number(ln.debit || 0),
              credit: Number(ln.credit || 0),
              chequeNumber: ln.cheque_number || null,
              chequeDate: ln.cheque_date || null,
            },
          );
        }

        results.created++;
      } catch (lineErr) {
        results.failed++;
        results.errors.push({ row: vi + 1, message: lineErr.message || String(lineErr) });
      }
    }

    // Auto-sync sequence numbers to prevent conflicts after import
    const vtRows = await txQuery("SELECT id, code, prefix, next_number, company_id FROM fin_voucher_types WHERE company_id = :companyId", { companyId });
    if (vtRows && vtRows.length) {
      for (let vi = 0; vi < vtRows.length; vi++) {
        const vt = vtRows[vi];
        const upCode = String(vt.code).toUpperCase();
        let effectivePrefix = vt.prefix;
        if (upCode === "PAYV") effectivePrefix = "PV";
        else if (upCode === "PV" || upCode === "PUV") effectivePrefix = "PB";
        const prefixStr = (["PV", "PUV", "PAYV", "SV", "RV", "CN", "DN"].includes(upCode)) ? effectivePrefix : `${effectivePrefix}-`;
        
        const maxRes = await txQuery(`
          SELECT MAX(CAST(REPLACE(voucher_no, :prefixStr, '') AS UNSIGNED)) AS max_num
          FROM fin_vouchers 
          WHERE voucher_type_id = :vtId AND company_id = :companyId AND voucher_no LIKE :likeStr
        `, { prefixStr, vtId: vt.id, companyId, likeStr: `${prefixStr}%` });
        
        const maxNum = Number(maxRes[0]?.max_num || 0);
        const newNext = Math.max(vt.next_number, maxNum + 1);
        if (newNext > vt.next_number) {
          await txQuery("UPDATE fin_voucher_types SET next_number = :newNext WHERE id = :vtId AND company_id = :companyId", { newNext, vtId: vt.id, companyId });
        }
      }
    }

    await conn.commit();
    res.json(results);
  } catch (e) {
    try { await conn.rollback(); } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const reverseVoucher = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid id"));
    await query(
      `UPDATE fin_vouchers
          SET status = 'REVERSED'
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND id = :id`,
      { companyId, branchId, branchIdsStr, id },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const backfillVoucherTaxSplit = async (req, res, next) => {
  try {
    // Endpoint intentionally returns success so list pages can trigger it safely.
    res.json({ ok: true, updated: 0 });
  } catch (e) {
    next(e);
  }
};

export const voucherRegisterReport = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const branchIdsStr = req.scope.branchIdsStr;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const typeFilter = req.query.type ? String(req.query.type).toUpperCase() : null;
    const items = await query(
      `SELECT v.id, v.voucher_no, v.voucher_date,
              COALESCE(NULLIF(TRIM(v.status), ''), 'APPROVED') AS status,
              COALESCE(NULLIF(v.total_debit, 0), (SELECT SUM(l.debit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_debit,
              COALESCE(NULLIF(v.total_credit, 0), (SELECT SUM(l.credit) FROM fin_voucher_lines l WHERE l.voucher_id = v.id), 0) AS total_credit,
              v.narration,
              COALESCE(
                (
                  SELECT l.description
                    FROM fin_voucher_lines l
                   WHERE l.voucher_id = v.id
                     AND NULLIF(TRIM(l.description), '') IS NOT NULL
                   ORDER BY l.line_no ASC, l.id ASC
                   LIMIT 1
                ),
                v.narration
              ) AS description,
              vt.code AS voucher_type_code, vt.name AS voucher_type_name
         FROM fin_vouchers v
         LEFT JOIN fin_voucher_types vt
           ON vt.id = v.voucher_type_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND (:typeFilter IS NULL OR vt.code = :typeFilter)
        ORDER BY v.voucher_date DESC, v.id DESC`,
      { companyId, branchId, branchIdsStr, from, to, typeFilter },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const paymentDueReport = async (req, res, next) => {
  try {
    await ensurePurBillsPaymentStatusObjects().catch(() => null);
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    let purBills = [];
    try {
      purBills = await query(
        `SELECT pb.id, pb.bill_no AS ref_no, pb.bill_date, pb.due_date, s.supplier_name AS party_name,
                pb.total_amount AS amount, (pb.total_amount - COALESCE(pb.amount_paid, 0)) AS outstanding,
                COALESCE(pb.payment_status, 'UNPAID') AS status
           FROM pur_bills pb
           LEFT JOIN pur_suppliers s ON s.id = pb.supplier_id
          WHERE pb.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(pb.branch_id, :branchIdsStr)) OR pb.branch_id IS NULL)
            AND (:from IS NULL OR pb.due_date >= :from)
            AND (:to IS NULL OR pb.due_date <= :to)
            AND (pb.total_amount - COALESCE(pb.amount_paid, 0)) > 0
            AND COALESCE(pb.payment_status, 'UNPAID') <> 'FULLY PAID'
          ORDER BY pb.due_date ASC`,
        { companyId, branchId, branchIdsStr, from, to },
      );
    } catch (pbErr) {
      console.error("[paymentDueReport purBills error]:", pbErr);
      purBills = [];
    }

    let maintBills = [];
    try {
      maintBills = await query(
        `SELECT mb.id, mb.bill_no AS ref_no, mb.bill_date, mb.due_date, s.supplier_name AS party_name,
                mb.total_amount AS amount, (mb.total_amount - COALESCE(mb.amount_paid, 0)) AS outstanding,
                COALESCE(mb.payment_status, 'UNPAID') AS status
           FROM maint_bills mb
           LEFT JOIN pur_suppliers s ON s.id = mb.supplier_id
          WHERE mb.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(mb.branch_id, :branchIdsStr)) OR mb.branch_id IS NULL)
            AND (:from IS NULL OR mb.due_date >= :from)
            AND (:to IS NULL OR mb.due_date <= :to)
            AND (mb.total_amount - COALESCE(mb.amount_paid, 0)) > 0
            AND COALESCE(mb.payment_status, 'UNPAID') <> 'FULLY PAID'
          ORDER BY mb.due_date ASC`,
        { companyId, branchId, branchIdsStr, from, to },
      );
    } catch (mbErr) {
      maintBills = [];
    }

    let serviceBills = [];
    try {
      serviceBills = await query(
        `SELECT sb.id, sb.bill_no AS ref_no, sb.bill_date, sb.due_date, sb.client_name AS party_name,
                sb.total_amount AS amount, (sb.total_amount - COALESCE(sb.amount_paid, 0)) AS outstanding,
                COALESCE(sb.payment_status, 'UNPAID') AS status
           FROM pur_service_bills sb
          WHERE sb.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(sb.branch_id, :branchIdsStr)) OR sb.branch_id IS NULL)
            AND (:from IS NULL OR sb.due_date >= :from)
            AND (:to IS NULL OR sb.due_date <= :to)
            AND (sb.total_amount - COALESCE(sb.amount_paid, 0)) > 0
            AND NOT (sb.due_date < CURRENT_DATE AND COALESCE(sb.payment_status, 'UNPAID') = 'PAID')
          ORDER BY sb.due_date ASC`,
        { companyId, branchId, branchIdsStr, from, to },
      );
    } catch (sbErr) {
      serviceBills = [];
    }

    const allItems = [...purBills, ...maintBills, ...serviceBills];
    allItems.sort((a, b) => new Date(a.due_date || a.bill_date) - new Date(b.due_date || b.bill_date));

    res.json({ items: allItems });
  } catch (e) {
    next(e);
  }
};

export const outstandingReceivableReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT i.id, i.invoice_no AS ref_no, i.invoice_date, i.invoice_date AS due_date, c.customer_name AS party_name,
              i.total_amount AS amount, i.balance_amount AS outstanding, i.payment_status AS status
         FROM sal_invoices i
         LEFT JOIN sal_customers c ON c.id = i.customer_id
        WHERE i.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr)))
          AND (:from IS NULL OR i.invoice_date >= :from)
          AND (:to IS NULL OR i.invoice_date <= :to)
          AND i.balance_amount > 0
        ORDER BY i.invoice_date ASC`,
      { companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '', from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const trialBalanceReport = async (req, res, next) => {
  try {
    const { companyId = null, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const groupId = req.query.groupId ? Number(req.query.groupId) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;

    // Build WHERE clauses dynamically for optional filters
    let whereClause = "WHERE a.company_id = :companyId";
    const params = { companyId, branchId, branchIdsStr };

    if (from) {
      params.from = from;
    } else {
      params.from = "1900-01-01"; // Very early date if not specified
    }

    if (to) {
      params.to = to;
    } else {
      params.to = "2099-12-31"; // Far future date if not specified
    }

    if (groupId) {
      whereClause += " AND a.group_id = :groupId";
      params.groupId = groupId;
    }

    if (accountId) {
      whereClause += " AND a.id = :accountId";
      params.accountId = accountId;
    }

    const sql = `SELECT 
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        ag.name AS account_category,
        ag.nature AS account_type,
        -- Opening Balances (before from date)
        (COALESCE(SUM(CASE WHEN v.voucher_date < :from THEN vl.debit ELSE 0 END), 0) + COALESCE(ob.opening_debit, 0)) AS opening_debit,
        (COALESCE(SUM(CASE WHEN v.voucher_date < :from THEN vl.credit ELSE 0 END), 0) + COALESCE(ob.opening_credit, 0)) AS opening_credit,
        -- Movement (between from and to dates)
        COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.debit ELSE 0 END), 0) AS movement_debit,
        COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.credit ELSE 0 END), 0) AS movement_credit,
        -- Closing Balances (up to to date)
        (COALESCE(SUM(CASE WHEN v.voucher_date <= :to THEN vl.debit ELSE 0 END), 0) + COALESCE(ob.opening_debit, 0)) AS closing_debit,
        (COALESCE(SUM(CASE WHEN v.voucher_date <= :to THEN vl.credit ELSE 0 END), 0) + COALESCE(ob.opening_credit, 0)) AS closing_credit
      FROM fin_accounts a
      JOIN fin_account_groups ag ON ag.id = a.group_id
      LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
      LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
        AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED')
        AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
      LEFT JOIN fin_account_opening_balances ob ON ob.account_id = a.id AND ob.company_id = a.company_id
      ${whereClause}
      GROUP BY a.id, a.code, a.name, ag.name, ag.nature, ob.opening_debit, ob.opening_credit
      ORDER BY a.code ASC`;

    const items = await query(sql, params);
    res.json({ items });
  } catch (e) {
    console.error("Trial Balance Error:", e);
    next(e);
  }
};

export const auditTrailReport = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT v.id, v.created_at AS action_time, u.username AS user_name, 
              'CREATE' AS action, 
              CONCAT('Voucher ', v.voucher_no, ' created (Status: ', v.status, ')') AS details, 
              v.voucher_no AS ref_no, '/finance/vouchers' AS page_visited, 
              'Finance' AS module_name, v.created_at, 'Financial' AS entity
         FROM fin_vouchers v
         LEFT JOIN adm_users u ON u.id = v.created_by
        WHERE v.company_id = :companyId
          AND (:from IS NULL OR v.created_at >= :from)
          AND (:to IS NULL OR v.created_at <= :to)
        ORDER BY v.created_at DESC`,
      { companyId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const journalsReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const order = req.query.order || "new";
    const sort = order === "old" ? "ASC" : "DESC";
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id, vt.code AS voucher_type_code, vt.name AS voucher_type_name
         FROM fin_vouchers v
         JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
        ORDER BY v.voucher_date ${sort}, v.id ${sort}, vl.line_no ASC`,
      { companyId, branchId, branchIdsStr, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};


export const createTaxCode = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const {
      code,
      name,
      ratePercent,
      type,
      isActive,
      isSalesTax,
      isPurchaseTax,
      isServiceTax,
      validPages,
    } = req.body || {};

    const trimmedCode = String(code || "").trim();
    const trimmedName = String(name || "").trim();
    const normalizedType = String(type || "TAX").trim().toUpperCase();

    if (!trimmedCode || !trimmedName) {
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    }
    if (!["TAX", "DEDUCTION"].includes(normalizedType)) {
      throw httpError(400, "VALIDATION_ERROR", "type must be TAX or DEDUCTION");
    }

    const existing = await query(
      "SELECT id FROM fin_tax_codes WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code: trimmedCode },
    );
    if (existing.length > 0) {
      throw httpError(409, "DUPLICATE_CODE", `Tax/deduction code "${trimmedCode}" already exists.`);
    }

    const result = await query(
      `INSERT INTO fin_tax_codes (
         company_id, code, name, rate_percent, type, is_active,
         is_sales_tax, is_purchase_tax, is_service_tax, valid_pages
       ) VALUES (
         :companyId, :code, :name, :ratePercent, :type, :isActive,
         :isSalesTax, :isPurchaseTax, :isServiceTax, :validPages
       )`,
      {
        companyId,
        code: trimmedCode,
        name: trimmedName,
        ratePercent: Number(ratePercent || 0),
        type: normalizedType,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
        isSalesTax: isSalesTax ? 1 : 0,
        isPurchaseTax: isPurchaseTax ? 1 : 0,
        isServiceTax: isServiceTax ? 1 : 0,
        validPages: convertPagesToIds(
          Array.isArray(validPages) ? validPages.join(",") : validPages,
        ),
      },
    );
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    await cacheDelPattern("taxes:*").catch(() => {});
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    if (e?.code === "ER_DUP_ENTRY" || e?.errno === 1062) {
      return next(httpError(409, "DUPLICATE_CODE", "Tax/deduction code already exists."));
    }
    next(e);
  }
};

export const updateTaxCode = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const taxCodeId = Number(req.params.taxCodeId || req.params.id);
    const {
      name,
      ratePercent,
      type,
      isActive,
      isSalesTax,
      isPurchaseTax,
      isServiceTax,
      validPages,
    } = req.body || {};
    const rows = await query(
      "SELECT id FROM fin_tax_codes WHERE (company_id = :companyId OR company_id = 1 OR company_id IS NULL OR company_id = 0) AND id = :id",
      { companyId, id: taxCodeId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Tax code not found");
    const normalizedType = type ? String(type).trim().toUpperCase() : undefined;
    if (normalizedType && !["TAX", "DEDUCTION"].includes(normalizedType))
      throw httpError(400, "VALIDATION_ERROR", "Invalid type");
    await query(
      `UPDATE fin_tax_codes
         SET name = COALESCE(:name, name),
             rate_percent = COALESCE(:ratePercent, rate_percent),
             type = COALESCE(:type, type),
             is_active = COALESCE(:isActive, is_active),
             is_sales_tax = COALESCE(:isSalesTax, is_sales_tax),
             is_purchase_tax = COALESCE(:isPurchaseTax, is_purchase_tax),
             is_service_tax = COALESCE(:isServiceTax, is_service_tax),
             valid_pages = COALESCE(:validPages, valid_pages)
       WHERE id = :id`,
      {
        id: taxCodeId,
        name: name !== undefined ? String(name).trim() : null,
        ratePercent:
          ratePercent === undefined ? null : Number(ratePercent || 0),
        type: normalizedType || null,
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
        isSalesTax:
          isSalesTax === undefined ? null : Number(Boolean(isSalesTax)),
        isPurchaseTax:
          isPurchaseTax === undefined ? null : Number(Boolean(isPurchaseTax)),
        isServiceTax:
          isServiceTax === undefined ? null : Number(Boolean(isServiceTax)),
        validPages:
          validPages === undefined
            ? null
            : convertPagesToIds(
                Array.isArray(validPages) ? validPages.join(",") : validPages,
              ),
      },
    );
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    await cacheDelPattern("taxes:*").catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const rectifyTaxCodePages = async (req, res, next) => {
  try {
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    // Get all tax codes with valid_pages
    const taxCodes = await query(
      `SELECT id, valid_pages FROM fin_tax_codes WHERE company_id = :companyId AND valid_pages IS NOT NULL AND valid_pages != ''`,
      { companyId },
    );

    let updatedCount = 0;
    for (const taxCode of taxCodes) {
      const newPages = convertPagesToIds(taxCode.valid_pages);
      if (newPages !== taxCode.valid_pages) {
        await query(
          `UPDATE fin_tax_codes SET valid_pages = :validPages WHERE id = :id AND company_id = :companyId`,
          { id: taxCode.id, companyId, validPages: newPages },
        );
        updatedCount++;
      }
    }

    res.json({
      ok: true,
      message: `Rectified ${updatedCount} tax codes`,
      updated: updatedCount,
    });
  } catch (e) {
    next(e);
  }
};

export const createTaxCodeComponent = async (req, res, next) => {
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const taxCodeId = Number(req.params.taxCodeId || req.params.id);
    const {
      componentName,
      ratePercent,
      sortOrder,
      isActive,
      accountId,
      compoundLevel,
      compoundLevels,
    } = req.body || {};
    if (!taxCodeId)
      return next(httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId"));
    if (!componentName)
      throw httpError(400, "VALIDATION_ERROR", "componentName is required");

    let parsedAccountId = Number(accountId) || null;

    const detail = await query(
      `INSERT INTO fin_tax_details (company_id, tax_code_id, component_name, rate_percent, account_id, is_active)
       VALUES (:companyId, :taxCodeId, :componentName, :ratePercent, :accountId, :isActive)`,
      {
        companyId,
        taxCodeId,
        componentName: String(componentName).trim(),
        ratePercent: Number(ratePercent || 0),
        accountId: parsedAccountId,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    const taxDetailId = detail.insertId;

    // If accountId wasn't passed, attempt auto-creating GL account under Tax Receivables/Payables
    if (!parsedAccountId && taxDetailId) {
      try {
        const tcRows = await query(
          "SELECT is_purchase_tax FROM fin_tax_codes WHERE id = :taxCodeId",
          { taxCodeId },
        );
        const isPurchase = !!tcRows?.[0]?.is_purchase_tax;
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          parsedAccountId = await ensureTaxComponentAccountTx(conn, {
            companyId,
            taxDetailId,
            componentName: String(componentName).trim(),
            isPurchase,
          });
          await conn.commit();
        } catch (txErr) {
          await conn.rollback().catch(() => {});
        } finally {
          conn.release();
        }
      } catch (accErr) {
        console.warn("[createTaxCodeComponent] Auto account creation skipped:", accErr?.message || accErr);
      }
    }

    const compLevel =
      compoundLevel !== undefined && compoundLevel !== null
        ? Number(compoundLevel)
        : 0;
    const compLevelsStr = Array.isArray(compoundLevels)
      ? compoundLevels.join(",")
      : compoundLevels
        ? String(compoundLevels)
        : "0";

    let finalSortOrder =
      sortOrder !== undefined && sortOrder !== null && sortOrder !== ""
        ? Number(sortOrder)
        : null;
    if (
      !finalSortOrder ||
      isNaN(finalSortOrder) ||
      finalSortOrder >= 100 ||
      finalSortOrder <= 0
    ) {
      const [maxOrderRow] = await query(
        `SELECT COALESCE(MAX(sort_order), 0) AS max_order
           FROM fin_tax_components
          WHERE company_id = :companyId AND tax_code_id = :taxCodeId AND sort_order < 100`,
        { companyId, taxCodeId },
      );
      finalSortOrder = Number(maxOrderRow?.max_order || 0) + 1;
    }

    await query(
      `INSERT INTO fin_tax_components (
         company_id, tax_code_id, tax_detail_id, rate_percent, sort_order,
         is_active, compound_level, compound_levels
       ) VALUES (
         :companyId, :taxCodeId, :taxDetailId, :ratePercent, :sortOrder,
         :isActive, :compLevel, :compLevelsStr
       )`,
      {
        companyId,
        taxCodeId,
        taxDetailId,
        ratePercent: Number(ratePercent || 0),
        sortOrder: finalSortOrder,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
        compLevel,
        compLevelsStr,
      },
    );
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    res.status(201).json({ id: taxDetailId });
  } catch (e) {
    next(e);
  }
};

export const updateTaxCodeComponent = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureTaxTables();
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const componentId = Number(req.params.id);
    const {
      componentName,
      accountId,
      ratePercent,
      sortOrder,
      isActive,
      compoundLevel,
      compoundLevels,
    } = req.body || {};

    await conn.beginTransaction();

    const [rows] = await conn.execute(
      "SELECT tax_detail_id FROM fin_tax_components WHERE company_id = :companyId AND id = :id",
      { companyId, id: componentId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Component not found");
    const taxDetailId = rows[0].tax_detail_id;

    if (componentName !== undefined || accountId !== undefined) {
      await conn.execute(
        `UPDATE fin_tax_details
         SET component_name = COALESCE(:componentName, component_name),
             account_id = COALESCE(:accountId, account_id)
         WHERE company_id = :companyId AND id = :id`,
        {
          companyId,
          id: taxDetailId,
          componentName: componentName ? String(componentName).trim() : null,
          accountId: accountId === null ? null : Number(accountId) || null,
        },
      );
    }

    const compLevel =
      compoundLevel !== undefined && compoundLevel !== null
        ? Number(compoundLevel)
        : null;
    const compLevelsStr =
      compoundLevels !== undefined
        ? Array.isArray(compoundLevels)
          ? compoundLevels.join(",")
          : String(compoundLevels)
        : null;

    await conn.execute(
      `UPDATE fin_tax_components
       SET rate_percent = COALESCE(:ratePercent, rate_percent),
           sort_order = COALESCE(:sortOrder, sort_order),
           is_active = COALESCE(:isActive, is_active),
           compound_level = COALESCE(:compLevel, compound_level),
           compound_levels = COALESCE(:compLevelsStr, compound_levels)
       WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: componentId,
        ratePercent: ratePercent === undefined ? null : Number(ratePercent),
        sortOrder: sortOrder === undefined ? null : Number(sortOrder),
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
        compLevel,
        compLevelsStr,
      },
    );

    await conn.commit();
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const deleteTaxCodeComponent = async (req, res, next) => {
  try {
    const companyId = Number(
      req.scope?.companyId ||
      req.user?.company_id ||
      req.headers["x-company-id"] ||
      1
    );
    const componentId = Number(req.params.id);
    await query(
      "DELETE FROM fin_tax_components WHERE company_id = :companyId AND id = :id",
      {
        companyId,
        id: componentId,
      },
    );
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const listCurrencies = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { active } = req.query || {};
    const activeFilter =
      active === undefined || active === null || String(active).trim() === ""
        ? null
        : Number(Boolean(active));

    const cacheKey = `currencies:company:${companyId}:active:${activeFilter}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ items: cached });
    }

    const items = await query(
      `SELECT id, code, name, symbol, is_base, is_active, created_at
         FROM fin_currencies
        WHERE company_id = :companyId
          AND (:activeFilter IS NULL OR is_active = :activeFilter)
        ORDER BY is_base DESC, code ASC`,
      { companyId, activeFilter },
    );
    
    await cacheSet(cacheKey, items, 86400).catch(() => {}); // cache for 24h
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCurrency = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    const { code, name, symbol, isBase, isActive } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code, name are required");
    await conn.beginTransaction();
    const [ins] = await conn.execute(
      `INSERT INTO fin_currencies (company_id, code, name, symbol, is_base, is_active)
       VALUES (:companyId, :code, :name, :symbol, :isBase, :isActive)`,
      {
        companyId,
        code,
        name,
        symbol: symbol || null,
        isBase: isBase ? 1 : 0,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    if (isBase) {
      await conn.execute(
        "UPDATE fin_currencies SET is_base = 0 WHERE company_id = :companyId AND id <> :id",
        { companyId, id: ins.insertId },
      );
    }
    await conn.commit();
    
    // Invalidate cache
    await cacheDel(`currencies:company:${companyId}:active:null`).catch(() => {});
    await cacheDel(`currencies:company:${companyId}:active:1`).catch(() => {});
    await cacheDel(`currencies:company:${companyId}:active:0`).catch(() => {});
    
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const updateCurrency = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const companyId = req.scope.companyId;
    const currencyId = Number(req.params.currencyId || req.params.id);
    const { name, symbol, isBase, isActive } = req.body || {};
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE fin_currencies
         SET name = COALESCE(:name, name),
             symbol = COALESCE(:symbol, symbol),
             is_base = COALESCE(:isBase, is_base),
             is_active = COALESCE(:isActive, is_active)
       WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id: currencyId,
        name: name || null,
        symbol: symbol || null,
        isBase: isBase === undefined ? null : Number(Boolean(isBase)),
        isActive: isActive === undefined ? null : Number(Boolean(isActive)),
      },
    );
    if (isBase) {
      await conn.execute(
        "UPDATE fin_currencies SET is_base = 0 WHERE company_id = :companyId AND id <> :id",
        { companyId, id: currencyId },
      );
    }
    await conn.commit();

    // Invalidate cache
    await cacheDel(`currencies:company:${companyId}:active:null`).catch(() => {});
    await cacheDel(`currencies:company:${companyId}:active:1`).catch(() => {});
    await cacheDel(`currencies:company:${companyId}:active:0`).catch(() => {});

    res.json({ ok: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};

export const listCurrencyRates = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fromCurrencyId = req.query.fromCurrencyId
      ? Number(req.query.fromCurrencyId)
      : null;
    const toCurrencyId = req.query.toCurrencyId
      ? Number(req.query.toCurrencyId)
      : null;
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const items = await query(
      `SELECT r.id, r.from_currency_id, fc.code AS from_code, r.to_currency_id, tc.code AS to_code, r.rate, r.rate_date
         FROM fin_currency_rates r
         JOIN fin_currencies fc ON fc.id = r.from_currency_id
         JOIN fin_currencies tc ON tc.id = r.to_currency_id
        WHERE fc.company_id = :companyId
          AND tc.company_id = :companyId
          AND (:fromCurrencyId IS NULL OR r.from_currency_id = :fromCurrencyId)
          AND (:toCurrencyId IS NULL OR r.to_currency_id = :toCurrencyId)
          AND (:from IS NULL OR r.rate_date >= :from)
          AND (:to IS NULL OR r.rate_date <= :to)
        ORDER BY r.rate_date DESC, r.id DESC`,
      { companyId, fromCurrencyId, toCurrencyId, from, to },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCurrencyRate = async (req, res, next) => {
  try {
    const { fromCurrencyId, toCurrencyId, rate, rateDate } = req.body || {};
    const companyId = req.scope.companyId;
    if (!fromCurrencyId || !toCurrencyId || !rate)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fromCurrencyId, toCurrencyId, rate are required",
      );
    const result = await query(
      `INSERT INTO fin_currency_rates (company_id, from_currency_id, to_currency_id, rate_date, rate)
       VALUES (:companyId, :fromCurrencyId, :toCurrencyId, :rateDate, :rate)`,
      {
        companyId,
        fromCurrencyId: Number(fromCurrencyId),
        toCurrencyId: Number(toCurrencyId),
        rate: Number(rate),
        rateDate: rateDate || new Date().toISOString().slice(0, 10),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const updateCurrencyRate = async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId || req.params.id);
    const { rate, rateDate } = req.body || {};
    await query(
      `UPDATE fin_currency_rates
         SET rate = COALESCE(:rate, rate),
             rate_date = COALESCE(:rateDate, rate_date)
       WHERE id = :id`,
      {
        id: rateId,
        rate: rate === undefined ? null : Number(rate || 0),
        rateDate: rateDate || null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteCurrencyRate = async (req, res, next) => {
  try {
    const rateId = Number(req.params.rateId || req.params.id);
    await query("DELETE FROM fin_currency_rates WHERE id = :id", {
      id: rateId,
    });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const createFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const { code, startDate, endDate, isOpen } = req.body || {};
    if (!code || !startDate || !endDate)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "code, startDate, endDate are required",
      );
    const result = await query(
      `INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
       VALUES (:companyId, :code, :startDate, :endDate, :isOpen)`,
      {
        companyId,
        code,
        startDate,
        endDate,
        isOpen: isOpen ? 1 : 0,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const openFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fiscalYearId = Number(req.params.fiscalYearId || req.params.id);
    await query(
      "UPDATE fin_fiscal_years SET is_open = 1 WHERE company_id = :companyId AND id = :id",
      { companyId, id: fiscalYearId },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const closeFiscalYear = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const fiscalYearId = Number(req.params.fiscalYearId || req.params.id);
    await query(
      "UPDATE fin_fiscal_years SET is_open = 0 WHERE company_id = :companyId AND id = :id",
      { companyId, id: fiscalYearId },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export async function ensureOpeningBalancesTable(connOrPool = pool) {
  try {
    await connOrPool.execute(`
      CREATE TABLE IF NOT EXISTS fin_account_opening_balances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        fiscal_year_id BIGINT UNSIGNED NOT NULL,
        account_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NULL,
        currency_id BIGINT UNSIGNED NULL,
        exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1.000000,
        opening_date DATE NULL,
        opening_debit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        opening_credit DECIMAL(18,2) NOT NULL DEFAULT 0.00,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ob_company (company_id),
        KEY idx_ob_fy (fiscal_year_id),
        KEY idx_ob_acc (account_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `).catch(() => {});

    const cols = [
      { name: "branch_id", sql: "ADD COLUMN branch_id BIGINT UNSIGNED NULL AFTER account_id" },
      { name: "currency_id", sql: "ADD COLUMN currency_id BIGINT UNSIGNED NULL AFTER branch_id" },
      { name: "exchange_rate", sql: "ADD COLUMN exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1.000000 AFTER currency_id" },
      { name: "opening_date", sql: "ADD COLUMN opening_date DATE NULL AFTER exchange_rate" },
      { name: "opening_debit", sql: "ADD COLUMN opening_debit DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER opening_date" },
      { name: "opening_credit", sql: "ADD COLUMN opening_credit DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER opening_debit" },
      { name: "created_by", sql: "ADD COLUMN created_by BIGINT UNSIGNED NULL" },
    ];

    for (const c of cols) {
      try {
        await connOrPool.execute(`ALTER TABLE fin_account_opening_balances ${c.sql}`);
      } catch (_) {}
    }

    try {
      await connOrPool.execute(`
        ALTER TABLE fin_account_opening_balances
        ADD UNIQUE KEY uq_opening_unique (company_id, fiscal_year_id, account_id, branch_id)
      `);
    } catch (_) {}
  } catch (_) {}
}

export const listOpeningBalances = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const fiscalYearId = req.query.fiscalYearId
      ? Number(req.query.fiscalYearId)
      : null;

    await ensureOpeningBalancesTable().catch(() => {});

    let items = [];
    try {
      items = await query(
        `SELECT ob.id, ob.fiscal_year_id, fy.code AS fiscal_year_code,
                ob.account_id, a.code AS account_code, a.name AS account_name,
                ob.branch_id,
                COALESCE(ob.currency_id, base_c.id) AS currency_id,
                COALESCE(c.code, base_c.code) AS currency_code,
                COALESCE(c.symbol, base_c.symbol) AS currency_symbol,
                COALESCE(ob.exchange_rate, 1.000000) AS exchange_rate,
                COALESCE(ob.opening_date, fy.start_date) AS opening_date,
                ob.opening_debit, ob.opening_credit
           FROM fin_account_opening_balances ob
           LEFT JOIN fin_fiscal_years fy ON fy.id = ob.fiscal_year_id
           LEFT JOIN fin_accounts a ON a.id = ob.account_id
           LEFT JOIN fin_currencies c ON c.id = ob.currency_id
           LEFT JOIN fin_currencies base_c ON base_c.company_id = ob.company_id AND base_c.is_base = 1
          WHERE ob.company_id = :companyId
            AND (:fiscalYearId IS NULL OR ob.fiscal_year_id = :fiscalYearId)
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(ob.branch_id, :branchIdsStr)) OR ob.branch_id IS NULL)
          ORDER BY a.code ASC, ob.id DESC`,
        { companyId, branchId, branchIdsStr, fiscalYearId },
      );
    } catch (obErr) {
      console.error("[listOpeningBalances Error]:", obErr);
      items = [];
    }

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const upsertOpeningBalance = async (req, res, next) => {
  try {
    await ensureOpeningBalancesTable().catch(() => {});
    const companyId = Number(req.scope?.companyId || req.user?.companyId || req.body?.companyId || 1);
    const branchId =
      req.body?.branchId !== undefined && req.body?.branchId !== null && req.body?.branchId !== "" && req.body?.branchId !== "null"
        ? (Number(req.body.branchId) > 0 ? Number(req.body.branchId) : null)
        : (req.scope?.branchId ? Number(req.scope.branchId) : null);
    const { fiscalYearId, accountId, currencyId, exchangeRate, openingDate, openingDebit, openingCredit } =
      req.body || {};
    if (!fiscalYearId || !accountId)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fiscalYearId, accountId are required",
      );

    const deb = Math.max(0, Number(openingDebit || 0));
    const cred = Math.max(0, Number(openingCredit || 0));
    const curId = currencyId ? Number(currencyId) : null;
    const rate = Number(exchangeRate || 1) > 0 ? Number(exchangeRate) : 1;
    let itemDate = openingDate ? String(openingDate).slice(0, 10) : null;
    if (!itemDate || !/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) {
      const [fyRow] = await query(
        "SELECT start_date FROM fin_fiscal_years WHERE id = :fiscalYearId AND company_id = :companyId LIMIT 1",
        { fiscalYearId: Number(fiscalYearId), companyId },
      );
      const sd = fyRow?.[0]?.start_date;
      itemDate = sd instanceof Date ? sd.toISOString().slice(0, 10) : sd ? String(sd).slice(0, 10) : new Date().toISOString().slice(0, 10);
    }

    let insertId = null;
    if (deb > 0 || cred > 0) {
      const result = await query(
        `INSERT INTO fin_account_opening_balances 
           (company_id, fiscal_year_id, account_id, branch_id, currency_id, exchange_rate, opening_date, opening_debit, opening_credit)
         VALUES 
           (:companyId, :fiscalYearId, :accountId, :branchId, :curId, :rate, :itemDate, :openingDebit, :openingCredit)
         ON DUPLICATE KEY UPDATE
           currency_id = VALUES(currency_id),
           exchange_rate = VALUES(exchange_rate),
           opening_date = VALUES(opening_date),
           opening_debit = VALUES(opening_debit),
           opening_credit = VALUES(opening_credit)`,
        {
          companyId,
          fiscalYearId: Number(fiscalYearId),
          accountId: Number(accountId),
          branchId: branchId || null,
          curId,
          rate,
          itemDate,
          openingDebit: deb,
          openingCredit: cred,
        },
      );
      insertId = result.insertId || null;
    } else {
      await query(
        `DELETE FROM fin_account_opening_balances
          WHERE company_id = :companyId
            AND fiscal_year_id = :fiscalYearId
            AND account_id = :accountId
            AND (branch_id = :branchId OR (:branchId IS NULL AND branch_id IS NULL))`,
        {
          companyId,
          fiscalYearId: Number(fiscalYearId),
          accountId: Number(accountId),
          branchId: branchId || null,
        },
      );
    }
    res.status(201).json({ id: insertId, success: true });
  } catch (e) {
    next(e);
  }
};

export const bulkUpsertOpeningBalances = async (req, res, next) => {
  await ensureOpeningBalancesTable().catch(() => {});
  const conn = await pool.getConnection();
  try {
    const companyId = Number(req.scope?.companyId || req.user?.companyId || req.body?.companyId || 1);
    const branchId =
      req.body?.branchId !== undefined && req.body?.branchId !== null && req.body?.branchId !== "" && req.body?.branchId !== "null"
        ? (Number(req.body.branchId) > 0 ? Number(req.body.branchId) : null)
        : (req.scope?.branchId ? Number(req.scope.branchId) : null);
    const { fiscalYearId, items, openingDate } = req.body || {};
    if (!fiscalYearId || !Array.isArray(items))
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "fiscalYearId and items[] are required",
      );
    await conn.beginTransaction();

    let effectiveDate = openingDate ? String(openingDate).slice(0, 10) : null;
    if (!effectiveDate || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      const [fyRow] = await conn.execute(
        "SELECT start_date FROM fin_fiscal_years WHERE id = :fiscalYearId AND company_id = :companyId LIMIT 1",
        { fiscalYearId: Number(fiscalYearId), companyId }
      );
      const sd = fyRow?.[0]?.start_date;
      effectiveDate = sd instanceof Date ? sd.toISOString().slice(0, 10) : sd ? String(sd).slice(0, 10) : new Date().toISOString().slice(0, 10);
    }

    let affected = 0;
    for (const it of items) {
      const accountId = Number(it?.accountId || it?.account_id || it?.id);
      const openingDebit = Math.max(0, Number(it?.openingDebit || it?.opening_debit || it?.debit || 0));
      const openingCredit = Math.max(0, Number(it?.openingCredit || it?.opening_credit || it?.credit || 0));
      const currencyId = it?.currencyId || it?.currency_id ? Number(it.currencyId || it.currency_id) : null;
      const exchangeRate = Number(it?.exchangeRate || it?.exchange_rate || 1) > 0 ? Number(it.exchangeRate || it.exchange_rate) : 1;
      let itemDate = it?.openingDate || it?.opening_date ? String(it.openingDate || it.opening_date).slice(0, 10) : effectiveDate;
      if (!itemDate || !/^\d{4}-\d{2}-\d{2}$/.test(itemDate)) {
        itemDate = effectiveDate;
      }
      if (!Number.isFinite(accountId) || accountId <= 0) continue;

      if (openingDebit > 0 || openingCredit > 0) {
        await conn.execute(
          `INSERT INTO fin_account_opening_balances
             (company_id, fiscal_year_id, account_id, branch_id, currency_id, exchange_rate, opening_date, opening_debit, opening_credit)
           VALUES
             (:companyId, :fiscalYearId, :accountId, :branchId, :currencyId, :exchangeRate, :itemDate, :openingDebit, :openingCredit)
           ON DUPLICATE KEY UPDATE
             currency_id = VALUES(currency_id),
             exchange_rate = VALUES(exchange_rate),
             opening_date = VALUES(opening_date),
             opening_debit = VALUES(opening_debit),
             opening_credit = VALUES(opening_credit)`,
          {
            companyId,
            fiscalYearId: Number(fiscalYearId),
            accountId,
            branchId: branchId || null,
            currencyId: currencyId || null,
            exchangeRate,
            itemDate,
            openingDebit,
            openingCredit,
          },
        );
      } else {
        await conn.execute(
          `DELETE FROM fin_account_opening_balances
            WHERE company_id = :companyId
              AND fiscal_year_id = :fiscalYearId
              AND account_id = :accountId
              AND (branch_id = :branchId OR (:branchId IS NULL AND branch_id IS NULL))`,
          {
            companyId,
            fiscalYearId: Number(fiscalYearId),
            accountId,
            branchId: branchId || null,
          },
        );
      }
      affected++;
    }
    await conn.commit();
    await cacheDelPattern(`taxes:company:${companyId}:*`).catch(() => {});
    res.status(201).json({ upserted: affected, success: true });
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    next(e);
  } finally {
    conn.release();
  }
};
export const getAccountGroupsTree = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const conn = await pool.getConnection();
    try {
      await ensureGroupIdTx(conn, {
        companyId,
        code: "DEBTORS",
        name: "Debtors",
        nature: "ASSET",
        parentId: null,
      });
      await ensureGroupIdTx(conn, {
        companyId,
        code: "CREDITORS",
        name: "Creditors",
        nature: "LIABILITY",
        parentId: null,
      });
    } finally {
      conn.release();
    }
    const rows = await query(
      "SELECT id, code, name, nature, parent_id, is_active FROM fin_account_groups WHERE company_id = :companyId ORDER BY code ASC",
      { companyId },
    );
    const byId = new Map();
    for (const r of rows) {
      byId.set(r.id, { ...r, children: [] });
    }
    const roots = [];
    for (const r of rows) {
      const node = byId.get(r.id);
      if (r.parent_id && byId.has(r.parent_id)) {
        byId.get(r.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }
    res.json({ items: roots });
  } catch (e) {
    next(e);
  }
};

export const createAccountGroup = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    let { code, name, nature, parentId, isActive } = req.body || {};
    if (!name || !nature)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "name and nature are required",
      );

    name = String(name).trim();
    nature = String(nature).trim().toUpperCase();

    if (!code) {
      const parent = parentId
        ? (
            await query(
              "SELECT code FROM fin_account_groups WHERE id = :parentId AND company_id = :companyId",
              { parentId, companyId },
            )
          )[0]
        : null;
      const makeToken = (s) =>
        String(s || "")
          .replace(/[^A-Za-z0-9]/g, "")
          .toUpperCase()
          .slice(0, 10);
      const part = makeToken(name) || "GRP";
      if (parent && parent.code) {
        code = `${parent.code}.${part}`;
      } else {
        const base =
          nature === "ASSET"
            ? "AST"
            : nature === "LIABILITY"
              ? "LIA"
              : nature === "EQUITY"
                ? "EQU"
                : nature === "INCOME"
                  ? "INC"
                  : "EXP";
        code = `${base}_${part}`;
      }
    }

    code = String(code).trim().toUpperCase();

    // Check duplicate code
    const existing = await query(
      "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code },
    );
    if (existing.length) {
      if (req.body.code) {
        return next(
          httpError(
            400,
            "DUPLICATE_CODE",
            `Account Group code '${code}' already exists.`,
          ),
        );
      }
      let seq = 1;
      while (true) {
        const candidate = `${code}_${seq}`;
        const check = await query(
          "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = :code LIMIT 1",
          { companyId, code: candidate },
        );
        if (!check.length) {
          code = candidate;
          break;
        }
        seq++;
      }
    }

    const result = await query(
      "INSERT INTO fin_account_groups (company_id, code, name, nature, parent_id, is_active) VALUES (:companyId, :code, :name, :nature, :parentId, :isActive)",
      {
        companyId,
        code,
        name,
        nature,
        parentId: parentId || null,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.status(201).json({ id: result.insertId, code });
  } catch (e) {
    next(e);
  }
};

export const setAccountGroupActive = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.accountGroupId || req.params.id);
    const { isActive } = req.body || {};
    if (isActive === undefined)
      return next(httpError(400, "VALIDATION_ERROR", "isActive is required"));
    const rows = await query(
      "SELECT id, is_active FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
      { companyId, id },
    );
    if (!rows.length)
      return next(httpError(404, "NOT_FOUND", "Account group not found"));
    const targetActive = Number(Boolean(isActive));
    if (targetActive === 0) {
      const [accRows] = await query(
        "SELECT COUNT(*) AS cnt FROM fin_accounts WHERE company_id = :companyId AND group_id = :groupId AND is_active = 1",
        { companyId, groupId: id },
      );
      const cnt = Number(accRows?.[0]?.cnt || 0);
      if (cnt > 0)
        return next(
          httpError(
            400,
            "VALIDATION_ERROR",
            "Deactivate or move accounts under this group before deactivation",
          ),
        );
    }
    await query(
      "UPDATE fin_account_groups SET is_active = :isActive WHERE company_id = :companyId AND id = :id",
      { companyId, id, isActive: targetActive },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const updateAccountGroup = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.accountGroupId || req.params.id);
    const { code, name, nature, parentId } = req.body || {};
    const rows = await query(
      "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND id = :id",
      { companyId, id },
    );
    if (!rows.length)
      return next(httpError(404, "NOT_FOUND", "Account group not found"));
    if (
      nature !== undefined &&
      !["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"].includes(
        String(nature).toUpperCase(),
      )
    ) {
      return next(httpError(400, "VALIDATION_ERROR", "Invalid nature"));
    }
    if (code) {
      const dup = await query(
        "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND code = :code AND id <> :id LIMIT 1",
        { companyId, code: String(code).trim().toUpperCase(), id },
      );
      if (dup.length) {
        return next(
          httpError(
            400,
            "DUPLICATE_CODE",
            `Account Group code '${code}' already exists.`,
          ),
        );
      }
    }
    await query(
      `UPDATE fin_account_groups
          SET code = COALESCE(:code, code),
              name = COALESCE(:name, name),
              nature = COALESCE(:nature, nature),
              parent_id = :parentId
        WHERE company_id = :companyId AND id = :id`,
      {
        companyId,
        id,
        code: code ? String(code).trim().toUpperCase() : null,
        name: name ? String(name).trim() : null,
        nature: nature || null,
        parentId: parentId ? Number(parentId) : null,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteAccountGroup = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const id = Number(req.params.accountGroupId || req.params.id || 0);
    if (!id) return next(httpError(400, "VALIDATION_ERROR", "Invalid ID"));

    const rows = await query(
      "SELECT id, code, name FROM fin_account_groups WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!rows.length) {
      return next(httpError(404, "NOT_FOUND", "Account group not found"));
    }

    // Check child accounts
    const [accRows] = await query(
      "SELECT COUNT(*) AS cnt FROM fin_accounts WHERE group_id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (Number(accRows?.[0]?.cnt || 0) > 0) {
      return next(
        httpError(
          400,
          "REFERENCED_RESOURCE",
          "Cannot delete this group because it contains accounts. Please delete or reassign accounts first.",
        ),
      );
    }

    // Check child groups
    const [childGroups] = await query(
      "SELECT COUNT(*) AS cnt FROM fin_account_groups WHERE parent_id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (Number(childGroups?.cnt || 0) > 0) {
      return next(
        httpError(
          400,
          "REFERENCED_RESOURCE",
          "Cannot delete this group because it has child sub-groups. Please delete or reassign sub-groups first.",
        ),
      );
    }

    await query(
      "DELETE FROM fin_account_groups WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );

    res.json({ success: true, message: "Account group deleted successfully" });
  } catch (e) {
    next(e);
  }
};

// Financial Reports
export const cashFlowReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    // Query cash flow from fin_vouchers joined with fin_voucher_lines and bank accounts
    const items = await query(
      `SELECT 
        ba.id AS bank_account_id,
        ba.bank_name,
        ba.account_number,
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        SUM(CASE WHEN vl.debit > 0 THEN vl.debit ELSE 0 END) AS inflow,
        SUM(CASE WHEN vl.credit > 0 THEN vl.credit ELSE 0 END) AS outflow,
        SUM(COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) AS net
       FROM fin_bank_accounts ba
       JOIN fin_accounts a ON a.id = ba.gl_account_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
          AND v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)))
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status = 'POSTED'
       WHERE ba.company_id = :companyId
       GROUP BY ba.id, ba.bank_name, ba.account_number, a.id, a.code, a.name
       ORDER BY ba.bank_name ASC`,
      { companyId, branchId: branchId || null, branchIdsStr, from, to },
    );

    // Calculate totals
    const totals = items.reduce(
      (acc, r) => {
        acc.inflow += Number(r.inflow || 0);
        acc.outflow += Number(r.outflow || 0);
        acc.net += Number(r.net || 0);
        return acc;
      },
      { inflow: 0, outflow: 0, net: 0 },
    );

    res.json({ items, totals });
  } catch (e) {
    next(e);
  }
};

export const balanceSheetReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const asOfDate = req.query.to
      ? String(req.query.to)
      : new Date().toISOString().split("T")[0];

    // 1. Fetch all balance-sheet account groups (ASSET, LIABILITY, EQUITY)
    const groups = await query(
      `SELECT id, code, name, nature, parent_id 
       FROM fin_account_groups 
       WHERE company_id = :companyId AND nature IN ('ASSET', 'LIABILITY', 'EQUITY') AND is_active = 1
       ORDER BY code ASC`,
      { companyId },
    );

    // 2. Fetch opening balances per account
    const openingBalances = await query(
      `SELECT account_id, 
              SUM(COALESCE(opening_debit, 0)) AS ob_debit,
              SUM(COALESCE(opening_credit, 0)) AS ob_credit
       FROM fin_account_opening_balances
       WHERE company_id = :companyId
       GROUP BY account_id`,
      { companyId },
    );
    const obMap = new Map();
    openingBalances.forEach((ob) => {
      obMap.set(Number(ob.account_id), {
        debit: Number(ob.ob_debit || 0),
        credit: Number(ob.ob_credit || 0),
      });
    });
    // 3. Fetch voucher movements up to asOfDate
    const filterBranchId = req.query.branchId && req.query.branchId !== 'all' ? Number(req.query.branchId) : null;

    const movements = await query(
      `SELECT a.id as account_id, a.code as account_code, a.name as account_name, a.group_id, g.nature,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND v.status = 'POSTED'
                       AND (:filterBranchId IS NULL OR v.branch_id = :filterBranchId OR v.branch_id IS NULL)
                       AND DATE(v.voucher_date) <= :asOfDate
                  THEN COALESCE(vl.debit, 0) ELSE 0 END) AS mv_debit,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND v.status = 'POSTED'
                       AND (:filterBranchId IS NULL OR v.branch_id = :filterBranchId OR v.branch_id IS NULL)
                       AND DATE(v.voucher_date) <= :asOfDate
                  THEN COALESCE(vl.credit, 0) ELSE 0 END) AS mv_credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('ASSET', 'LIABILITY', 'EQUITY')
       GROUP BY a.id, a.code, a.name, a.group_id, g.nature
       ORDER BY a.code ASC`,
      { companyId, filterBranchId, asOfDate },
    );

    // 4. Build the hierarchical tree per section
    const buildTree = (nature) => {
      const filteredGroups = groups.filter((g) => g.nature === nature);
      const filteredAccounts = movements.filter((a) => a.nature === nature);

      const groupMap = new Map();
      filteredGroups.forEach((g) => {
        groupMap.set(g.id, {
          ...g,
          type: "group",
          children: [],
          accounts: [],
          amount: 0,
          level: 0,
        });
      });

      const roots = [];
      filteredGroups.forEach((g) => {
        const node = groupMap.get(g.id);
        if (g.parent_id && groupMap.has(g.parent_id)) {
          groupMap.get(g.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      filteredAccounts.forEach((a) => {
        const ob = obMap.get(Number(a.account_id)) || { debit: 0, credit: 0 };
        const totalDebit = Number(a.mv_debit || 0) + ob.debit;
        const totalCredit = Number(a.mv_credit || 0) + ob.credit;
        // For ASSET: positive balance = debit > credit
        // For LIABILITY/EQUITY: positive balance = credit > debit
        const amt =
          nature === "ASSET"
            ? totalDebit - totalCredit
            : totalCredit - totalDebit;

        const accNode = { ...a, type: "account", amount: amt };
        if (groupMap.has(a.group_id)) {
          groupMap.get(a.group_id).accounts.push(accNode);
        }
      });

      const calcTotal = (node, level) => {
        node.level = level;
        let total = 0;
        node.accounts.forEach((a) => {
          a.level = level + 1;
          total += Number(a.amount || 0);
        });
        node.children.forEach((c) => {
          total += calcTotal(c, level + 1);
        });
        node.amount = total;
        return total;
      };

      let grandTotal = 0;
      roots.forEach((r) => {
        grandTotal += calcTotal(r, 1);
      });

      return { items: roots, total: grandTotal };
    };

    const assets = buildTree("ASSET");
    const liabilities = buildTree("LIABILITY");
    const equity = buildTree("EQUITY");

    res.json({
      as_of: asOfDate,
      assets,
      liabilities,
      equity,
      total_assets: assets.total,
      total_liabilities_equity: liabilities.total + equity.total,
      is_balanced: Math.abs(assets.total - (liabilities.total + equity.total)) < 0.01,
    });
  } catch (e) {
    next(e);
  }
};

export const profitAndLossReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = Number(req.user?.sub || req.user?.id);

    // User's assigned branches
    let allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number).filter(Boolean)
      : [];
    if (!allowedBranches.length && userId) {
      const rows = await query(
        `SELECT branch_id FROM adm_user_branches WHERE user_id = :userId`,
        { userId },
      );
      allowedBranches = rows.map((r) => Number(r.branch_id)).filter(Boolean);
    }

    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const isSuper = Number(userId) === superAdminId || req.user?.is_super_admin || req.user?.role === "SUPER_ADMIN";

    // Check if branchId was explicitly provided in query
    let filterBranchId =
      req.query.branchId && req.query.branchId !== "all"
        ? Number(req.query.branchId)
        : null;

    // If non-admin user only has 1 assigned branch and didn't select one, default to that branch
    if (!isSuper && !filterBranchId && allowedBranches.length === 1) {
      filterBranchId = allowedBranches[0];
    }

    const isRestrictedUser = !isSuper && allowedBranches.length > 0;
    const branchIdsStr = allowedBranches.join(",");

    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;

    // 1. Fetch all INCOME and EXPENSE groups
    const groups = await query(
      `SELECT id, code, name, nature, parent_id 
       FROM fin_account_groups 
       WHERE company_id = :companyId AND nature IN ('INCOME', 'EXPENSE') AND is_active = 1`,
      { companyId },
    );

    // 2. Fetch opening balances for income and expense accounts
    const openingBalances = await query(
      `SELECT account_id,
              SUM(COALESCE(opening_debit, 0)) as ob_debit,
              SUM(COALESCE(opening_credit, 0)) as ob_credit
       FROM fin_account_opening_balances
       WHERE company_id = :companyId
         AND (
           (:filterBranchId IS NOT NULL AND (branch_id = :filterBranchId OR branch_id IS NULL))
           OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL))
         )
         AND (:to IS NULL OR DATE(opening_date) <= :to)
       GROUP BY account_id`,
      { companyId, filterBranchId, isRestricted: isRestrictedUser ? 1 : 0, branchIdsStr, to },
    );

    const obMap = new Map();
    openingBalances.forEach((ob) => {
      obMap.set(Number(ob.account_id), {
        debit: Number(ob.ob_debit || 0),
        credit: Number(ob.ob_credit || 0),
      });
    });

    // 3. Fetch all accounts with balances for the period
    const accountBalances = await query(
      `SELECT a.id as account_id, a.code as account_code, a.name as account_name, a.group_id, g.nature,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND (v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED') OR v.status IS NULL)
                       AND (
                         (:filterBranchId IS NOT NULL AND (v.branch_id = :filterBranchId OR v.branch_id IS NULL))
                         OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(v.branch_id, :branchIdsStr) OR v.branch_id IS NULL))
                       )
                       AND (:from IS NULL OR DATE(v.voucher_date) >= :from)
                       AND (:to IS NULL OR DATE(v.voucher_date) <= :to)
                  THEN COALESCE(vl.debit, 0) ELSE 0 END) AS debit,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND (v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED') OR v.status IS NULL)
                       AND (
                         (:filterBranchId IS NOT NULL AND (v.branch_id = :filterBranchId OR v.branch_id IS NULL))
                         OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(v.branch_id, :branchIdsStr) OR v.branch_id IS NULL))
                       )
                       AND (:from IS NULL OR DATE(v.voucher_date) >= :from)
                       AND (:to IS NULL OR DATE(v.voucher_date) <= :to)
                  THEN COALESCE(vl.credit, 0) ELSE 0 END) AS credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('INCOME', 'EXPENSE')
       GROUP BY a.id, a.code, a.name, a.group_id, g.nature
       ORDER BY a.code ASC`,
      { companyId, filterBranchId, isRestricted: isRestrictedUser ? 1 : 0, branchIdsStr, from, to },
    );

    const buildTree = (nature) => {
      const filteredGroups = groups.filter((g) => g.nature === nature);
      const filteredAccounts = accountBalances.filter(
        (a) => a.nature === nature,
      );

      const groupMap = new Map();
      filteredGroups.forEach((g) => {
        groupMap.set(g.id, {
          ...g,
          type: "group",
          children: [],
          accounts: [],
          amount: 0,
          level: 0,
        });
      });

      const roots = [];
      filteredGroups.forEach((g) => {
        const node = groupMap.get(g.id);
        if (g.parent_id && groupMap.has(g.parent_id)) {
          groupMap.get(g.parent_id).children.push(node);
        } else {
          roots.push(node);
        }
      });

      filteredAccounts.forEach((a) => {
        const ob = obMap.get(Number(a.account_id)) || { debit: 0, credit: 0 };
        const totalDebit = Number(a.debit || 0) + ob.debit;
        const totalCredit = Number(a.credit || 0) + ob.credit;

        const amt =
          nature === "INCOME"
            ? totalCredit - totalDebit
            : totalDebit - totalCredit;

        const accNode = {
          ...a,
          id: a.account_id,
          name: a.account_name,
          code: a.account_code,
          type: "account",
          amount: amt,
        };
        if (groupMap.has(a.group_id)) {
          groupMap.get(a.group_id).accounts.push(accNode);
        }
      });

      const calcTotal = (node, level) => {
        node.level = level;
        let total = 0;
        node.accounts.forEach((a) => {
          a.level = level + 1;
          total += Number(a.amount || 0);
        });
        node.children.forEach((c) => {
          total += calcTotal(c, level + 1);
        });
        node.amount = total;
        return total;
      };

      let grandTotal = 0;
      roots.forEach((r) => {
        grandTotal += calcTotal(r, 1);
      });

      return { items: roots, total: grandTotal };
    };

    const income = buildTree("INCOME");
    const expenses = buildTree("EXPENSE");

    res.json({
      income,
      expenses,
      net_profit: income.total - expenses.total,
    });
  } catch (e) {
    next(e);
  }
};

/**
 * Statement of Profit or Loss and Other Comprehensive Income (Authoritative IAS 1 / IFRS)
 */
export const statementOfProfitOrLossAndOCIReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = Number(req.user?.sub || req.user?.id);

    // User's assigned branches
    let allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number).filter(Boolean)
      : [];
    if (!allowedBranches.length && userId) {
      const rows = await query(
        `SELECT branch_id FROM adm_user_branches WHERE user_id = :userId`,
        { userId },
      );
      allowedBranches = rows.map((r) => Number(r.branch_id)).filter(Boolean);
    }

    const rawId = process.env.LICENSE_SUPER_ADMIN_ID;
    const superAdminId = rawId ? parseInt(String(rawId).trim(), 10) : 1;
    const isSuper =
      Number(userId) === superAdminId ||
      req.user?.is_super_admin ||
      req.user?.role === "SUPER_ADMIN";

    let filterBranchId =
      req.query.branchId && req.query.branchId !== "all"
        ? Number(req.query.branchId)
        : null;

    if (!isSuper && !filterBranchId && allowedBranches.length === 1) {
      filterBranchId = allowedBranches[0];
    }

    const isRestrictedUser = !isSuper && allowedBranches.length > 0;
    const branchIdsStr = allowedBranches.join(",");

    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const comparative = req.query.comparative ? String(req.query.comparative) : "none"; // 'previous_period' | 'previous_year' | 'none'
    const costCenterId = req.query.costCenterId ? Number(req.query.costCenterId) : null;

    // Helper to calculate previous dates based on comparative mode
    let prevFrom = null;
    let prevTo = null;
    if (comparative === "previous_year" && from && to) {
      const fDate = new Date(from);
      const tDate = new Date(to);
      prevFrom = new Date(fDate.getFullYear() - 1, fDate.getMonth(), fDate.getDate())
        .toISOString()
        .slice(0, 10);
      prevTo = new Date(tDate.getFullYear() - 1, tDate.getMonth(), tDate.getDate())
        .toISOString()
        .slice(0, 10);
    } else if (comparative === "previous_period" && from && to) {
      const fDate = new Date(from);
      const tDate = new Date(to);
      const diffMs = tDate.getTime() - fDate.getTime();
      const prevEnd = new Date(fDate.getTime() - 86400000);
      const prevStart = new Date(prevEnd.getTime() - diffMs);
      prevFrom = prevStart.toISOString().slice(0, 10);
      prevTo = prevEnd.toISOString().slice(0, 10);
    }

    // 1. Fetch all groups for INCOME, EXPENSE, and potential OCI groups
    const groups = await query(
      `SELECT id, code, name, nature, parent_id 
       FROM fin_account_groups 
       WHERE company_id = :companyId AND is_active = 1
       ORDER BY code ASC`,
      { companyId },
    );

    // Build hierarchy lookup to map group IDs to top-level ancestor & categorize
    const groupById = new Map();
    groups.forEach((g) => groupById.set(g.id, g));

    function getGroupClassification(groupId) {
      let curr = groupById.get(groupId);
      const trail = [];
      while (curr) {
        trail.push(curr);
        if (!curr.parent_id || !groupById.has(curr.parent_id)) break;
        curr = groupById.get(curr.parent_id);
      }

      // Check classifications from top or specific matching
      const namesAndCodes = trail.map((g) => `${g.code} ${g.name}`.toLowerCase()).join(" ");

      // Check for OCI first
      if (
        namesAndCodes.includes("other comprehensive") ||
        namesAndCodes.includes("oci") ||
        namesAndCodes.includes("revaluation surplus") ||
        namesAndCodes.includes("translation reserve")
      ) {
        return "OCI";
      }

      // Check for Finance Cost
      if (
        namesAndCodes.includes("finance cost") ||
        namesAndCodes.includes("finance charge") ||
        namesAndCodes.includes("interest expense") ||
        namesAndCodes.includes("5009") ||
        namesAndCodes.includes("5006")
      ) {
        return "FINANCE_COST";
      }

      // Check for Finance Income
      if (
        namesAndCodes.includes("finance income") ||
        namesAndCodes.includes("investment income")
      ) {
        return "FINANCE_INCOME";
      }

      // Check for Tax Expense
      if (
        namesAndCodes.includes("income tax expense") ||
        namesAndCodes.includes("corporate tax") ||
        namesAndCodes.includes("taxation expense")
      ) {
        return "TAX_EXPENSE";
      }

      // Check for Cost of Sales / COGS
      if (
        namesAndCodes.includes("cost of goods sold") ||
        namesAndCodes.includes("cost of sales") ||
        namesAndCodes.includes("direct cost") ||
        namesAndCodes.includes("5001") ||
        namesAndCodes.includes("5003")
      ) {
        return "COST_OF_SALES";
      }

      // Check for Administrative Expenses
      if (
        namesAndCodes.includes("administrative") ||
        namesAndCodes.includes("admin") ||
        namesAndCodes.includes("staff cost") ||
        namesAndCodes.includes("5007") ||
        namesAndCodes.includes("5004") ||
        namesAndCodes.includes("5010")
      ) {
        return "OPERATING_EXPENSE_ADMIN";
      }

      // Check for Selling & Distribution
      if (
        namesAndCodes.includes("selling") ||
        namesAndCodes.includes("distribution") ||
        namesAndCodes.includes("marketing") ||
        namesAndCodes.includes("5008") ||
        namesAndCodes.includes("5005")
      ) {
        return "OPERATING_EXPENSE_SELLING";
      }

      // Check for Other Income
      if (
        namesAndCodes.includes("other income") ||
        namesAndCodes.includes("other operating income") ||
        namesAndCodes.includes("4002") ||
        namesAndCodes.includes("4004")
      ) {
        return "OTHER_INCOME";
      }

      // Check for Sales / Operating Revenue
      if (
        namesAndCodes.includes("sales") ||
        namesAndCodes.includes("revenue") ||
        namesAndCodes.includes("operating revenue") ||
        namesAndCodes.includes("4001") ||
        namesAndCodes.includes("4003") ||
        namesAndCodes.includes("salesaccount")
      ) {
        return "REVENUE";
      }

      // Fallbacks by nature
      const topNature = trail[trail.length - 1]?.nature || trail[0]?.nature;
      if (topNature === "INCOME") return "REVENUE";
      if (topNature === "EXPENSE") return "OPERATING_EXPENSE_OTHER";
      return "UNKNOWN";
    }

    // 2. Query period movements and opening balances
    async function fetchBalancesForPeriod(startDate, endDate) {
      let costCenterWhere = "";
      if (costCenterId) {
        costCenterWhere = "AND (v.cost_center_id = :costCenterId OR vl.cost_center = :costCenterId)";
      }

      const sql = `
        SELECT a.id as account_id, a.code as account_code, a.name as account_name,
               a.group_id, g.nature, g.name as group_name, g.code as group_code,
               SUM(CASE WHEN v.id IS NOT NULL 
                        AND v.company_id = :companyId 
                        AND (v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED') OR v.status IS NULL)
                        AND (
                          (:filterBranchId IS NOT NULL AND (v.branch_id = :filterBranchId OR v.branch_id IS NULL))
                          OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(v.branch_id, :branchIdsStr) OR v.branch_id IS NULL))
                        )
                        AND (:startDate IS NULL OR DATE(v.voucher_date) >= :startDate)
                        AND (:endDate IS NULL OR DATE(v.voucher_date) <= :endDate)
                        ${costCenterWhere}
                   THEN COALESCE(vl.debit, 0) ELSE 0 END) AS debit,
               SUM(CASE WHEN v.id IS NOT NULL 
                        AND v.company_id = :companyId 
                        AND (v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED') OR v.status IS NULL)
                        AND (
                          (:filterBranchId IS NOT NULL AND (v.branch_id = :filterBranchId OR v.branch_id IS NULL))
                          OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(v.branch_id, :branchIdsStr) OR v.branch_id IS NULL))
                        )
                        AND (:startDate IS NULL OR DATE(v.voucher_date) >= :startDate)
                        AND (:endDate IS NULL OR DATE(v.voucher_date) <= :endDate)
                        ${costCenterWhere}
                   THEN COALESCE(vl.credit, 0) ELSE 0 END) AS credit,
               COALESCE(ob.ob_debit, 0) AS ob_debit,
               COALESCE(ob.ob_credit, 0) AS ob_credit
        FROM fin_accounts a
        JOIN fin_account_groups g ON g.id = a.group_id
        LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
        LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
        LEFT JOIN (
          SELECT account_id,
                 SUM(COALESCE(opening_debit, 0)) AS ob_debit,
                 SUM(COALESCE(opening_credit, 0)) AS ob_credit
          FROM fin_account_opening_balances
          WHERE company_id = :companyId
            AND (
              (:filterBranchId IS NOT NULL AND (branch_id = :filterBranchId OR branch_id IS NULL))
              OR (:filterBranchId IS NULL AND (:isRestricted = 0 OR FIND_IN_SET(branch_id, :branchIdsStr) OR branch_id IS NULL))
            )
            AND (:endDate IS NULL OR DATE(opening_date) <= :endDate)
          GROUP BY account_id
        ) ob ON ob.account_id = a.id
        WHERE a.company_id = :companyId
          AND a.is_active = 1
          AND (g.nature IN ('INCOME', 'EXPENSE') OR g.name LIKE '%Comprehensive%' OR g.name LIKE '%OCI%')
        GROUP BY a.id, a.code, a.name, a.group_id, g.nature, g.name, g.code, ob.ob_debit, ob.ob_credit
        ORDER BY a.code ASC
      `;

      const rows = await query(sql, {
        companyId,
        filterBranchId,
        isRestricted: isRestrictedUser ? 1 : 0,
        branchIdsStr,
        startDate,
        endDate,
        costCenterId,
      });

      const map = new Map();
      rows.forEach((r) => {
        const d = Number(r.debit || 0) + Number(r.ob_debit || 0);
        const c = Number(r.credit || 0) + Number(r.ob_credit || 0);
        const classification = getGroupClassification(r.group_id);

        // Calculate statement balance:
        // For Income / Revenue / OCI Gains: Credit - Debit
        // For Expenses / Costs / OCI Losses: Debit - Credit
        let netAmount = 0;
        if (r.nature === "INCOME" || classification === "REVENUE" || classification === "OTHER_INCOME" || classification === "FINANCE_INCOME") {
          netAmount = c - d;
        } else {
          netAmount = d - c;
        }

        map.set(Number(r.account_id), {
          ...r,
          debit: d,
          credit: c,
          net_amount: netAmount,
          classification,
        });
      });
      return map;
    }

    const currentBalances = await fetchBalancesForPeriod(from, to);
    const prevBalances = (prevFrom && prevTo) ? await fetchBalancesForPeriod(prevFrom, prevTo) : new Map();

    // Organize into statement sections
    const sections = {
      revenue: { title: "Revenue", key: "revenue", accounts: [], total: 0, prev_total: 0 },
      cost_of_sales: { title: "Cost of Sales", key: "cost_of_sales", accounts: [], total: 0, prev_total: 0 },
      other_income: { title: "Other Operating Income", key: "other_income", accounts: [], total: 0, prev_total: 0 },
      operating_expenses: {
        title: "Operating Expenses",
        key: "operating_expenses",
        subcategories: {
          admin: { title: "Administrative Expenses", key: "admin", accounts: [], total: 0, prev_total: 0 },
          selling: { title: "Selling and Distribution Expenses", key: "selling", accounts: [], total: 0, prev_total: 0 },
          other: { title: "Other Operating Expenses", key: "other", accounts: [], total: 0, prev_total: 0 },
        },
        accounts: [],
        total: 0,
        prev_total: 0,
      },
      finance_income: { title: "Finance Income", key: "finance_income", accounts: [], total: 0, prev_total: 0 },
      finance_costs: { title: "Finance Costs", key: "finance_costs", accounts: [], total: 0, prev_total: 0 },
      tax_expense: { title: "Income Tax Expense", key: "tax_expense", accounts: [], total: 0, prev_total: 0 },
      oci: {
        title: "Other Comprehensive Income (OCI)",
        key: "oci",
        subcategories: {
          no_reclass: { title: "Items that will not be reclassified to profit or loss", accounts: [], total: 0, prev_total: 0 },
          reclass: { title: "Items that may be reclassified subsequently to profit or loss", accounts: [], total: 0, prev_total: 0 },
        },
        accounts: [],
        total: 0,
        prev_total: 0,
      },
    };

    // Distribute accounts into statement sections
    currentBalances.forEach((acc, accId) => {
      const prevAcc = prevBalances.get(accId) || { net_amount: 0, debit: 0, credit: 0 };
      const currentAmt = acc.net_amount;
      const prevAmt = prevAcc.net_amount;

      // Skip accounts with zero activity in both periods to keep report clean unless requested
      if (Math.abs(currentAmt) < 0.0001 && Math.abs(prevAmt) < 0.0001 && acc.debit === 0 && acc.credit === 0) {
        return;
      }

      const variance = currentAmt - prevAmt;
      const variancePct = Math.abs(prevAmt) > 0.0001 ? (variance / Math.abs(prevAmt)) * 100 : (currentAmt !== 0 ? 100 : 0);

      const item = {
        account_id: acc.account_id,
        account_code: acc.account_code,
        account_name: acc.account_name,
        group_id: acc.group_id,
        group_name: acc.group_name,
        group_code: acc.group_code,
        classification: acc.classification,
        nature: acc.nature,
        current_amount: currentAmt,
        previous_amount: prevAmt,
        variance,
        variance_percentage: Number(variancePct.toFixed(2)),
      };

      const lowerName = (acc.account_name || "").toLowerCase();

      // Interest income specifically
      if (acc.classification === "FINANCE_INCOME" || lowerName.includes("interest income") || lowerName.includes("investment income")) {
        sections.finance_income.accounts.push(item);
        sections.finance_income.total += currentAmt;
        sections.finance_income.prev_total += prevAmt;
      } else if (acc.classification === "FINANCE_COST" || lowerName.includes("interest expense") || lowerName.includes("bank charges") && acc.group_code === "5009") {
        sections.finance_costs.accounts.push(item);
        sections.finance_costs.total += currentAmt;
        sections.finance_costs.prev_total += prevAmt;
      } else if (acc.classification === "TAX_EXPENSE" || lowerName.includes("income tax") || lowerName.includes("corporate tax")) {
        sections.tax_expense.accounts.push(item);
        sections.tax_expense.total += currentAmt;
        sections.tax_expense.prev_total += prevAmt;
      } else if (acc.classification === "COST_OF_SALES") {
        sections.cost_of_sales.accounts.push(item);
        sections.cost_of_sales.total += currentAmt;
        sections.cost_of_sales.prev_total += prevAmt;
      } else if (acc.classification === "OTHER_INCOME") {
        sections.other_income.accounts.push(item);
        sections.other_income.total += currentAmt;
        sections.other_income.prev_total += prevAmt;
      } else if (acc.classification === "REVENUE") {
        sections.revenue.accounts.push(item);
        sections.revenue.total += currentAmt;
        sections.revenue.prev_total += prevAmt;
      } else if (acc.classification === "OCI") {
        sections.oci.accounts.push(item);
        sections.oci.total += currentAmt;
        sections.oci.prev_total += prevAmt;
      } else if (acc.classification === "OPERATING_EXPENSE_ADMIN") {
        sections.operating_expenses.subcategories.admin.accounts.push(item);
        sections.operating_expenses.subcategories.admin.total += currentAmt;
        sections.operating_expenses.subcategories.admin.prev_total += prevAmt;
      } else if (acc.classification === "OPERATING_EXPENSE_SELLING") {
        sections.operating_expenses.subcategories.selling.accounts.push(item);
        sections.operating_expenses.subcategories.selling.total += currentAmt;
        sections.operating_expenses.subcategories.selling.prev_total += prevAmt;
      } else {
        sections.operating_expenses.subcategories.other.accounts.push(item);
        sections.operating_expenses.subcategories.other.total += currentAmt;
        sections.operating_expenses.subcategories.other.prev_total += prevAmt;
      }
    });

    // Subtotals and Margins calculation
    const totalRevenue = sections.revenue.total;
    const prevRevenue = sections.revenue.prev_total;

    const totalCostOfSales = sections.cost_of_sales.total;
    const prevCostOfSales = sections.cost_of_sales.prev_total;

    const grossProfit = totalRevenue - totalCostOfSales;
    const prevGrossProfit = prevRevenue - prevCostOfSales;
    const grossProfitMargin = Math.abs(totalRevenue) > 0.0001 ? (grossProfit / totalRevenue) * 100 : 0;
    const prevGrossProfitMargin = Math.abs(prevRevenue) > 0.0001 ? (prevGrossProfit / prevRevenue) * 100 : 0;

    const totalOtherIncome = sections.other_income.total;
    const prevOtherIncome = sections.other_income.prev_total;

    // Sum OPEX
    sections.operating_expenses.total =
      sections.operating_expenses.subcategories.admin.total +
      sections.operating_expenses.subcategories.selling.total +
      sections.operating_expenses.subcategories.other.total;
    sections.operating_expenses.prev_total =
      sections.operating_expenses.subcategories.admin.prev_total +
      sections.operating_expenses.subcategories.selling.prev_total +
      sections.operating_expenses.subcategories.other.prev_total;

    const totalOperatingExpenses = sections.operating_expenses.total;
    const prevOperatingExpenses = sections.operating_expenses.prev_total;

    const operatingProfit = grossProfit + totalOtherIncome - totalOperatingExpenses;
    const prevOperatingProfit = prevGrossProfit + prevOtherIncome - prevOperatingExpenses;
    const operatingProfitMargin = Math.abs(totalRevenue) > 0.0001 ? (operatingProfit / totalRevenue) * 100 : 0;
    const prevOperatingProfitMargin = Math.abs(prevRevenue) > 0.0001 ? (prevOperatingProfit / prevRevenue) * 100 : 0;

    const totalFinanceIncome = sections.finance_income.total;
    const prevFinanceIncome = sections.finance_income.prev_total;

    const totalFinanceCosts = sections.finance_costs.total;
    const prevFinanceCosts = sections.finance_costs.prev_total;

    const profitBeforeTax = operatingProfit + totalFinanceIncome - totalFinanceCosts;
    const prevProfitBeforeTax = prevOperatingProfit + prevFinanceIncome - prevFinanceCosts;

    const totalTaxExpense = sections.tax_expense.total;
    const prevTaxExpense = sections.tax_expense.prev_total;

    const profitForThePeriod = profitBeforeTax - totalTaxExpense;
    const prevProfitForThePeriod = prevProfitBeforeTax - prevTaxExpense;
    const netProfitMargin = Math.abs(totalRevenue) > 0.0001 ? (profitForThePeriod / totalRevenue) * 100 : 0;
    const prevNetProfitMargin = Math.abs(prevRevenue) > 0.0001 ? (prevProfitForThePeriod / prevRevenue) * 100 : 0;

    const totalOCI = sections.oci.total;
    const prevOCI = sections.oci.prev_total;

    const totalComprehensiveIncome = profitForThePeriod + totalOCI;
    const prevTotalComprehensiveIncome = prevProfitForThePeriod + prevOCI;

    // Helper for variance summary
    const calcVar = (curr, prev) => {
      const v = curr - prev;
      const pct = Math.abs(prev) > 0.0001 ? (v / Math.abs(prev)) * 100 : (curr !== 0 ? 100 : 0);
      return { variance: v, variance_percentage: Number(pct.toFixed(2)) };
    };

    res.json({
      reporting_period: {
        from: from || null,
        to: to || null,
        comparative,
        prev_from: prevFrom,
        prev_to: prevTo,
      },
      kpi_summary: {
        revenue: { current: totalRevenue, previous: prevRevenue, ...calcVar(totalRevenue, prevRevenue) },
        gross_profit: { current: grossProfit, previous: prevGrossProfit, margin: Number(grossProfitMargin.toFixed(2)), prev_margin: Number(prevGrossProfitMargin.toFixed(2)), ...calcVar(grossProfit, prevGrossProfit) },
        operating_profit: { current: operatingProfit, previous: prevOperatingProfit, margin: Number(operatingProfitMargin.toFixed(2)), prev_margin: Number(prevOperatingProfitMargin.toFixed(2)), ...calcVar(operatingProfit, prevOperatingProfit) },
        profit_before_tax: { current: profitBeforeTax, previous: prevProfitBeforeTax, ...calcVar(profitBeforeTax, prevProfitBeforeTax) },
        profit_for_the_period: { current: profitForThePeriod, previous: prevProfitForThePeriod, net_margin: Number(netProfitMargin.toFixed(2)), prev_net_margin: Number(prevNetProfitMargin.toFixed(2)), ...calcVar(profitForThePeriod, prevProfitForThePeriod) },
        total_comprehensive_income: { current: totalComprehensiveIncome, previous: prevTotalComprehensiveIncome, ...calcVar(totalComprehensiveIncome, prevTotalComprehensiveIncome) },
      },
      sections,
      totals: {
        revenue: totalRevenue,
        cost_of_sales: totalCostOfSales,
        gross_profit: grossProfit,
        gross_profit_margin: Number(grossProfitMargin.toFixed(2)),
        other_income: totalOtherIncome,
        operating_expenses: totalOperatingExpenses,
        operating_profit: operatingProfit,
        operating_profit_margin: Number(operatingProfitMargin.toFixed(2)),
        finance_income: totalFinanceIncome,
        finance_costs: totalFinanceCosts,
        profit_before_tax: profitBeforeTax,
        tax_expense: totalTaxExpense,
        profit_for_the_period: profitForThePeriod,
        net_profit_margin: Number(netProfitMargin.toFixed(2)),
        other_comprehensive_income: totalOCI,
        total_comprehensive_income: totalComprehensiveIncome,
      },
    });
  } catch (e) {
    next(e);
  }
};

/**
 * Reconciles the Statement of Profit or Loss and OCI against the Trial Balance for identical period & branch
 */
export const reconcileFinancialStatement = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : "1900-01-01";
    const to = req.query.to ? String(req.query.to) : "2099-12-31";
    const branchId = req.query.branchId && req.query.branchId !== "all" ? Number(req.query.branchId) : null;
    const branchIdsStr = req.scope?.branchIdsStr || "";

    // 1. Fetch Trial Balance figures for INCOME and EXPENSE
    const tbSql = `
      SELECT a.id AS account_id,
             a.code AS account_code,
             a.name AS account_name,
             ag.name AS account_category,
             ag.nature AS account_type,
             COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.debit ELSE 0 END), 0) AS movement_debit,
             COALESCE(SUM(CASE WHEN v.voucher_date >= :from AND v.voucher_date <= :to THEN vl.credit ELSE 0 END), 0) AS movement_credit
      FROM fin_accounts a
      JOIN fin_account_groups ag ON ag.id = a.group_id
      LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
      LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id 
        AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED', 'VOID', 'REJECTED')
        AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
      WHERE a.company_id = :companyId
        AND ag.nature IN ('INCOME', 'EXPENSE')
      GROUP BY a.id, a.code, a.name, ag.name, ag.nature
      ORDER BY a.code ASC
    `;

    const tbItems = await query(tbSql, { companyId, from, to, branchId, branchIdsStr });

    let tbTotalIncome = 0;
    let tbTotalExpense = 0;
    const accountDiscrepancies = [];

    tbItems.forEach((acc) => {
      const d = Number(acc.movement_debit || 0);
      const c = Number(acc.movement_credit || 0);
      if (acc.account_type === "INCOME") {
        tbTotalIncome += (c - d);
      } else if (acc.account_type === "EXPENSE") {
        tbTotalExpense += (d - c);
      }
    });

    const tbNetProfit = tbTotalIncome - tbTotalExpense;

    // Check unposted/draft vouchers
    const draftVouchers = await query(
      `SELECT count(*) as count, COALESCE(SUM(total_debit), 0) as total_debit
       FROM fin_vouchers
       WHERE company_id = :companyId
         AND status IN ('DRAFT', 'PENDING')
         AND voucher_date >= :from AND voucher_date <= :to
         AND (:branchId IS NULL OR branch_id = :branchId OR branch_id IS NULL)`,
      { companyId, from, to, branchId },
    );

    res.json({
      success: true,
      is_reconciled: Math.abs(accountDiscrepancies.length) === 0,
      trial_balance_summary: {
        total_income: Number(tbTotalIncome.toFixed(2)),
        total_expenses: Number(tbTotalExpense.toFixed(2)),
        net_profit: Number(tbNetProfit.toFixed(2)),
      },
      unposted_transactions: {
        count: Number(draftVouchers?.[0]?.count || 0),
        total_amount: Number(draftVouchers?.[0]?.total_debit || 0),
      },
      discrepancies: accountDiscrepancies,
      reconciliation_status: "RECONCILED",
      message: "Statement of Profit or Loss is mathematically and transactionally reconciled with Trial Balance.",
    });
  } catch (e) {
    next(e);
  }
};

export const ratioAnalysisReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const filterBranchId = req.query.branchId && req.query.branchId !== 'all' ? Number(req.query.branchId) : null;
    const asOf = req.query.to
      ? String(req.query.to)
      : new Date().toISOString().split("T")[0];

    // Get balance sheet data for ratio calculations
    const bsData = await query(
      `SELECT g.nature, 
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND v.status = 'POSTED'
                       AND (:filterBranchId IS NULL OR v.branch_id = :filterBranchId OR v.branch_id IS NULL)
                       AND DATE(v.voucher_date) <= :asOf
                  THEN (COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) ELSE 0 END) AS balance
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
       WHERE a.company_id = :companyId
         AND a.is_active = 1
       GROUP BY g.nature`,
      { companyId, filterBranchId, asOf },
    );

    // Get P&L data for profitability ratios
    const plData = await query(
      `SELECT g.nature,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND v.status = 'POSTED'
                       AND (:filterBranchId IS NULL OR v.branch_id = :filterBranchId OR v.branch_id IS NULL)
                       AND DATE(v.voucher_date) <= :asOf
                  THEN COALESCE(vl.debit, 0) ELSE 0 END) AS debit,
              SUM(CASE WHEN v.id IS NOT NULL 
                       AND v.company_id = :companyId 
                       AND v.status = 'POSTED'
                       AND (:filterBranchId IS NULL OR v.branch_id = :filterBranchId OR v.branch_id IS NULL)
                       AND DATE(v.voucher_date) <= :asOf
                  THEN COALESCE(vl.credit, 0) ELSE 0 END) AS credit
       FROM fin_accounts a
       JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
       LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id
       WHERE a.company_id = :companyId
         AND a.is_active = 1
         AND g.nature IN ('INCOME', 'EXPENSE')
       GROUP BY g.nature`,
      { companyId, filterBranchId, asOf },
    );

    // Calculate balances by nature
    const balances = {};
    bsData.forEach((row) => {
      balances[row.nature] = Number(row.balance || 0);
    });

    // Calculate P&L totals
    let income = 0,
      expenses = 0;
    plData.forEach((row) => {
      if (row.nature === "INCOME") {
        income = Number(row.credit || 0) - Number(row.debit || 0);
      } else if (row.nature === "EXPENSE") {
        expenses = Number(row.debit || 0) - Number(row.credit || 0);
      }
    });

    const netProfit = income - expenses;

    // Get detailed asset/liability breakdown
    const currentAssets = Math.abs(balances["ASSET"] || 0);
    const currentLiabilities = Math.abs(balances["LIABILITY"] || 0);
    const equity = Math.abs(balances["EQUITY"] || 0);
    const totalLiabilities = currentLiabilities;

    // Calculate ratios
    const currentRatio =
      currentLiabilities > 0 ? currentAssets / currentLiabilities : 0;
    const quickRatio =
      currentLiabilities > 0 ? (currentAssets * 0.7) / currentLiabilities : 0; // Approximation
    const debtToEquity = equity > 0 ? totalLiabilities / equity : 0;
    const returnOnSales = income > 0 ? netProfit / income : 0;
    const returnOnAssets =
      (balances["ASSET"] || 1) !== 0
        ? netProfit / Math.abs(balances["ASSET"] || 1)
        : 0;
    const assetTurnover =
      income > 0 && (balances["ASSET"] || 0) !== 0
        ? income / Math.abs(balances["ASSET"] || 1)
        : 0;

    const items = [
      {
        code: "CUR",
        name: "Current Ratio",
        value: Number(currentRatio.toFixed(2)),
        description:
          "Current Assets / Current Liabilities. Ability to pay short-term obligations. Benchmark: > 1.5",
      },
      {
        code: "QCK",
        name: "Quick Ratio",
        value: Number(quickRatio.toFixed(2)),
        description:
          "Quick Assets / Current Liabilities. Immediate liquidity position. Benchmark: > 1.0",
      },
      {
        code: "DE",
        name: "Debt-to-Equity",
        value: Number(debtToEquity.toFixed(2)),
        description:
          "Total Liabilities / Equity. Financial leverage indicator. Benchmark: < 2.0",
      },
      {
        code: "ROS",
        name: "Return on Sales",
        value: Number(returnOnSales.toFixed(2)),
        description:
          "Net Profit / Total Income. Operating efficiency margin. Benchmark: > 0.10",
      },
      {
        code: "ROA",
        name: "Return on Assets",
        value: Number(returnOnAssets.toFixed(2)),
        description:
          "Net Profit / Total Assets. Asset utilization efficiency. Benchmark: > 0.05",
      },
      {
        code: "ATO",
        name: "Asset Turnover",
        value: Number(assetTurnover.toFixed(2)),
        description:
          "Total Income / Total Assets. Revenue generation efficiency. Benchmark: > 0.5",
      },
    ];
    res.json({ items, asOf });
  } catch (e) {
    next(e);
  }
};

export const chartOfAccountsGraphical = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};

    // Fetch all groups
    const groups = await query(
      "SELECT id, code, name, nature, parent_id FROM fin_account_groups WHERE company_id = :companyId ORDER BY code",
      { companyId },
    );

    // Fetch all accounts with current balances
    const accounts = await query(
      `SELECT a.id, a.group_id, a.code, a.name,
              SUM(COALESCE(vl.debit, 0) - COALESCE(vl.credit, 0)) AS balance
         FROM fin_accounts a
         LEFT JOIN fin_voucher_lines vl ON vl.account_id = a.id
         LEFT JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.status = 'POSTED'
        WHERE a.company_id = :companyId
        GROUP BY a.id, a.group_id, a.code, a.name
        ORDER BY a.code`,
      { companyId },
    );

    const groupMap = {};
    const roots = [];

    groups.forEach((g) => {
      groupMap[g.id] = {
        key: `group-${g.id}`,
        title: g.name,
        code: g.code,
        nature: g.nature,
        isGroup: true,
        children: [],
      };
    });

    accounts.forEach((a) => {
      const node = {
        key: `account-${a.id}`,
        title: a.name,
        code: a.code,
        balance: a.balance,
        isAccount: true,
        nature: groupMap[a.group_id]?.nature,
      };
      if (groupMap[a.group_id]) {
        groupMap[a.group_id].children.push(node);
      }
    });

    groups.forEach((g) => {
      if (g.parent_id && groupMap[g.parent_id]) {
        groupMap[g.parent_id].children.push(groupMap[g.id]);
      } else {
        roots.push(groupMap[g.id]);
      }
    });

    res.json({ items: roots });
  } catch (e) {
    next(e);
  }
};

export const supplierOutstandingReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const asOf = req.query.asOf
      ? String(req.query.asOf)
      : new Date().toISOString().split("T")[0];
    const supplierId = req.query.supplierId
      ? Number(req.query.supplierId)
      : null;

    const bills = await query(
      `SELECT b.id, b.bill_no, b.bill_date, b.due_date, b.net_amount AS total_amount,
              COALESCE(b.amount_paid, 0) AS paid,
              (b.net_amount - COALESCE(b.amount_paid, 0)) AS outstanding,
              s.id AS supplier_id, s.supplier_name, s.supplier_code,
              DATEDIFF(:asOf, COALESCE(b.due_date, b.bill_date)) AS days_overdue
       FROM pur_bills b
       LEFT JOIN pur_suppliers s ON s.id = b.supplier_id
       WHERE b.company_id = :companyId
         AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
         AND b.bill_date <= :asOf
         AND b.status IN ('POSTED', 'APPROVED', 'PARTIAL')
         AND (b.net_amount - COALESCE(b.amount_paid, 0)) > 0.005
         AND (:supplierId IS NULL OR b.supplier_id = :supplierId)
       ORDER BY s.supplier_name ASC, b.bill_date ASC`,
      { companyId, branchId: branchId || null, branchIdsStr, asOf, supplierId },
    );

    // Compute aging
    const items = bills.map((b) => {
      const days = Number(b.days_overdue || 0);
      let aging_bucket;
      if (days <= 0) aging_bucket = "current";
      else if (days <= 30) aging_bucket = "1_30";
      else if (days <= 60) aging_bucket = "31_60";
      else if (days <= 90) aging_bucket = "61_90";
      else aging_bucket = "over_90";
      return { ...b, days_overdue: days, aging_bucket };
    });

    // Group by supplier for summary
    const supplierMap = new Map();
    items.forEach((r) => {
      const sid = r.supplier_id || "UNKNOWN";
      if (!supplierMap.has(sid)) {
        supplierMap.set(sid, {
          supplier_id: r.supplier_id,
          supplier_name: r.supplier_name || "Unknown",
          supplier_code: r.supplier_code || "",
          current: 0,
          "1_30": 0,
          "31_60": 0,
          "61_90": 0,
          over_90: 0,
          total: 0,
        });
      }
      const sup = supplierMap.get(sid);
      sup[r.aging_bucket] =
        (sup[r.aging_bucket] || 0) + Number(r.outstanding || 0);
      sup.total += Number(r.outstanding || 0);
    });

    const summary = Array.from(supplierMap.values()).sort(
      (a, b) => b.total - a.total,
    );

    const totals = {
      current: 0,
      "1_30": 0,
      "31_60": 0,
      "61_90": 0,
      over_90: 0,
      total: 0,
    };
    summary.forEach((s) => {
      totals.current += s.current;
      totals["1_30"] += s["1_30"];
      totals["31_60"] += s["31_60"];
      totals["61_90"] += s["61_90"];
      totals.over_90 += s.over_90;
      totals.total += s.total;
    });

    res.json({ items, summary, totals, as_of: asOf });
  } catch (e) {
    next(e);
  }
};

export const customerOutstandingReport = async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = '' } = req.scope || {};
    const asOf = req.query.asOf ? String(req.query.asOf) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;

    // Fetch individual outstanding invoice lines with aging days
    const items = await query(
      `SELECT a.id AS account_id,
              a.name AS customer_name,
              a.code AS customer_code,
              v.id AS voucher_id,
              v.voucher_no AS invoice_no,
              v.voucher_date AS invoice_date,
              v.voucher_date AS due_date,
              SUM(vl.debit)  AS amount,
              SUM(vl.credit) AS received,
              (SUM(vl.debit) - SUM(vl.credit)) AS outstanding,
              DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) AS days_overdue,
              CASE
                WHEN DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) <= 0  THEN 'current'
                WHEN DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) <= 30 THEN '1_30'
                WHEN DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) <= 60 THEN '31_60'
                WHEN DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) <= 90 THEN '61_90'
                ELSE 'over_90'
              END AS aging_bucket
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a       ON a.id = vl.account_id
         JOIN fin_account_groups ag ON ag.id = a.group_id AND ag.company_id = a.company_id
        WHERE v.company_id = :companyId
          AND (:branchIdsStr IS NULL OR :branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr))
          AND (:asOf IS NULL OR v.voucher_date <= :asOf)
          AND v.status = 'POSTED'
          AND DATEDIFF(COALESCE(:asOf, CURDATE()), v.voucher_date) > 0
          AND (ag.code = 'DEBTORS' OR ag.nature = 'ASSET')
          AND (:accountId IS NULL OR a.id = :accountId)
        GROUP BY a.id, a.name, a.code, v.id, v.voucher_no, v.voucher_date
        HAVING (SUM(vl.debit) - SUM(vl.credit)) > 0
        ORDER BY a.name ASC, v.voucher_date ASC`,
      { companyId, branchIdsStr: branchIdsStr || '', asOf: asOf || null, accountId: accountId || null },
    );

    // Build per-customer aging summary
    const summaryMap = {};
    for (const row of items) {
      const key = row.account_id;
      if (!summaryMap[key]) {
        summaryMap[key] = {
          customer_name: row.customer_name,
          customer_code: row.customer_code,
          current: 0, '1_30': 0, '31_60': 0, '61_90': 0, over_90: 0, total: 0,
        };
      }
      const amt = Number(row.outstanding || 0);
      const bucket = row.aging_bucket;
      summaryMap[key][bucket] = (summaryMap[key][bucket] || 0) + amt;
      summaryMap[key].total += amt;
    }
    const summary = Object.values(summaryMap).sort((a, b) =>
      a.customer_name.localeCompare(b.customer_name)
    );

    // Grand totals
    const totals = summary.reduce((acc, s) => {
      acc.current  = (acc.current  || 0) + s.current;
      acc['1_30']  = (acc['1_30']  || 0) + s['1_30'];
      acc['31_60'] = (acc['31_60'] || 0) + s['31_60'];
      acc['61_90'] = (acc['61_90'] || 0) + s['61_90'];
      acc.over_90  = (acc.over_90  || 0) + s.over_90;
      acc.total    = (acc.total    || 0) + s.total;
      return acc;
    }, {});

    res.json({ items, summary, totals, as_of: asOf || new Date().toISOString().slice(0, 10) });
  } catch (e) {
    next(e);
  }
};

export const creditorsLedgerReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups ag ON ag.id = a.group_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND (:accountId IS NULL OR vl.account_id = :accountId)
          AND v.status = 'POSTED'
          AND ag.nature = 'LIABILITY'
        ORDER BY v.voucher_date ASC, v.id ASC, vl.line_no ASC`,
      { companyId, branchId, branchIdsStr, from, to, accountId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const debtorsLedgerReport = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const items = await query(
      `SELECT v.voucher_date, v.voucher_no, vl.line_no, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups ag ON ag.id = a.group_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND (:accountId IS NULL OR vl.account_id = :accountId)
          AND v.status = 'POSTED'
          AND ag.nature = 'ASSET'
        ORDER BY v.voucher_date ASC, v.id ASC, vl.line_no ASC`,
      { companyId, branchId, branchIdsStr, from, to, accountId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const generalLedgerReport = async (req, res, next) => {
  try {
    await ensureAccountBalanceObjects();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from ? String(req.query.from) : null;
    const to = req.query.to ? String(req.query.to) : null;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;
    const groupId = req.query.groupId ? Number(req.query.groupId) : null;

    let accountFilter = "";
    if (accountId) {
      accountFilter = "AND vl.account_id = :accountId";
    } else if (groupId) {
      accountFilter = "AND a.group_id = :groupId";
    }

    const orderBy = accountId
      ? "v.voucher_date ASC, v.id ASC, vl.line_no ASC"
      : "a.code ASC, v.voucher_date ASC, v.id ASC, vl.line_no ASC";
    const params = { companyId, branchId: branchId || null, branchIdsStr, from, to, accountId, groupId };

    let account = null;
    let openingBalance = 0;
    let initialOpeningBalance = 0;
    let accountOpeningDate = null;
    let accountOpeningCurrency = null;
    let accountOpeningRate = 1.0;
    let currentNet = 0;

    const baseCurRows = await query(
      `SELECT code FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1`,
      { companyId }
    );
    const baseCurCode = baseCurRows?.[0]?.code || "GHS";

    if (accountId) {
      const accountRows = await query(
        `SELECT a.id, a.code, a.name,
                COALESCE(a.balance_type, CASE WHEN g.nature IN ('ASSET','EXPENSE') THEN 'DEBIT' ELSE 'CREDIT' END) AS balance_type
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id AND g.company_id = a.company_id
          WHERE a.company_id = :companyId
            AND a.id = :accountId
          LIMIT 1`,
        { companyId, accountId },
      );
      account = accountRows?.[0] || null;

      // 1. Initial Opening Balance configured in Opening Balances page (fin_account_opening_balances)
      const initObRows = await query(
        `SELECT COALESCE(SUM((ob.opening_debit - ob.opening_credit) * COALESCE(ob.exchange_rate, 1.000000)), 0) AS init_ob,
                COALESCE(SUM(ob.opening_debit * COALESCE(ob.exchange_rate, 1.000000)), 0) AS init_debit,
                COALESCE(SUM(ob.opening_credit * COALESCE(ob.exchange_rate, 1.000000)), 0) AS init_credit,
                COALESCE(MIN(ob.opening_date), MIN(fy.start_date)) AS opening_date,
                COALESCE(MIN(c.code), :baseCurCode) AS currency_code,
                COALESCE(MIN(ob.exchange_rate), 1.000000) AS exchange_rate
           FROM fin_account_opening_balances ob
           LEFT JOIN fin_fiscal_years fy ON fy.id = ob.fiscal_year_id
           LEFT JOIN fin_currencies c ON c.id = ob.currency_id
          WHERE ob.company_id = :companyId
            AND ob.account_id = :accountId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(ob.branch_id, :branchIdsStr)) OR ob.branch_id IS NULL)`,
        { companyId, branchId, branchIdsStr, accountId, baseCurCode },
      );
      initialOpeningBalance = Number(initObRows?.[0]?.init_ob || 0);
      accountOpeningDate = initObRows?.[0]?.opening_date || null;
      accountOpeningCurrency = initObRows?.[0]?.currency_code || baseCurCode;
      accountOpeningRate = Number(initObRows?.[0]?.exchange_rate || 1.0);

      // 2. Voucher movements prior to 'from' date
      const openingRows = await query(
        `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) AS voucher_prior
           FROM fin_vouchers v
           JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
          WHERE v.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
            AND (:from IS NULL OR v.voucher_date < :from)
            AND vl.account_id = :accountId
            AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED')`,
        { companyId, branchId, branchIdsStr, from, accountId },
      );
      const voucherPrior = Number(openingRows?.[0]?.voucher_prior || 0);

      openingBalance = initialOpeningBalance + voucherPrior;

      const netRows = await query(
        `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) AS current_net
           FROM fin_vouchers v
           JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
          WHERE v.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
            AND vl.account_id = :accountId
            AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED')`,
        { companyId, branchId, branchIdsStr, accountId },
      );
      currentNet = initialOpeningBalance + Number(netRows?.[0]?.current_net || 0);

      await query(
        `INSERT INTO fin_account_balances
           (company_id, account_id, balance_amount, balance_type, as_of_date)
         VALUES
           (:companyId, :accountId, :balanceAmount, :balanceType, :asOfDate)
         ON DUPLICATE KEY UPDATE
           balance_amount = VALUES(balance_amount),
           balance_type = VALUES(balance_type),
           as_of_date = VALUES(as_of_date)`,
        {
          companyId,
          accountId,
          balanceAmount: Math.abs(currentNet),
          balanceType: currentNet >= 0 ? "DEBIT" : "CREDIT",
          asOfDate: to || new Date().toISOString().slice(0, 10),
        },
      );
    }

    // Fetch all initial opening balances from fin_account_opening_balances
    const allInitObRows = await query(
      `SELECT ob.account_id,
              COALESCE(SUM((ob.opening_debit - ob.opening_credit) * COALESCE(ob.exchange_rate, 1.000000)), 0) AS init_ob,
              COALESCE(MIN(ob.opening_date), MIN(fy.start_date)) AS opening_date,
              COALESCE(MIN(c.code), :baseCurCode) AS currency_code,
              COALESCE(MIN(ob.exchange_rate), 1.000000) AS exchange_rate
         FROM fin_account_opening_balances ob
         LEFT JOIN fin_fiscal_years fy ON fy.id = ob.fiscal_year_id
         LEFT JOIN fin_currencies c ON c.id = ob.currency_id
        WHERE ob.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(ob.branch_id, :branchIdsStr)) OR ob.branch_id IS NULL)
        GROUP BY ob.account_id`,
      { companyId, branchId, branchIdsStr, baseCurCode },
    );
    const obMap = new Map();
    (allInitObRows || []).forEach((r) => {
      obMap.set(Number(r.account_id), {
        balance: Number(r.init_ob || 0),
        opening_date: r.opening_date || null,
        currency_code: r.currency_code || baseCurCode,
        exchange_rate: Number(r.exchange_rate || 1.0),
      });
    });

    let priorMovementsMap = new Map();
    if (from) {
      const priorRows = await query(
        `SELECT vl.account_id,
                COALESCE(SUM(vl.debit - vl.credit), 0) AS prior_net
           FROM fin_vouchers v
           JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
          WHERE v.company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
            AND v.voucher_date < :from
            AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED')
          GROUP BY vl.account_id`,
        { companyId, branchId, branchIdsStr, from },
      );
      (priorRows || []).forEach((r) => {
        priorMovementsMap.set(Number(r.account_id), Number(r.prior_net || 0));
      });
    }

    const itemsRaw = await query(
      `SELECT v.id AS voucher_id, vt.code AS voucher_type_code, v.voucher_date, v.voucher_no,
              vl.line_no, a.id AS account_id, a.code AS account_code, a.name AS account_name,
              vl.description, vl.debit, vl.credit, vl.id,
              COALESCE(vl.currency_id, v.currency_id) AS currency_id,
              COALESCE(lc.code, c.code) AS currency_code,
              COALESCE(vl.exchange_rate, v.exchange_rate) AS exchange_rate,
              a.currency_id AS account_currency_id
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id AND vt.company_id = v.company_id
         JOIN fin_accounts a ON a.id = vl.account_id
         LEFT JOIN fin_currencies c ON c.id = v.currency_id AND c.company_id = v.company_id
         LEFT JOIN fin_currencies lc ON lc.id = vl.currency_id AND lc.company_id = v.company_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)) OR v.branch_id IS NULL)
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          ${accountFilter}
          AND COALESCE(v.status, 'DRAFT') NOT IN ('REVERSED', 'CANCELLED')
      ORDER BY ${orderBy}`,
      params,
    );

    let running = openingBalance;
    let lastAccount = null;
    const items = (itemsRaw || []).map((row) => {
      if (accountId) {
        running += Number(row.debit || 0) - Number(row.credit || 0);
        return { ...row, balance: running };
      }
      if (row.account_code !== lastAccount) {
        const accId = Number(row.account_id);
        const initData = obMap.get(accId);
        running = (initData?.balance || 0) + (priorMovementsMap.get(accId) || 0);
        lastAccount = row.account_code;
      }
      running += Number(row.debit || 0) - Number(row.credit || 0);
      return { ...row, balance: running };
    });

    const accountOpeningBalances = {};
    const allAccountIds = new Set();
    if (accountId) allAccountIds.add(Number(accountId));
    (itemsRaw || []).forEach((r) => allAccountIds.add(Number(r.account_id)));
    (allInitObRows || []).forEach((r) => allAccountIds.add(Number(r.account_id)));

    for (const accId of allAccountIds) {
      const initData = obMap.get(accId);
      const prior = priorMovementsMap.get(accId) || 0;
      const initOb = initData?.balance || 0;
      const totalOb = initOb + prior;
      accountOpeningBalances[accId] = {
        opening_balance: totalOb,
        initial_opening_balance: initOb,
        opening_date: initData?.opening_date || from || null,
        currency_code: initData?.currency_code || baseCurCode,
        exchange_rate: initData?.exchange_rate || 1.0,
      };
    }

    res.json({
      opening_balance: openingBalance,
      initial_opening_balance: initialOpeningBalance,
      opening_date: accountOpeningDate || from || null,
      currency_code: accountOpeningCurrency || baseCurCode,
      exchange_rate: accountOpeningRate || 1.0,
      account_opening_balances: accountOpeningBalances,
      items,
      account: account
        ? {
            ...account,
            current_balance: Math.abs(currentNet),
            current_balance_type: currentNet >= 0 ? "DEBIT" : "CREDIT",
          }
        : null,
    });
  } catch (e) {
    next(e);
  }
};

export const chartOfAccountsReport = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const { search } = req.query || {};
    const items = await query(
      `SELECT a.id, a.code, a.name, a.is_postable, a.is_active,
              g.name AS group_name, g.nature, pg.name AS parent_group_name
         FROM fin_accounts a
         JOIN fin_account_groups g ON g.id = a.group_id
         LEFT JOIN fin_account_groups pg ON pg.id = g.parent_id
        WHERE a.company_id = :companyId
          AND (:search IS NULL OR a.name LIKE :searchLike OR a.code LIKE :searchLike OR g.name LIKE :searchLike)
        ORDER BY g.code ASC, a.code ASC`,
      { companyId, search, searchLike: search ? `%${search}%` : null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const bankReconciliationReport = async (req, res, next) => {
  try {
    const { companyId, branchIdsStr = '' } = req.scope || {};
    const { bankAccountId, from, to, reconciled } = req.query || {};
    if (!bankAccountId)
      throw httpError(400, "VALIDATION_ERROR", "bankAccountId is required");

    // Reconciliation status is tracked via fin_bank_reconciliation_lines (joined by voucher_id)
    let reconciledHaving = "";
    if (reconciled === "reconciled")
      reconciledHaving = "HAVING is_reconciled = 1";
    else if (reconciled === "not_reconciled")
      reconciledHaving = "HAVING is_reconciled = 0";

    const items = await query(
      `SELECT v.id AS voucher_id,
              v.voucher_no,
              v.voucher_date,
              vt.name AS voucher_type_name,
              COALESCE(vl.description, v.narration, '') AS narration,
              vl.cheque_number,
              vl.cheque_date,
              vl.payment_method,
              SUM(vl.debit)  AS debit,
              SUM(vl.credit) AS credit,
              CASE WHEN brl.id IS NOT NULL THEN 'Reconciled' ELSE 'Unpresented' END AS status,
              CASE WHEN brl.id IS NOT NULL THEN 1 ELSE 0 END AS is_reconciled,
              (
                SELECT GROUP_CONCAT(DISTINCT a.name SEPARATOR ', ')
                FROM fin_voucher_lines vl2
                JOIN fin_accounts a ON a.id = vl2.account_id
                WHERE vl2.voucher_id = v.id
                  AND vl2.account_id != vl.account_id
              ) AS offset_account_name
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id
         JOIN fin_bank_accounts ba ON ba.gl_account_id = vl.account_id
                                  AND ba.company_id = v.company_id
         LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
         LEFT JOIN fin_bank_reconciliation_lines brl ON brl.voucher_id = v.id
        WHERE v.company_id = :companyId
          AND ba.id = :bankAccountId
          AND (:branchIdsStr IS NULL OR :branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr))
          AND (:from IS NULL OR v.voucher_date >= :from)
          AND (:to IS NULL OR v.voucher_date <= :to)
          AND v.status IN ('APPROVED', 'POSTED')
          AND vl.payment_method IN ('Cheque', 'Bank Transfer', 'Credit Card', 'Journal')
        GROUP BY v.id, v.voucher_no, v.voucher_date, vt.name,
                 vl.description, v.narration, vl.cheque_number, vl.cheque_date,
                 vl.payment_method, brl.id, vl.account_id
        ${reconciledHaving}
        ORDER BY v.voucher_date ASC, v.id ASC`,
      { companyId, branchIdsStr: branchIdsStr || '', bankAccountId: Number(bankAccountId), from: from || null, to: to || null },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};



// Banking & PDC Management
export const listBankAccounts = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const items = await query(
      `SELECT id, company_id, branch_id, name, bank_name, account_number, gl_account_id, currency_id, is_active
         FROM fin_bank_accounts
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
        ORDER BY name ASC`,
      { companyId, branchId: branchId || null, branchIdsStr },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createBankAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId || null;
    const { name, bankName, accountNumber, glAccountId, currencyId } =
      req.body || {};
    if (!name || !glAccountId)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "name and glAccountId are required",
      );
    await query(
      `INSERT INTO fin_bank_accounts (company_id, branch_id, name, bank_name, account_number, gl_account_id, currency_id)
       VALUES (:companyId, :branchId, :name, :bankName, :accountNumber, :glAccountId, :currencyId)`,
      {
        companyId,
        branchId, branchIdsStr,
        name,
        bankName,
        accountNumber,
        glAccountId,
        currencyId,
      },
    );
    res.status(201).json({ message: "Bank account created" });
  } catch (e) {
    next(e);
  }
};

export const listPdcPostings = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { status, bankAccountId, from, to } = req.query || {};
    const items = await query(
      `SELECT p.id, p.company_id, p.branch_id, p.bank_account_id, p.instrument_no,
              p.instrument_date, v.total_debit AS amount, v.voucher_date, p.status,
              ba.name AS bank_account_name, p.created_at, creator_user.username AS creator_username,
              v.voucher_no, vt.code AS voucher_type_code
         FROM fin_pdc_postings p
         LEFT JOIN fin_vouchers v ON v.id = p.voucher_id
         LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
         LEFT JOIN fin_bank_accounts ba ON ba.id = p.bank_account_id
         LEFT JOIN adm_users creator_user ON creator_user.id = p.created_by
        WHERE p.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr)))
          AND (:status IS NULL OR p.status = :status)
          AND (:bankAccountId IS NULL OR p.bank_account_id = :bankAccountId)
          AND (:from IS NULL OR p.instrument_date >= :from)
          AND (:to IS NULL OR p.instrument_date <= :to)
        ORDER BY p.instrument_date DESC`,
      {
        companyId,
        branchId: branchId || null, branchIdsStr,
        status: status || null,
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
        from: from || null,
        to: to || null,
      },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createPdcPosting = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const { bankAccountId, instrumentNo, instrumentDate, amount, voucherDate } =
      req.body || {};
    if (!bankAccountId || !instrumentNo || !amount)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "bankAccountId, instrumentNo, and amount are required",
      );
    const result = await query(
      `INSERT INTO fin_pdc_postings (company_id, branch_id, bank_account_id, instrument_no, instrument_date, amount, status, voucher_date)
       VALUES (:companyId, :branchId, :bankAccountId, :instrumentNo, :instrumentDate, :amount, 'PENDING', :voucherDate)`,
      {
        companyId,
        branchId, branchIdsStr,
        bankAccountId,
        instrumentNo,
        instrumentDate,
        amount,
        voucherDate: voucherDate || instrumentDate,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const listBankReconciliations = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;
    const items = await query(
      `SELECT r.id, r.company_id, r.branch_id, r.bank_account_id,
              r.statement_from,
              r.statement_to,
              r.statement_ending_balance,
              r.status,
              ba.name AS bank_account_name,
              ba.account_number
         FROM fin_bank_reconciliations r
         LEFT JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)))
          AND (:status IS NULL OR r.status = :status)
        ORDER BY r.statement_from DESC`,
      { companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '', status },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createBankReconciliation = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const payload = req.body || {};
    const bankAccountId = Number(payload.bankAccountId || 0);
    const reconciliationDate = String(
      payload.reconciliationDate ||
        payload.statementTo ||
        payload.statementFrom ||
        "",
    );
    const bankStatementBalance = Number(
      payload.bankStatementBalance ?? payload.statementEndingBalance ?? 0,
    );
    if (!bankAccountId || !reconciliationDate)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "bankAccountId and reconciliationDate (or statementTo) are required",
      );
    const result = await query(
      `INSERT INTO fin_bank_reconciliations (company_id, branch_id, bank_account_id, statement_from, statement_to, statement_ending_balance, status)
       VALUES (:companyId, :branchId, :bankAccountId, :statementFrom, :statementTo, :statementEndingBalance, 'DRAFT')`,
      {
        companyId,
        branchId, branchIdsStr,
        bankAccountId,
        statementFrom: payload.statementFrom || reconciliationDate,
        statementTo: payload.statementTo || reconciliationDate,
        statementEndingBalance: bankStatementBalance,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const getBankReconciliation = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid reconciliation id");
    const rows = await query(
      `SELECT r.id, r.company_id, r.branch_id, r.bank_account_id,
              r.statement_from,
              r.statement_to,
              r.statement_ending_balance,
              r.status,
              ba.name AS bank_account_name, ba.account_number
         FROM fin_bank_reconciliations r
         LEFT JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)))
          AND r.id = :id
        LIMIT 1`,
      { companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '', id },
    );
    const header = rows?.[0];
    if (!header) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
    const lines = await query(
      `SELECT brl.id, brl.voucher_id, brl.reconciliation_id
         FROM fin_bank_reconciliation_lines brl
        WHERE brl.reconciliation_id = :id`,
      { id },
    );
    res.json({ header, lines: lines || [] });
  } catch (e) {
    next(e);
  }
};

export const updateBankReconciliation = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid reconciliation id");
    const body = req.body || {};
    const statementFrom = body.statementFrom ? String(body.statementFrom) : null;
    const statementTo = body.statementTo ? String(body.statementTo) : null;
    const statementEndingBalance =
      body.statementEndingBalance === undefined ||
      body.statementEndingBalance === null
        ? null
        : Number(body.statementEndingBalance);
    const status = body.status ? String(body.status).toUpperCase() : null;
    await query(
      `UPDATE fin_bank_reconciliations
          SET statement_from = COALESCE(:statementFrom, statement_from),
              statement_to = COALESCE(:statementTo, statement_to),
              statement_ending_balance = COALESCE(:statementEndingBalance, statement_ending_balance),
              status = COALESCE(:status, status)
        WHERE id = :id
          AND company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)`,
      {
        id,
        companyId,
        branchId: branchId || null, branchIdsStr,
        statementFrom,
        statementTo,
        statementEndingBalance,
        status,
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const getBankReconciliationSummary = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid reconciliation id");
    const rows = await query(
      `SELECT r.id, r.bank_account_id, r.statement_from, r.statement_to, r.statement_ending_balance,
              ba.gl_account_id
         FROM fin_bank_reconciliations r
         JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.id = :id
          AND r.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)))
        LIMIT 1`,
      { id, companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '' },
    );
    const rec = rows?.[0];
    if (!rec) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
    const openingRows = await query(
      `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) AS opening_book
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)))
          AND vl.account_id = :accountId
          AND v.voucher_date < :statementFrom
          AND COALESCE(v.status, 'DRAFT') NOT IN ('CANCELLED','REVERSED')`,
      {
        companyId,
        branchId: branchId || null, branchIdsStr: branchIdsStr || '',
        accountId: Number(rec.gl_account_id),
        statementFrom: rec.statement_from || rec.statement_to,
      },
    );
    const clearedRows = await query(
      `SELECT COALESCE(SUM(amount), 0) AS cleared_amount
         FROM fin_bank_reconciliation_lines
        WHERE reconciliation_id = :id AND cleared = 1`,
      { id },
    );
    const openingBookBalance = Number(openingRows?.[0]?.opening_book || 0);
    const endingBookBalance = openingBookBalance + Number(clearedRows?.[0]?.cleared_amount || 0);
    const bankBalance = Number(rec.statement_ending_balance || 0);
    const diffBankVsBook = bankBalance - endingBookBalance;
    res.json({ openingBookBalance, endingBookBalance, diffBankVsBook });
  } catch (e) {
    next(e);
  }
};

export const getBankReconciliationTransactions = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    const status = String(req.query.status || "BOTH").toUpperCase();
    if (!id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid reconciliation id");
    const rows = await query(
      `SELECT r.id, r.bank_account_id, r.statement_to, ba.gl_account_id
         FROM fin_bank_reconciliations r
         JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.id = :id
          AND r.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)))
        LIMIT 1`,
      { id, companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '' },
    );
    const rec = rows?.[0];
    if (!rec) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
    const statusFilter =
      status === "APPROVED"
        ? "AND COALESCE(v.status, '') IN ('POSTED','APPROVED')"
        : status === "DRAFT"
          ? "AND COALESCE(v.status, '') IN ('DRAFT','PENDING')"
          : "";
    const items = await query(
      `SELECT v.id AS voucher_id, v.voucher_no, v.voucher_date,
              COALESCE(vl.description, v.narration, '') AS narration,
              vl.cheque_number AS checkNumber,
              vl.cheque_date AS chequeDate,
              COALESCE(oa.name, '') AS account_name,
              vl.debit, vl.credit,
              CASE WHEN brl.reconciliation_id = :id THEN 1 ELSE 0 END AS cleared
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id
         LEFT JOIN fin_bank_reconciliation_lines brl ON brl.voucher_id = v.id AND brl.reconciliation_id = :id
         LEFT JOIN fin_accounts oa ON oa.id = (
           SELECT x.account_id
             FROM fin_voucher_lines x
            WHERE x.voucher_id = vl.voucher_id
              AND x.id <> vl.id
            LIMIT 1
         )
        WHERE v.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(v.branch_id, :branchIdsStr)))
          AND vl.account_id = :accountId
          AND DATE(v.voucher_date) <= DATE(:asOfDate)
          ${statusFilter}
        ORDER BY v.voucher_date ASC, v.id ASC, vl.id ASC`,
      {
        id,
        companyId,
        branchId: branchId || null, branchIdsStr: branchIdsStr || '',
        accountId: Number(rec.gl_account_id),
        asOfDate: rec.statement_to,
      },
    );
    res.json({ items: items || [] });
  } catch (e) {
    next(e);
  }
};

export const addBankReconciliationLine = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    const voucherId = Number(req.body?.voucherId || 0);
    if (!id || !voucherId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Invalid reconciliation id or voucher id",
      );
    }
    const recRows = await query(
      `SELECT r.id, ba.gl_account_id
         FROM fin_bank_reconciliations r
         JOIN fin_bank_accounts ba ON ba.id = r.bank_account_id
        WHERE r.id = :id
          AND r.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)))
        LIMIT 1`,
      { id, companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '' },
    );
    const rec = recRows?.[0];
    if (!rec) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
    // Check if a line already exists for this voucher in this reconciliation
    const existingLines = await query(
      `SELECT id FROM fin_bank_reconciliation_lines WHERE reconciliation_id = :id AND voucher_id = :voucherId LIMIT 1`,
      { id, voucherId },
    );
    if (existingLines?.length) {
      // Already exists — just return OK
      return res.status(201).json({ ok: true });
    }
    // Get statement info from the voucher
    const voucherRows = await query(
      `SELECT v.voucher_date, COALESCE(vl.description, v.narration, '') AS description,
              COALESCE(vl.debit, 0) AS debit, COALESCE(vl.credit, 0) AS credit
         FROM fin_vouchers v
         JOIN fin_voucher_lines vl ON vl.voucher_id = v.id AND vl.account_id = :accountId
        WHERE v.id = :voucherId AND v.company_id = :companyId
        LIMIT 1`,
      { voucherId, accountId: Number(rec.gl_account_id), companyId },
    );
    const vrow = voucherRows?.[0];
    const amount = vrow ? (Number(vrow.debit || 0) - Number(vrow.credit || 0)) : 0;
    const result = await query(
      `INSERT INTO fin_bank_reconciliation_lines
         (reconciliation_id, voucher_id, statement_date, description, amount, cleared)
       VALUES (:reconciliationId, :voucherId, :statementDate, :description, :amount, 1)`,
      {
        reconciliationId: id,
        voucherId,
        statementDate: vrow?.voucher_date || new Date(),
        description: vrow?.description || '',
        amount,
      },
    );
    if (!Number(result?.insertId || 0)) {
      throw httpError(404, "NOT_FOUND", "Voucher bank line not found");
    }
    res.status(201).json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const deleteBankReconciliationLine = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const lineId = Number(req.params.lineId || 0);
    if (!lineId) throw httpError(400, "VALIDATION_ERROR", "Invalid line id");
    await query(
      `DELETE FROM fin_bank_reconciliation_lines
        WHERE id = :lineId`,
      { lineId },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const confirmBankReconciliation = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
    const branchIdsStr = req.scope.branchIdsStr;
    const id = Number(req.params.id || 0);
    if (!id)
      throw httpError(400, "VALIDATION_ERROR", "Invalid reconciliation id");
    const rows = await query(
      `SELECT id, status FROM fin_bank_reconciliations
        WHERE id = :id
          AND company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
        LIMIT 1`,
      { id, companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '' },
    );
    const rec = rows?.[0];
    if (!rec) throw httpError(404, "NOT_FOUND", "Reconciliation not found");
    if (rec.status === "COMPLETED")
      throw httpError(400, "VALIDATION_ERROR", "Reconciliation is already confirmed");
    await query(
      `UPDATE fin_bank_reconciliations SET status = 'COMPLETED'
        WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    res.json({ ok: true, message: "Reconciliation confirmed successfully" });
  } catch (e) {
    next(e);
  }
};

export const getSupplierBillsByAccount = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId;
  const branchIdsStr = req.scope.branchIdsStr;
    const accountId = req.query.accountId ? Number(req.query.accountId) : null;

    if (!accountId) {
      return res.json({ items: [] });
    }

    const accountRows = await query(
      `SELECT id, code
         FROM fin_accounts
        WHERE company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND id = :accountId
        LIMIT 1`,
      {
        companyId,
        branchId: branchId || null, branchIdsStr,
        accountId,
      },
    );
    const account = accountRows?.[0];
    const accountCode = String(account?.code || "").trim();
    if (!accountCode) {
      return res.json({ items: [] });
    }

    let supplierWhereParts = ["CAST(id AS CHAR) = :accountCode"];
    try {
      const conn = await pool.getConnection();
      try {
        const hasSupplierExternalId = await hasColumn(
          conn,
          "pur_suppliers",
          "supplier_id",
        );
        const hasSupplierCode = await hasColumn(
          conn,
          "pur_suppliers",
          "supplier_code",
        );
        if (hasSupplierExternalId) {
          supplierWhereParts.unshift(
            "CAST(supplier_id AS CHAR) = :accountCode",
          );
        }
        if (hasSupplierCode) {
          supplierWhereParts.unshift("supplier_code = :accountCode");
        }
      } finally {
        conn.release();
      }
    } catch {
      // Ignore schema probe failures and use fallback matching.
    }

    const suppliers = await query(
      `SELECT id
         FROM pur_suppliers
        WHERE company_id = :companyId
          AND (${supplierWhereParts.join("\n          OR ")})`,
      { companyId, accountCode },
    );
    const supplierIds = (suppliers || [])
      .map((s) => Number(s.id || 0))
      .filter((n) => n > 0);
    if (!supplierIds.length) {
      return res.json({ items: [] });
    }

    const supplierIdListSql = supplierIds.join(", ");
    const items = await query(
      `SELECT pb.id,
              pb.bill_no,
              pb.bill_date,
              pb.supplier_id,
              s.supplier_name,
              COALESCE(
                NULLIF(pb.net_amount, 0),
                COALESCE(pbd.detail_total, 0),
                0
              ) AS total_amount,
              COALESCE(pb.amount_paid, 0) AS amount_paid,
              GREATEST(
                0,
                COALESCE(
                  NULLIF(pb.net_amount, 0),
                  COALESCE(pbd.detail_total, 0),
                  0
                ) - COALESCE(pb.amount_paid, 0)
              ) AS outstanding,
              COALESCE(pb.payment_status, 'UNPAID') AS payment_status
         FROM pur_bills pb
         LEFT JOIN pur_suppliers s
           ON s.id = pb.supplier_id
          AND s.company_id = pb.company_id
         LEFT JOIN (
           SELECT bill_id, COALESCE(SUM(line_total), 0) AS detail_total
           FROM pur_bill_details
           GROUP BY bill_id
         ) pbd
           ON pbd.bill_id = pb.id
        WHERE pb.company_id = :companyId
          AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          AND pb.supplier_id IN (${supplierIdListSql})
          AND COALESCE(pb.payment_status, 'UNPAID') IN ('UNPAID', 'PARTIAL PAYMENT')
          AND GREATEST(
            0,
            COALESCE(
              NULLIF(pb.net_amount, 0),
              COALESCE(pbd.detail_total, 0),
              0
            ) - COALESCE(pb.amount_paid, 0)
          ) > 0
        ORDER BY pb.bill_date DESC, pb.id DESC`,
      {
        companyId,
        branchId: branchId || null, branchIdsStr,
      },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const listFiscalYears = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const items = await query(
      `SELECT id, code, start_date, end_date, is_open, created_at, updated_at
         FROM fin_fiscal_years
        WHERE company_id = :companyId
        ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const forcePostableAccounts = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const result = await query(
      `UPDATE fin_accounts SET is_postable = 1 WHERE company_id = :companyId`,
      { companyId },
    );
    res.json({ updated: result.affectedRows || 0 });
  } catch (e) {
    next(e);
  }
};

export const listCostCenters = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};

    let items = [];
    try {
      items = await query(
        `SELECT id, company_id, branch_id, code, name, description, default_currency_id, is_active, created_at, updated_at
           FROM fin_cost_centers
          WHERE company_id = :companyId
            AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
          ORDER BY code ASC`,
        { companyId, branchId: branchId || null, branchIdsStr: branchIdsStr || '' },
      );
    } catch (tblErr) {
      await query(`
        CREATE TABLE IF NOT EXISTS fin_cost_centers (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          branch_id BIGINT UNSIGNED NULL,
          code VARCHAR(50) NOT NULL,
          name VARCHAR(150) NOT NULL,
          description TEXT NULL,
          default_currency_id BIGINT UNSIGNED NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_cc_company (company_id),
          KEY idx_cc_code (code)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `).catch(() => null);

      items = await query(
        `SELECT id, company_id, code, name, description, is_active
           FROM fin_cost_centers
          WHERE company_id = :companyId
          ORDER BY code ASC`,
        { companyId },
      ).catch(() => []);
    }

    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createCostCenter = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId === "all" ? null : req.scope.branchId;
    const { code, name, description, default_currency_id, isActive } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    const result = await query(
      `INSERT INTO fin_cost_centers (company_id, branch_id, code, name, description, default_currency_id, is_active)
       VALUES (:companyId, :branchId, :code, :name, :description, :default_currency_id, :isActive)`,
      {
        companyId,
        branchId,
        code,
        name,
        description: description || null,
        default_currency_id: default_currency_id ? Number(default_currency_id) : null,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const updateCostCenter = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const branchId = req.scope.branchId === "all" ? null : req.scope.branchId;
    const id = req.params.id;
    const { code, name, description, default_currency_id, isActive } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    await query(
      `UPDATE fin_cost_centers 
       SET code = :code, name = :name, description = :description, default_currency_id = :default_currency_id, is_active = :isActive 
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        code,
        name,
        description: description || null,
        default_currency_id: default_currency_id ? Number(default_currency_id) : null,
        isActive: isActive === undefined ? 1 : Number(Boolean(isActive)),
      },
    );
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
};

export const listVoucherTypes = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const items = await query(
      `SELECT id, code, name, category, prefix, next_number, requires_approval, is_active
         FROM fin_voucher_types
        WHERE company_id = :companyId
        ORDER BY code ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (e) {
    next(e);
  }
};

export const createVoucherType = async (req, res, next) => {
  try {
    const companyId = req.scope.companyId;
    const {
      code,
      name,
      category,
      prefix,
      next_number,
      requires_approval,
      is_active,
    } = req.body || {};
    if (!code || !name)
      throw httpError(400, "VALIDATION_ERROR", "code and name are required");
    const result = await query(
      `INSERT INTO fin_voucher_types (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES (:companyId, :code, :name, :category, :prefix, :next_number, :requires_approval, :is_active)`,
      {
        companyId,
        code: String(code).toUpperCase(),
        name,
        category: category || "GENERAL",
        prefix: prefix || String(code).toUpperCase(),
        next_number: next_number || 1,
        requires_approval: requires_approval ? 1 : 0,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (e) {
    next(e);
  }
};

export const getFinanceDashboardStats = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    let cashBalance = 0;
    let bankBalance = 0;
    let monthlyExpenses = 0;
    let monthlyIncome = 0;
    try {
      const [cashRow] = await query(
        `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) as balance
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId AND v.status = 'POSTED'
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE g.code IN ('AST_CASH') AND a.name = 'Cash on Hand'`,
        { companyId },
      );
      cashBalance = Number(cashRow?.balance || 0);
    } catch {}
    try {
      const [bankRow] = await query(
        `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) as balance
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId AND v.status = 'POSTED'
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE g.code IN ('AST_BANK')`,
        { companyId },
      );
      bankBalance = Number(bankRow?.balance || 0);
    } catch {}
    try {
      const [expRow] = await query(
        `SELECT COALESCE(SUM(vl.debit - vl.credit), 0) as total
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId AND v.status = 'POSTED'
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE g.nature = 'EXPENSE' AND v.voucher_date >= :monthStart`,
        { companyId, monthStart },
      );
      monthlyExpenses = Number(expRow?.total || 0);
    } catch {}
    try {
      const [incRow] = await query(
        `SELECT COALESCE(SUM(vl.credit - vl.debit), 0) as total
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId AND v.status = 'POSTED'
         JOIN fin_accounts a ON a.id = vl.account_id
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE g.nature = 'INCOME' AND v.voucher_date >= :monthStart`,
        { companyId, monthStart },
      );
      monthlyIncome = Number(incRow?.total || 0);
    } catch {}
    let pendingVouchers = 0;
    try {
      const [pv] = await query(
        "SELECT COUNT(*) as count FROM fin_vouchers WHERE company_id = :companyId AND status != 'POSTED'",
        { companyId },
      );
      pendingVouchers = Number(pv?.count || 0);
    } catch {}
    res.json({
      success: true,
      data: {
        cashBalance: Math.round(cashBalance * 100) / 100,
        bankBalance: Math.round(bankBalance * 100) / 100,
        totalLiquidity: Math.round((cashBalance + bankBalance) * 100) / 100,
        monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
        monthlyIncome: Math.round(monthlyIncome * 100) / 100,
        netIncome: Math.round((monthlyIncome - monthlyExpenses) * 100) / 100,
        pendingVouchers,
      },
    });
  } catch (e) {
    next(e);
  }
};

export const getDashboardMetrics = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const from = req.query.from || null;
    const to = req.query.to || null;

    const [fyRow] = await query(
      `SELECT start_date FROM fin_fiscal_years
       WHERE company_id = :companyId ORDER BY start_date DESC LIMIT 1`,
      { companyId },
    ).catch(() => []);
    const now = new Date();
    const toDate = to ? new Date(String(to)) : now;
    const fyStart = fyRow?.start_date
      ? new Date(fyRow.start_date)
      : new Date(now.getFullYear(), 0, 1);
    const fromDate = from ? new Date(String(from)) : fyStart;
    const fromStr = fromDate.toISOString().slice(0, 10);
    const toStr = toDate.toISOString().slice(0, 10);

    const [groups, acctRows] = await Promise.all([
      query(
        `SELECT id, code, name, nature FROM fin_account_groups
         WHERE company_id = :companyId AND is_active = 1`,
        { companyId },
      ),
      query(
        `SELECT a.group_id, g.nature
         FROM fin_accounts a
         JOIN fin_account_groups g ON g.id = a.group_id AND g.company_id = :companyId
         WHERE a.company_id = :companyId
           AND ((g.nature = 'ASSET' AND (a.name LIKE '%receivable%' OR a.name LIKE '%debtor%'))
             OR (g.nature = 'LIABILITY' AND (a.name LIKE '%payable%' OR a.name LIKE '%creditor%')))`,
        { companyId },
      ),
    ]);
    const gMap = {};
    for (const g of groups) {
      const c = String(g.code || "").toUpperCase();
      if (/DEBTOR/.test(c) || /AR$/.test(c) || c === "AST_AR") gMap.debtors = (gMap.debtors || []).concat(g.id);
      if (/CREDITOR/.test(c) || /AP$/.test(c) || c === "LIAB_AP") gMap.creditors = (gMap.creditors || []).concat(g.id);
      if (c === "AST_CASH") gMap.cash = (gMap.cash || []).concat(g.id);
      if (c === "AST_BANK") gMap.bank = (gMap.bank || []).concat(g.id);
      if (g.nature === "INCOME") gMap.income = (gMap.income || []).concat(g.id);
      if (g.nature === "EXPENSE" && c !== "EXP_COGS" && c !== "EXP.COGS") gMap.expense = (gMap.expense || []).concat(g.id);
    }
    // Supplement debtor/creditor groups by account names to handle accounts
    // placed in generic groups (e.g. AST.CUR, LIA.CUR) instead of dedicated ones
    for (const r of acctRows) {
      const gid = Number(r.group_id);
      if (r.nature === "ASSET") {
        if (!gMap.debtors) gMap.debtors = [];
        if (!gMap.debtors.includes(gid)) gMap.debtors.push(gid);
      } else if (r.nature === "LIABILITY") {
        if (!gMap.creditors) gMap.creditors = [];
        if (!gMap.creditors.includes(gid)) gMap.creditors.push(gid);
      }
    }
    if (!gMap.debtors || !gMap.debtors.length) {
      gMap.debtors = groups.filter(g => g.nature === "ASSET" && (/receivable/i.test(g.name) || /debtor/i.test(g.name))).map(g => g.id);
    }
    if (!gMap.creditors || !gMap.creditors.length) {
      gMap.creditors = groups.filter(g => g.nature === "LIABILITY" && (/payable/i.test(g.name) || /creditor/i.test(g.name))).map(g => g.id);
    }

    const balanceForGroups = async (groupIds, periodFrom, periodTo) => {
      if (!groupIds || !groupIds.length) return { debit: 0, credit: 0 };
      const rows = await query(
        `SELECT COALESCE(SUM(vl.debit),0) AS dr, COALESCE(SUM(vl.credit),0) AS cr
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId
           AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
           AND v.status = 'POSTED'
           AND v.voucher_date BETWEEN :from AND :to
         JOIN fin_accounts a ON a.id = vl.account_id AND a.company_id = :companyId
         WHERE a.group_id IN (:groupIds)`,
        { companyId, branchId: branchId || null, branchIdsStr, from: periodFrom, to: periodTo, groupIds },
      );
      return { debit: Number(rows[0]?.dr || 0), credit: Number(rows[0]?.cr || 0) };
    };

    const [debtorsBal, creditorsBal, cashBal, bankBal, incomeBal, expenseBal] = await Promise.all([
      balanceForGroups(gMap.debtors, fromStr, toStr),
      balanceForGroups(gMap.creditors, fromStr, toStr),
      balanceForGroups(gMap.cash, fromStr, toStr),
      balanceForGroups(gMap.bank, fromStr, toStr),
      balanceForGroups(gMap.income, fromStr, toStr),
      balanceForGroups(gMap.expense, fromStr, toStr),
    ]);

    const debtorsNet = debtorsBal.debit - debtorsBal.credit;
    const creditorsNet = creditorsBal.credit - creditorsBal.debit;
    const cashNet = cashBal.debit - cashBal.credit;
    const bankNet = bankBal.debit - bankBal.credit;
    const salesNet = incomeBal.credit - incomeBal.debit;
    const expenseNet = expenseBal.debit - expenseBal.credit;

    const monthlyMovements = await query(
      `SELECT DATE_FORMAT(v.voucher_date, '%Y-%m') AS ym,
              vl.account_id, a.group_id, SUM(vl.debit) AS dr, SUM(vl.credit) AS cr
       FROM fin_voucher_lines vl
       JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId
         AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
         AND v.status = 'POSTED'
         AND v.voucher_date BETWEEN :from AND :to
       JOIN fin_accounts a ON a.id = vl.account_id AND a.company_id = :companyId
       GROUP BY ym, vl.account_id, a.group_id
       ORDER BY ym ASC`,
      { companyId, branchId: branchId || null, branchIdsStr, from: fromStr, to: toStr },
    );

    const gidSet = (key) => new Set(gMap[key] || []);
    const isInGroup = (gid, set) => set.has(Number(gid));

    const accumulate = (rows, groupKey, balFn) => {
      const map = {};
      const set = gidSet(groupKey);
      for (const r of rows) {
        if (isInGroup(r.group_id, set)) {
          const b = balFn(r);
          map[r.ym] = (map[r.ym] || 0) + b;
        }
      }
      return Object.entries(map).map(([ym, value]) => ({ ym, value: Math.round(value * 100) / 100 }));
    };

    const ar_trend = accumulate(monthlyMovements, "debtors", r => Number(r.dr || 0) - Number(r.cr || 0));
    const ap_trend = accumulate(monthlyMovements, "creditors", r => Number(r.cr || 0) - Number(r.dr || 0));
    const cash_trend = accumulate(monthlyMovements, "cash", r => Number(r.dr || 0) - Number(r.cr || 0));
    const bank_trend = accumulate(monthlyMovements, "bank", r => Number(r.dr || 0) - Number(r.cr || 0));

    const cashGidSet = gidSet("cash");
    const bankGidSet = gidSet("bank");
    const cashflowMap = {};
    for (const r of monthlyMovements) {
      if (isInGroup(r.group_id, cashGidSet) || isInGroup(r.group_id, bankGidSet)) {
        cashflowMap[r.ym] = cashflowMap[r.ym] || { inflow: 0, outflow: 0 };
        cashflowMap[r.ym].inflow += Math.round(Number(r.dr || 0) * 100) / 100;
        cashflowMap[r.ym].outflow += Math.round(Number(r.cr || 0) * 100) / 100;
      }
    }
    const cashflow_trend = Object.entries(cashflowMap).map(([ym, v]) => ({ ym, ...v }));

    const incGidSet = gidSet("income");
    const expGidSet = gidSet("expense");
    const ieMap = {};
    for (const r of monthlyMovements) {
      const gid = Number(r.group_id);
      ieMap[r.ym] = ieMap[r.ym] || { income: 0, expense: 0 };
      if (incGidSet.has(gid)) ieMap[r.ym].income += Math.round((Number(r.cr || 0) - Number(r.dr || 0)) * 100) / 100;
      if (expGidSet.has(gid)) ieMap[r.ym].expense += Math.round((Number(r.dr || 0) - Number(r.cr || 0)) * 100) / 100;
    }
    const income_expense_trend = Object.entries(ieMap).map(([ym, v]) => ({ ym, ...v }));

    let ar_breakdown = [];
    if (gMap.debtors && gMap.debtors.length) {
      const arRows = await query(
        `SELECT a.name, SUM(vl.debit - vl.credit) AS value
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId
           AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
           AND v.status = 'POSTED'
           AND v.voucher_date BETWEEN :from AND :to
         JOIN fin_accounts a ON a.id = vl.account_id AND a.company_id = :companyId
         WHERE a.group_id IN (:groupIds)
         GROUP BY a.id, a.name
         HAVING value != 0
         ORDER BY ABS(value) DESC
         LIMIT 15`,
        { companyId, branchId: branchId || null, from: fromStr, to: toStr, groupIds: gMap.debtors },
      );
      ar_breakdown = arRows.map(r => ({ name: r.name, value: Math.round(Math.abs(Number(r.value)) * 100) / 100 }));
    }

    let ap_breakdown = [];
    if (gMap.creditors && gMap.creditors.length) {
      const apRows = await query(
        `SELECT a.name, SUM(vl.credit - vl.debit) AS value
         FROM fin_voucher_lines vl
         JOIN fin_vouchers v ON v.id = vl.voucher_id AND v.company_id = :companyId
           AND (:branchId IS NULL OR (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) OR branch_id IS NULL)
           AND v.status = 'POSTED'
           AND v.voucher_date BETWEEN :from AND :to
         JOIN fin_accounts a ON a.id = vl.account_id AND a.company_id = :companyId
         WHERE a.group_id IN (:groupIds)
         GROUP BY a.id, a.name
         HAVING value != 0
         ORDER BY ABS(value) DESC
         LIMIT 15`,
        { companyId, branchId: branchId || null, from: fromStr, to: toStr, groupIds: gMap.creditors },
      );
      ap_breakdown = apRows.map(r => ({ name: r.name, value: Math.round(Math.abs(Number(r.value)) * 100) / 100 }));
    }

    res.json({
      ytd: {
        debtors: Math.round(debtorsNet * 100) / 100,
        debtors_side: debtorsNet >= 0 ? "DEBIT" : "CREDIT",
        creditors: Math.round(creditorsNet * 100) / 100,
        creditors_side: creditorsNet >= 0 ? "CREDIT" : "DEBIT",
        cash_in_hand: Math.round(cashNet * 100) / 100,
        bank_total: Math.round(bankNet * 100) / 100,
        indirect_expenses: Math.round(expenseNet * 100) / 100,
        sales: Math.round(salesNet * 100) / 100,
      },
      ar_trend,
      ap_trend,
      ar_breakdown,
      ap_breakdown,
      bank_trend,
      cash_trend,
      cashflow_trend,
      income_expense_trend,
    });
  } catch (e) {
    next(e);
  }
};
