import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { checkModuleAccess, checkFeatureAction } from "../middleware/access.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as posController from "../controllers/pos.controller.js";
import {
  consumeStockFIFOTx,
  ensureStockBalancesWarehouseInfrastructure,
  recordMovementTx,
} from "../services/stock.service.js";
import { ensureCustomerFinAccountIdTx } from "../controllers/finance.controller.js";
import multer from "multer";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function roundTo2(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toYmd(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function normalizeDenominationCounts(input) {
  if (input === undefined || input === null || input === "") return null;
  let parsed = input;
  if (typeof input === "string") {
    try {
      parsed = JSON.parse(input);
    } catch {
      return null;
    }
  }
  if (Array.isArray(parsed)) {
    const next = parsed.map((v) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : 0;
    });
    return JSON.stringify(next);
  }
  if (typeof parsed === "object") {
    const next = {};
    for (const [k, v] of Object.entries(parsed || {})) {
      const n = Number(v);
      next[k] = Number.isFinite(n) && n > 0 ? n : 0;
    }
    return JSON.stringify(next);
  }
  return null;
}

async function nextReceiptNoTx(conn, companyId) {
  const [rows] = await conn.execute(
    `
    SELECT receipt_no
    FROM pos_sales
    WHERE company_id = :companyId
      AND receipt_no REGEXP '^POS-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(receipt_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    FOR UPDATE
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `POS-${String(nextNum).padStart(6, "0")}`;
}

async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT id, prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId FOR UPDATE",
    { companyId, voucherTypeId },
  );
  const vt = rows?.[0];
  if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
  const code = String(vt?.prefix || "").toUpperCase();
  const needPad =
    code === "PV" ||
    code === "CV" ||
    code === "RV" ||
    code === "JV" ||
    code === "SV";
  const seq = needPad
    ? String(vt.next_number).padStart(6, "0")
    : String(vt.next_number);
  const voucherNo = `${vt.prefix}${seq}`;
  await conn.execute(
    "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
    { companyId, voucherTypeId },
  );
  return voucherNo;
}

async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code AND is_active = 1 LIMIT 1",
    { companyId, code },
  );
  const id = Number(rows?.[0]?.id || 0);
  return id || 0;
}

async function ensureJournalVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "JV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'JV', 'Journal Voucher', 'JOURNAL', 'JV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "JV" });
  return id || 0;
}

async function ensureReceiptVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "RV",
  });
  if (existingId) return existingId;

  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'RV', 'Receipt Voucher', 'RECEIPT', 'RV', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }

  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "RV" });
  return id || 0;
}

async function ensureSalesVoucherTypeIdTx(conn, { companyId }) {
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "SV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `
      INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
      VALUES
        (:companyId, 'SV', 'Sales Voucher', 'SALES', 'SV', 1, 0, 1)
      `,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "SV" });
  return id || 0;
}

async function resolveOpenFiscalYearId(conn, { companyId }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_fiscal_years WHERE company_id = :companyId AND is_open = 1 ORDER BY start_date DESC LIMIT 1",
    { companyId },
  );
  const id = Number(rows?.[0]?.id || 0);
  if (id) return id;

  const today = new Date();
  const todayYmd = toYmd(today);
  if (!todayYmd) return 0;

  const [inRangeRows] = await conn.execute(
    `
    SELECT id, is_open
    FROM fin_fiscal_years
    WHERE company_id = :companyId
      AND :todayYmd >= start_date
      AND :todayYmd <= end_date
    ORDER BY start_date DESC
    LIMIT 1
    `,
    { companyId, todayYmd },
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

  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;
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

async function resolveFinAccountId(conn, { companyId, accountRef }) {
  const raw = String(accountRef || "").trim();
  if (!raw) return 0;

  const asId = Number(raw);
  if (Number.isFinite(asId) && asId > 0) {
    const [rows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: asId },
    );
    return Number(rows?.[0]?.id || 0) || 0;
  }

  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: raw },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function ensureFinAccountExistsTx(
  conn,
  { companyId, code, name, nature },
) {
  const codeStr = String(code || "").trim();
  const nameStr = String(name || "").trim() || codeStr;
  const nat = String(nature || "")
    .trim()
    .toUpperCase();
  if (!codeStr) return 0;
  const [exists] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: codeStr },
  );
  const exId = Number(exists?.[0]?.id || 0) || 0;
  if (exId) return exId;
  // Ensure group for the nature
  const [grpRows] = await conn.execute(
    "SELECT id FROM fin_account_groups WHERE company_id = :companyId AND nature = :nature LIMIT 1",
    { companyId, nature: nat || "ASSET" },
  );
  let groupId = Number(grpRows?.[0]?.id || 0) || 0;
  if (!groupId) {
    const [gIns] = await conn.execute(
      `INSERT INTO fin_account_groups (company_id, code, name, nature, is_active)
       VALUES (:companyId, :code, :name, :nature, 1)`,
      {
        companyId,
        code: nat || "ASSET",
        name: nat || "ASSET",
        nature: nat || "ASSET",
      },
    );
    groupId = Number(gIns?.insertId || 0) || 0;
  }
  const [ins] = await conn.execute(
    `INSERT INTO fin_accounts (company_id, group_id, code, name, is_control_account, is_postable, is_active)
     VALUES (:companyId, :groupId, :code, :name, 0, 1, 1)`,
    { companyId, groupId, code: codeStr, name: nameStr },
  );
  return Number(ins?.insertId || 0) || 0;
}

async function ensureFinanceReportingInfrastructure() {
  try {
    await query(`CREATE OR REPLACE VIEW fin_general_ledger AS
       SELECT 
         v.company_id,
         v.branch_id,
         v.id AS voucher_id,
         v.voucher_no,
         v.voucher_date,
         v.voucher_type_id,
         l.line_no,
         l.account_id,
         a.code AS account_code,
         a.name AS account_name,
         l.description,
         l.debit,
         l.credit,
          v.created_at,
          u.username AS created_by_name
         FROM fin_vouchers v
       JOIN fin_voucher_lines l ON l.voucher_id = v.id
       LEFT JOIN fin_accounts a ON a.id = l.account_id
        LEFT JOIN adm_users u ON u.id = v.created_by
        `);
  } catch {}
  try {
    await query(`CREATE OR REPLACE VIEW fin_journal_report AS
       SELECT 
         v.company_id,
         v.branch_id,
         v.voucher_no,
         v.voucher_date,
         vt.code AS voucher_type_code,
         vt.name AS voucher_type_name,
         l.line_no,
         a.code AS account_code,
         a.name AS account_name,
         l.description,
         l.debit,
         l.credit,
          v.created_at,
          u.username AS created_by_name
         FROM fin_vouchers v
       JOIN fin_voucher_lines l ON l.voucher_id = v.id
       LEFT JOIN fin_accounts a ON a.id = l.account_id
       LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
        LEFT JOIN adm_users u ON u.id = v.created_by
        `);
  } catch {}
}

async function resolveFinAccountIdByLabel(conn, { companyId, label }) {
  const raw = String(label || "").trim();
  if (!raw) return 0;
  let codeCandidate = null;
  const dashMatch = raw.match(/^(\w+)\s*-\s*/);
  if (dashMatch && dashMatch[1]) codeCandidate = dashMatch[1];
  const parenMatch = raw.match(/\((\w+)\)\s*$/);
  if (parenMatch && parenMatch[1])
    codeCandidate = codeCandidate || parenMatch[1];
  const bracketMatch = raw.match(/^\[(\w+)\]/);
  if (bracketMatch && bracketMatch[1])
    codeCandidate = codeCandidate || bracketMatch[1];
  if (codeCandidate) {
    const [cRows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
      { companyId, code: codeCandidate },
    );
    const cid = Number(cRows?.[0]?.id || 0) || 0;
    if (cid) return cid;
  }
  const nameCandidate = raw
    .replace(/^\[(\w+)\]\s*/, "")
    .replace(/^(\w+)\s*-\s*/, "")
    .replace(/\s*\(\w+\)\s*$/, "")
    .trim();
  if (nameCandidate) {
    const [nRows] = await conn.execute(
      "SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = :name LIMIT 1",
      { companyId, name: nameCandidate },
    );
    const nid = Number(nRows?.[0]?.id || 0) || 0;
    if (nid) return nid;
  }
  const [rows] = await conn.execute(
    "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code: raw },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
async function resolveDefaultSalesAccountId(conn, { companyId }) {
  const [rows] = await conn.execute(
    `
    SELECT a.id
    FROM fin_accounts a
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE a.company_id = :companyId
      AND a.is_active = 1
      AND a.is_postable = 1
      AND g.nature = 'INCOME'
    ORDER BY
      CASE
        WHEN a.code IN ('4000','400000') THEN 0
        WHEN LOWER(a.name) LIKE '%sales%' THEN 1
        WHEN LOWER(a.code) LIKE '4%' THEN 2
        ELSE 3
      END,
      a.code
    LIMIT 1
    `,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}

async function fetchItemSalesAccountMap(conn, { companyId, itemIds }) {
  const ids = Array.from(
    new Set((Array.isArray(itemIds) ? itemIds : []).map((n) => Number(n))),
  ).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) return new Map();

  const placeholders = ids.map((_, idx) => `:id${idx}`).join(", ");
  const params = { companyId };
  for (let i = 0; i < ids.length; i += 1) {
    params[`id${i}`] = ids[i];
  }

  const [rows] = await conn.execute(
    `SELECT id, sales_account_id FROM inv_items WHERE company_id = :companyId AND id IN (${placeholders})`,
    params,
  );

  const m = new Map();
  for (const r of rows || []) {
    m.set(Number(r.id), Number(r.sales_account_id || 0));
  }
  return m;
}

async function hasColumn(tableName, columnName) {
  const rows = await query(
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

let _posTablesEnsured = false;
async function ensurePosTables() {
  if (_posTablesEnsured) return;
  _posTablesEnsured = true;
  await query(`
    CREATE TABLE IF NOT EXISTS pos_terminals (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      code VARCHAR(50) NOT NULL,
      name VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_terminal (company_id, code),
      KEY idx_pos_terminal_company (company_id),
      KEY idx_pos_terminal_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    ALTER TABLE pos_payment_modes
    MODIFY COLUMN type ENUM('cash','card','mobile','bank','other','credit') NOT NULL
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_terminal_users (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_terminal_user (company_id, branch_id, terminal_id, user_id),
      KEY idx_pos_terminal_users_terminal (terminal_id),
      KEY idx_pos_terminal_users_user (user_id),
      CONSTRAINT fk_ptu_terminal FOREIGN KEY (terminal_id) REFERENCES pos_terminals(id) ON DELETE CASCADE,
      CONSTRAINT fk_ptu_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sales (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_id BIGINT UNSIGNED NULL,
      receipt_no VARCHAR(50) NOT NULL,
      sale_datetime DATETIME NOT NULL,
      customer_name VARCHAR(150) NULL,
      payment_method ENUM('CASH','CARD','MOBILE','SPLIT','CREDIT') NOT NULL DEFAULT 'CASH',
      gross_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_components JSON NULL,
      net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','COMPLETED','VOID') NOT NULL DEFAULT 'COMPLETED',
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_receipt (company_id, receipt_no),
      KEY idx_pos_sale_company (company_id),
      KEY idx_pos_sale_branch (branch_id),
      KEY idx_pos_sale_terminal (terminal_id),
      KEY idx_pos_sale_datetime (sale_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  if (!(await hasColumn("pos_sales", "created_by"))) {
    await query(
      "ALTER TABLE pos_sales ADD COLUMN created_by BIGINT UNSIGNED NULL",
    );
  }

  if (!(await hasColumn("pos_sales", "tax_components"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN tax_components JSON NULL");
  }

  if (!(await hasColumn("pos_sales", "payments"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN payments JSON NULL");
  }

  if (!(await hasColumn("pos_sales", "customer_id"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN customer_id BIGINT UNSIGNED NULL AFTER customer_name");
  }

  if (!(await hasColumn("pos_sales", "payment_status"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN payment_status ENUM('PAID','UNPAID') NULL AFTER customer_id");
  }
  if (!(await hasColumn("pos_sales", "paid_amount"))) {
    await query("ALTER TABLE pos_sales ADD COLUMN paid_amount DECIMAL(18,2) NOT NULL DEFAULT 0.00 AFTER payment_status");
  }
  try {
    await query("UPDATE pos_sales SET paid_amount = net_amount WHERE payment_status = 'PAID' AND (paid_amount IS NULL OR paid_amount = 0)");
  } catch (e) {}

  try {
    const colRows = await query(`
      SELECT COLUMN_TYPE 
      FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'pos_sales' 
        AND COLUMN_NAME = 'payment_method'
    `);
    const colType = colRows?.[0]?.COLUMN_TYPE || '';
    if (colType && (!colType.includes("'SPLIT'") || !colType.includes("'CREDIT'"))) {
      await query("ALTER TABLE pos_sales MODIFY payment_method ENUM('CASH','CARD','MOBILE','SPLIT','CREDIT') NOT NULL DEFAULT 'CASH'");
    }
  } catch (e) {}

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sale_lines (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      sale_id BIGINT UNSIGNED NOT NULL,
      line_no INT NOT NULL,
      item_name VARCHAR(150) NOT NULL,
      qty DECIMAL(18,2) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_sale_line (sale_id, line_no),
      KEY idx_pos_line_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_sale_lines", "item_id"))) {
    await query(
      "ALTER TABLE pos_sale_lines ADD COLUMN item_id BIGINT UNSIGNED NULL AFTER line_no",
    );
  }

  if (!(await hasColumn("pos_sale_lines", "returned_qty"))) {
    await query(
      "ALTER TABLE pos_sale_lines ADD COLUMN returned_qty DECIMAL(18,3) NOT NULL DEFAULT 0 AFTER qty",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_returns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      sale_id BIGINT UNSIGNED NOT NULL,
      receipt_no VARCHAR(50) NOT NULL,
      return_datetime DATETIME NOT NULL,
      refund_method ENUM('CASH','CARD','MOBILE','SPLIT') NOT NULL DEFAULT 'CASH',
      total_refund DECIMAL(18,2) NOT NULL DEFAULT 0,
      notes TEXT NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pos_return_company (company_id),
      KEY idx_pos_return_branch (branch_id),
      KEY idx_pos_return_sale (sale_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_return_lines (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      return_id BIGINT UNSIGNED NOT NULL,
      sale_line_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NULL,
      item_name VARCHAR(150) NOT NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
      line_total DECIMAL(18,2) NOT NULL DEFAULT 0,
      reason VARCHAR(255) NULL,
      PRIMARY KEY (id),
      KEY idx_pos_return_line_return (return_id),
      KEY idx_pos_return_line_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_day_status (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      business_date DATE NOT NULL,
      open_datetime DATETIME NOT NULL,
      opening_float DECIMAL(18,2) NOT NULL DEFAULT 0,
      supervisor_name VARCHAR(150) NULL,
      open_notes TEXT NULL,
      close_datetime DATETIME NULL,
      actual_cash DECIMAL(18,2) NULL,
      close_notes TEXT NULL,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_day_status (company_id, branch_id, terminal_code, business_date),
      KEY idx_pos_day_company (company_id),
      KEY idx_pos_day_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_day_status", "open_denomination_counts"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN open_denomination_counts JSON NULL AFTER open_notes",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "close_denomination_counts"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN close_denomination_counts JSON NULL AFTER close_notes",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "next_opening_float"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN next_opening_float DECIMAL(18,2) NULL AFTER close_denomination_counts",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "actual_momo"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN actual_momo DECIMAL(18,2) NULL AFTER actual_cash",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_opening_balance"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_opening_balance DECIMAL(18,2) NULL AFTER actual_momo",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_closing_balance"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_closing_balance DECIMAL(18,2) NULL AFTER momo_opening_balance",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_closing_main"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_closing_main DECIMAL(18,2) NULL AFTER momo_closing_balance",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_closing_pay"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_closing_pay DECIMAL(18,2) NULL AFTER momo_closing_main",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_opening_main"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_opening_main DECIMAL(18,2) NULL AFTER momo_closing_pay",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "momo_opening_pay"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN momo_opening_pay DECIMAL(18,2) NULL AFTER momo_opening_main",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "created_by"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER status",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "closed_by"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN closed_by BIGINT UNSIGNED NULL AFTER created_by",
    ).catch(() => {});
  }
  if (!(await hasColumn("pos_day_status", "shift"))) {
    await query(
      "ALTER TABLE pos_day_status ADD COLUMN shift VARCHAR(50) NULL DEFAULT 'Shift 1 (Morning)' AFTER supervisor_name",
    ).catch(() => {});
  }
  try {
    await query("ALTER TABLE pos_day_status DROP INDEX uq_pos_day_status");
  } catch {}

  await query(`
    CREATE TABLE IF NOT EXISTS pos_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      day_status_id BIGINT UNSIGNED NULL,
      session_no VARCHAR(20) NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      cashier_name VARCHAR(150) NOT NULL,
      shift VARCHAR(50) NULL DEFAULT 'Shift 1 (Morning)',
      start_time DATETIME NOT NULL,
      end_time DATETIME NULL,
      opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_sales DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      created_by BIGINT UNSIGNED NULL,
      closed_by BIGINT UNSIGNED NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_session (company_id, branch_id, session_no),
      KEY idx_pos_session_company (company_id),
      KEY idx_pos_session_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_sessions", "day_status_id"))) {
    await query("ALTER TABLE pos_sessions ADD COLUMN day_status_id BIGINT UNSIGNED NULL AFTER branch_id").catch(() => {});
  }
  if (!(await hasColumn("pos_sessions", "shift"))) {
    await query("ALTER TABLE pos_sessions ADD COLUMN shift VARCHAR(50) NULL DEFAULT 'Shift 1 (Morning)' AFTER cashier_name").catch(() => {});
  }
  if (!(await hasColumn("pos_sessions", "created_by"))) {
    await query("ALTER TABLE pos_sessions ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER status").catch(() => {});
  }
  if (!(await hasColumn("pos_sessions", "closed_by"))) {
    await query("ALTER TABLE pos_sessions ADD COLUMN closed_by BIGINT UNSIGNED NULL AFTER created_by").catch(() => {});
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_payment_modes (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(100) NOT NULL,
      type ENUM('cash','card','mobile','bank','other','credit') NOT NULL,
      account VARCHAR(100) NULL,
      require_reference TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_pos_payment_modes_company (company_id),
      KEY idx_pos_payment_modes_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pos_tax_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      tax_code_id BIGINT UNSIGNED NULL,
      tax_account_id BIGINT UNSIGNED NULL,
      tax_type ENUM('Inclusive','Exclusive') NOT NULL DEFAULT 'Exclusive',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_tax_settings (company_id, branch_id),
      KEY idx_pos_tax_settings_company (company_id),
      KEY idx_pos_tax_settings_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_tax_settings", "is_active"))) {
    await query(
      "ALTER TABLE pos_tax_settings ADD COLUMN is_active TINYINT(1) NOT NULL DEFAULT 1",
    );
  }
  if (!(await hasColumn("pos_tax_settings", "component_mappings"))) {
    await query(
      "ALTER TABLE pos_tax_settings ADD COLUMN component_mappings JSON NULL",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_receipt_settings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      company_name VARCHAR(255) NULL,
      show_logo TINYINT(1) NOT NULL DEFAULT 0,
      header_text TEXT NULL,
      footer_text TEXT NULL,
      contact_number VARCHAR(50) NULL,
      address_line1 VARCHAR(255) NULL,
      address_line2 VARCHAR(255) NULL,
      logo_url VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_receipt_settings (company_id, branch_id),
      KEY idx_pos_receipt_settings_company (company_id),
      KEY idx_pos_receipt_settings_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pos_receipt_settings", "company_name"))) {
    await query(
      "ALTER TABLE pos_receipt_settings ADD COLUMN company_name VARCHAR(255) NULL AFTER branch_id",
    );
  }

  await query(`
    CREATE TABLE IF NOT EXISTS pos_return_reasons (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      reason VARCHAR(150) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_return_reason (company_id, branch_id, reason),
      KEY idx_pos_return_reason_company (company_id),
      KEY idx_pos_return_reason_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  const tablesToCheck = [
    "pos_payment_modes",
    "pos_tax_settings",
    "pos_receipt_settings",
    "pos_terminals",
    "pos_terminal_users",
    "pos_return_reasons",
    "pos_sale_lines",
    "pos_return_lines"
  ];

  for (const t of tablesToCheck) {
    if (!(await hasColumn(t, "created_by"))) {
      await query(`ALTER TABLE ${t} ADD COLUMN created_by BIGINT UNSIGNED NULL`);
    }
    if (!(await hasColumn(t, "created_at"))) {
      await query(`ALTER TABLE ${t} ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP`);
    }
  }
}

async function ensurePosSessionPostingTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS pos_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      session_no VARCHAR(20) NOT NULL,
      terminal_code VARCHAR(50) NOT NULL,
      cashier_name VARCHAR(150) NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NULL,
      opening_cash DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_sales DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
      actual_cash DECIMAL(18,2) NULL,
      variance_amount DECIMAL(18,2) NULL,
      finance_posted TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_pos_session (company_id, branch_id, session_no),
      KEY idx_pos_session_company (company_id),
      KEY idx_pos_session_branch (branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function nextReceiptNo(companyId) {
  const rows = await query(
    `
    SELECT receipt_no,
          created_at,
          u.username AS created_by_name
         FROM pos_sales
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND receipt_no REGEXP '^POS-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(receipt_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].receipt_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `POS-${String(nextNum).padStart(6, "0")}`;
}

async function nextSessionNo(companyId) {
  const rows = await query(
    `
    SELECT session_no,
          created_at,
          u.username AS created_by_name
         FROM pos_sessions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND session_no REGEXP '^S-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(session_no, 3) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].session_no || "");
    const numPart = prev.slice(2);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `S-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/customers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = req.scope.companyId;
      const items = await query(
        `SELECT 
           c.id,
           c.company_id,
           c.branch_id,
           c.customer_code,
           c.customer_name,
           c.customer_type,
           c.price_type_id,
           c.contact_person,
           c.email,
           c.phone,
           c.mobile,
           c.credit_limit,
           c.enforce_credit_limit,
           c.temp_credit_limit,
           c.temp_credit_limit_date,
           c.is_active,
           c.address,
           c.city,
           c.state,
           c.zone,
           c.country,
           c.payment_terms
         FROM sal_customers c
         WHERE c.company_id = :companyId AND c.is_active = 1
         ORDER BY c.customer_name ASC`,
        { companyId },
      ).catch(() => []);
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/analytics/overview",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const [todaySales] = await query(
        `SELECT 
           COALESCE(SUM(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)), 0) AS total, 
           COALESCE(AVG(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)), 0) AS avg_amt, 
           COUNT(*) AS count,
          created_at,
          u.username AS created_by_name
         FROM pos_sales
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId 
           AND (:branchIdsStr = '' OR FIND_IN_SET(pos_sales.branch_id, :branchIdsStr)) 
           AND DATE(sale_datetime) = CURDATE()
           AND status = 'COMPLETED'`,
        { companyId, branchId, branchIdsStr },
      );
      const [todayReturns] = await query(
        `SELECT 
           COALESCE(SUM(total_refund), 0) AS total
         FROM pos_returns
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND DATE(return_datetime) = CURDATE()`,
        { companyId, branchId, branchIdsStr },
      );
      const [monthSales] = await query(
        `SELECT 
           COALESCE(SUM(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)), 0) AS total,
           COALESCE(AVG(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)), 0) AS avg_amt,
           COUNT(*) AS count,
          created_at,
          u.username AS created_by_name
         FROM pos_sales
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId 
           AND (:branchIdsStr = '' OR FIND_IN_SET(pos_sales.branch_id, :branchIdsStr)) 
           AND YEAR(sale_datetime) = YEAR(CURDATE()) 
           AND MONTH(sale_datetime) = MONTH(CURDATE())
           AND status = 'COMPLETED'`,
        { companyId, branchId, branchIdsStr },
      );
      const [monthReturns] = await query(
        `SELECT 
           COALESCE(SUM(total_refund), 0) AS total
         FROM pos_returns
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND YEAR(return_datetime) = YEAR(CURDATE())
           AND MONTH(return_datetime) = MONTH(CURDATE())`,
        { companyId, branchId, branchIdsStr },
      );
      const [customers] = await query(
        `SELECT COUNT(*) AS count,
          created_at,
          u.username AS created_by_name
         FROM sal_customers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId`,
        { companyId },
      );
      const rawTodayTotal = Number(todaySales?.total || 0);
      const todayReturnTotal = Number(todayReturns?.total || 0);
      const rawMonthTotal = Number(monthSales?.total || 0);
      const monthReturnTotal = Number(monthReturns?.total || 0);
      const todayNet = roundTo2(rawTodayTotal - todayReturnTotal);
      const monthNet = roundTo2(rawMonthTotal - monthReturnTotal);
      const monthCount = Number(monthSales?.count || 0) || 0;
      const avgOrder = monthCount > 0 ? roundTo2(monthNet / monthCount) : 0;
      res.json({
        todaySales: todayNet,
        averageOrder: avgOrder,
        transactions: Number(todaySales?.count || 0),
        monthlyRevenue: monthNet,
        totalCustomers: Number(customers?.count || 0),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "DATE(sale_datetime) = CURDATE()";
      let returnDateCond = "DATE(return_datetime) = CURDATE()";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const rows = await query(
        `
         SELECT id, payment_method, (COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) AS total_amount, payments, gross_amount, discount_amount, tax_amount
          FROM pos_sales p
          WHERE p.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND ${salesDateCond}
           AND p.status = 'COMPLETED'
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT refund_method, COUNT(*) AS cnt, COALESCE(SUM(total_refund), 0) AS amt
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY refund_method
        `,
        params,
      );
      const returnsByMethod = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.refund_method || "").toUpperCase(),
          Number(r.amt || 0),
        ]),
      );
      const summary = {
        cashCount: 0,
        cashAmount: 0,
        cardCount: 0,
        cardAmount: 0,
        mobileCount: 0,
        mobileAmount: 0,
        creditCount: 0,
        creditAmount: 0,
      };
      for (const row of rows) {
        const method = String(row.payment_method || "").toUpperCase();
        if (method === "SPLIT") {
          let paymentsArr = null;
          if (row.payments) {
            if (typeof row.payments === "string") {
              try { paymentsArr = JSON.parse(row.payments); } catch { paymentsArr = null; }
            } else if (Buffer.isBuffer(row.payments)) {
              try { paymentsArr = JSON.parse(row.payments.toString("utf8")); } catch { paymentsArr = null; }
            } else if (typeof row.payments === "object" && row.payments.type === "Buffer" && Array.isArray(row.payments.data)) {
              try { paymentsArr = JSON.parse(Buffer.from(row.payments.data).toString("utf8")); } catch { paymentsArr = null; }
            } else if (Array.isArray(row.payments)) {
              paymentsArr = row.payments;
            }
          }
          let hasCash = false, hasCard = false, hasMobile = false, hasCredit = false;
          if (Array.isArray(paymentsArr)) {
            for (const pmt of paymentsArr) {
              const pmtMethod = String(pmt.method || "").toUpperCase();
              const pmtAmt = Number(pmt.amount || 0);
              if (pmtMethod === "CASH") {
                hasCash = true;
                summary.cashAmount += pmtAmt;
              } else if (pmtMethod === "CARD") {
                hasCard = true;
                summary.cardAmount += pmtAmt;
              } else if (pmtMethod === "MOBILE") {
                hasMobile = true;
                summary.mobileAmount += pmtAmt;
              } else if (pmtMethod === "CREDIT") {
                hasCredit = true;
                summary.creditAmount += pmtAmt;
              }
            }
          }
          if (hasCash) summary.cashCount += 1;
          if (hasCard) summary.cardCount += 1;
          if (hasMobile) summary.mobileCount += 1;
          if (hasCredit) summary.creditCount += 1;
        } else if (method === "CASH") {
          summary.cashCount += 1;
          summary.cashAmount += Number(row.total_amount || 0);
        } else if (method === "CARD") {
          summary.cardCount += 1;
          summary.cardAmount += Number(row.total_amount || 0);
        } else if (method === "MOBILE") {
          summary.mobileCount += 1;
          summary.mobileAmount += Number(row.total_amount || 0);
        } else if (method === "CREDIT") {
          summary.creditCount += 1;
          summary.creditAmount += Number(row.total_amount || 0);
        }
      }
      summary.cashAmount = roundTo2(
        summary.cashAmount - (returnsByMethod.get("CASH") || 0),
      );
      summary.cardAmount = roundTo2(
        summary.cardAmount - (returnsByMethod.get("CARD") || 0),
      );
      summary.mobileAmount = roundTo2(
        summary.mobileAmount - (returnsByMethod.get("MOBILE") || 0),
      );
      summary.creditAmount = roundTo2(
        summary.creditAmount - (returnsByMethod.get("CREDIT") || 0),
      );
      res.json({ summary });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-user-sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "DATE(p.sale_datetime) = CURDATE()";
      let returnDateCond = "DATE(r.return_datetime) = CURDATE()";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(r.return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const items = await query(
        `
          SELECT 
           COALESCE(
             NULLIF(a.username, ''),
             NULLIF(a.email, ''),
             CONCAT('User ', a.id)
           ) AS user_label,
           COUNT(*) AS count,
           COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
           p.created_at,
           u.username AS created_by_name
          FROM pos_sales p
         LEFT JOIN adm_users a
           ON a.id = p.created_by AND a.company_id = p.company_id AND a.branch_id = p.branch_id
         LEFT JOIN adm_users u ON u.id = p.created_by
          WHERE p.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
           AND ${salesDateCond}
           AND p.status = 'COMPLETED'
         GROUP BY user_label
         ORDER BY total DESC
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT 
          COALESCE(
            NULLIF(a.username, ''),
            NULLIF(a.email, ''),
            CONCAT('User ', a.id)
          ) AS user_label,
          COALESCE(SUM(r.total_refund), 0) AS return_total
         FROM pos_returns r
         JOIN pos_sales p
           ON p.id = r.sale_id
          AND p.company_id = r.company_id
          AND p.branch_id = r.branch_id
        LEFT JOIN adm_users a
          ON a.id = p.created_by AND a.company_id = p.company_id AND a.branch_id = p.branch_id
         WHERE r.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY user_label
        `,
        params,
      );
      const returnsByUser = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.user_label || ""),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const label = String(it.user_label || "");
        const ret = returnsByUser.get(label) || 0;
        return {
          ...it,
          total: roundTo2(Number(it.total || 0) - ret),
        };
      });
      adjusted.sort((a, b) => Number(b.total || 0) - Number(a.total || 0));
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/day-terminal-methods",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "DATE(p.sale_datetime) = CURDATE()";
      let returnDateCond = "DATE(r.return_datetime) = CURDATE()";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(r.return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const items = await query(
        `
          SELECT 
           COALESCE(t.code, 'UNKNOWN') AS terminal,
           SUM(CASE WHEN COALESCE(p.payment_method, '')='CASH' THEN COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0) ELSE 0 END) AS cash_total,
           SUM(CASE WHEN COALESCE(p.payment_method, '')='CARD' THEN COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0) ELSE 0 END) AS card_total,
           SUM(CASE WHEN COALESCE(p.payment_method, '')='MOBILE' THEN COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0) ELSE 0 END) AS mobile_total,
           SUM(CASE WHEN COALESCE(p.payment_method, '')='CREDIT' THEN COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0) ELSE 0 END) AS credit_total,
          p.created_at,
          u.username AS created_by_name
         FROM pos_sales p
        LEFT JOIN pos_terminals t
          ON t.id = p.terminal_id AND t.company_id = p.company_id AND t.branch_id = p.branch_id
         LEFT JOIN adm_users u ON u.id = p.created_by
          WHERE p.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
           AND ${salesDateCond}
           AND p.status = 'COMPLETED'
         GROUP BY COALESCE(t.code, 'UNKNOWN')
         ORDER BY terminal ASC
        `,
        params,
      );
      const returnRows = await query(
        `
          SELECT 
          COALESCE(t.code, 'UNKNOWN') AS terminal,
          SUM(CASE WHEN r.refund_method='CASH' THEN r.total_refund ELSE 0 END) AS cash_return,
          SUM(CASE WHEN r.refund_method='CARD' THEN r.total_refund ELSE 0 END) AS card_return,
          SUM(CASE WHEN r.refund_method='MOBILE' THEN r.total_refund ELSE 0 END) AS mobile_return,
          SUM(CASE WHEN r.refund_method='CREDIT' THEN r.total_refund ELSE 0 END) AS credit_return
         FROM pos_returns r
         JOIN pos_sales p
           ON p.id = r.sale_id
          AND p.company_id = r.company_id
          AND p.branch_id = r.branch_id
         LEFT JOIN pos_terminals t
           ON t.id = p.terminal_id AND t.company_id = p.company_id AND t.branch_id = p.branch_id
         WHERE r.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY COALESCE(t.code, 'UNKNOWN')
        `,
        params,
      );
      const returnsByTerminal = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.terminal || "UNKNOWN"),
          {
            cash: Number(r.cash_return || 0),
            card: Number(r.card_return || 0),
            mobile: Number(r.mobile_return || 0),
            credit: Number(r.credit_return || 0),
          },
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const key = String(it.terminal || "UNKNOWN");
        const ret = returnsByTerminal.get(key) || {
          cash: 0,
          card: 0,
          mobile: 0,
          credit: 0,
        };
        return {
          ...it,
          cash_total: roundTo2(Number(it.cash_total || 0) - ret.cash),
          card_total: roundTo2(Number(it.card_total || 0) - ret.card),
          mobile_total: roundTo2(Number(it.mobile_total || 0) - ret.mobile),
          credit_total: roundTo2(Number(it.credit_total || 0) - ret.credit),
        };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/analytics/sales-30-days",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const rawDays = Number(req.query.days || 30);
      const days = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(365, Math.floor(rawDays)) : 30;
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond, returnDateCond;
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(return_datetime) BETWEEN :startDate AND :endDate";
      } else {
        params.days = days;
        salesDateCond = "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL :days DAY)";
        returnDateCond = "DATE(return_datetime) >= DATE_SUB(CURDATE(), INTERVAL :days DAY)";
      }
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DATE(p.sale_datetime) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
         FROM pos_sales p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE p.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
          AND ${salesDateCond}
          AND p.status = 'COMPLETED'
        GROUP BY DATE(p.sale_datetime)
        ORDER BY date ASC
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT 
          DATE(return_datetime) AS date,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY DATE(return_datetime)
        `,
        params,
      );
      const returnsByDate = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.date || "").slice(0, 10),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const d = String(it.date || "").slice(0, 10);
        const ret = returnsByDate.get(d) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const date = String(req.query.date || "").trim();
      const terminalId = toNumber(req.query.terminal_id);
      const terminalCode = String(req.query.terminal || "").trim();
      const warehouseName = String(req.query.warehouse || "").trim();
      let sql = `
        SELECT 
          p.id,
          p.receipt_no,
          p.sale_datetime,
          DATE(p.sale_datetime) AS sale_date,
          p.customer_name,
          p.payment_method,
          p.payments,
          p.gross_amount,
          p.discount_amount,
          p.tax_amount,
          p.net_amount AS total_amount,
          (SELECT COALESCE(SUM(r.total_refund), 0) 
             FROM pos_returns r 
            WHERE r.sale_id = p.id 
              AND r.company_id = p.company_id 
              AND r.branch_id = p.branch_id) AS return_total,
          (p.net_amount - (SELECT COALESCE(SUM(r.total_refund), 0) 
             FROM pos_returns r 
            WHERE r.sale_id = p.id 
              AND r.company_id = p.company_id 
              AND r.branch_id = p.branch_id)) AS net_after_returns,
          (SELECT COUNT(*) FROM pos_sale_lines l WHERE l.sale_id = p.id) AS items_count,
          (SELECT COALESCE(SUM(l.returned_qty), 0) > 0 FROM pos_sale_lines l WHERE l.sale_id = p.id) AS has_returns,
          CASE WHEN p.payment_status IS NOT NULL THEN p.payment_status WHEN p.status = 'COMPLETED' THEN 'PAID' ELSE 'UNPAID' END AS payment_status,
          COALESCE(t.code, '') AS terminal_code,
          COALESCE(t.warehouse, '') AS warehouse
        FROM pos_sales p
        LEFT JOIN pos_terminals t
          ON t.id = p.terminal_id 
         AND t.company_id = p.company_id 
         AND t.branch_id = p.branch_id
        WHERE p.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
          AND p.status = 'COMPLETED'
      `;
      const params = { companyId, branchId, branchIdsStr };
      if (date) {
        sql += ` AND DATE(p.sale_datetime) = :date`;
        params.date = date;
      }
      if (terminalId) {
        sql += ` AND p.terminal_id = :terminalId`;
        params.terminalId = terminalId;
      } else if (terminalCode) {
        sql += ` AND t.code = :terminalCode`;
        params.terminalCode = terminalCode;
      }
      if (warehouseName) {
        sql += ` AND COALESCE(t.warehouse,'') = :warehouseName`;
        params.warehouseName = warehouseName;
      }
      sql += ` ORDER BY p.sale_datetime DESC, p.id DESC`;
      const rows = await query(sql, params);
      const items = rows.map((row) => {
        if (row.payments) {
          if (typeof row.payments === "string") {
            try { row.payments = JSON.parse(row.payments); } catch { row.payments = []; }
          } else if (Buffer.isBuffer(row.payments)) {
            try { row.payments = JSON.parse(row.payments.toString("utf8")); } catch { row.payments = []; }
          } else if (row.payments && typeof row.payments === "object" && row.payments.type === "Buffer" && Array.isArray(row.payments.data)) {
            try { row.payments = JSON.parse(Buffer.from(row.payments.data).toString("utf8")); } catch { row.payments = []; }
          }
        }
        return row;
      });
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/next-voucher-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const [seqRows] = await query(
        `
        SELECT prefix, next_number,
          created_at,
          u.username AS created_by_name
    FROM sal_invoice_sequences
    LEFT JOIN adm_users u ON u.id = created_by
     WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(sal_invoice_sequences.branch_id, :branchIdsStr))
    LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      let nextNumber = 0;
      if (seqRows?.length) {
        nextNumber = Number(seqRows[0].next_number || 0) || 0;
      } else {
        const [maxRows] = await query(
          `
          SELECT invoice_no,
          created_at,
          u.username AS created_by_name
    FROM sal_invoices
    LEFT JOIN adm_users u ON u.id = created_by
     WHERE company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(sal_invoices.branch_id, :branchIdsStr))
        AND invoice_no REGEXP '^INV-?[0-9]{6}$'
          ORDER BY CAST(REPLACE(invoice_no, 'INV-', '') AS UNSIGNED) DESC
          LIMIT 1
          `,
          { companyId, branchId, branchIdsStr },
        );
        if (maxRows?.length) {
          const prev = String(maxRows[0].invoice_no || "");
          const numPart = prev.replace(/^INV-?/, "");
          const n = parseInt(numPart, 10);
          nextNumber = Number.isFinite(n) ? n + 1 : 1;
        } else {
          nextNumber = 1;
        }
      }
      const padded = String(nextNumber).padStart(6, "0");
      const voucherNo = `POS-${padded}`;
      res.json({ voucher_no: voucherNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/sales-monthly",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "p.sale_datetime >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
      let returnDateCond = "return_datetime >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DATE_FORMAT(p.sale_datetime, '%Y-%m') AS ym,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
      FROM pos_sales p
     LEFT JOIN adm_users u ON u.id = p.created_by
      WHERE p.company_id = :companyId
       AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
       AND p.status = 'COMPLETED'
       AND ${salesDateCond}
     GROUP BY DATE_FORMAT(p.sale_datetime, '%Y-%m')
     ORDER BY ym ASC
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT 
          DATE_FORMAT(return_datetime, '%Y-%m') AS ym,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY DATE_FORMAT(return_datetime, '%Y-%m')
        `,
        params,
      );
      const returnsByYm = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.ym || ""),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const ym = String(it.ym || "");
        const ret = returnsByYm.get(ym) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/weekday-current-week",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "YEARWEEK(p.sale_datetime, 1) = YEARWEEK(CURDATE(), 1)";
      let returnDateCond = "YEARWEEK(return_datetime, 1) = YEARWEEK(CURDATE(), 1)";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          DAYOFWEEK(p.sale_datetime) AS dow, 
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
      FROM pos_sales p
     LEFT JOIN adm_users u ON u.id = p.created_by
      WHERE p.company_id = :companyId
       AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
       AND ${salesDateCond}
       AND p.status = 'COMPLETED'
     GROUP BY DAYOFWEEK(p.sale_datetime)
     ORDER BY dow ASC
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT
          DAYOFWEEK(return_datetime) AS dow,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND ${returnDateCond}
        GROUP BY DAYOFWEEK(return_datetime)
        `,
        params,
      );
      const returnsByDow = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          Number(r.dow || 0),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const dow = Number(it.dow || 0);
        const ret = returnsByDow.get(dow) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/hourly-today",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let salesDateCond = "DATE(p.sale_datetime) = CURDATE()";
      let returnDateCond = "DATE(return_datetime) = CURDATE()";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        salesDateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
        returnDateCond = "DATE(return_datetime) BETWEEN :startDate AND :endDate";
      }
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          HOUR(p.sale_datetime) AS hr,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
      FROM pos_sales p
     LEFT JOIN adm_users u ON u.id = p.created_by
      WHERE p.company_id = :companyId
       AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
       AND ${salesDateCond}
       AND p.status = 'COMPLETED'
       AND HOUR(p.sale_datetime) BETWEEN 7 AND 22
     GROUP BY HOUR(p.sale_datetime)
     ORDER BY hr ASC
        `,
        params,
      );
      const returnRows = await query(
        `
        SELECT
          HOUR(return_datetime) AS hr,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND ${returnDateCond}
          AND HOUR(return_datetime) BETWEEN 7 AND 22
        GROUP BY HOUR(return_datetime)
        `,
        params,
      );
      const returnsByHour = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          Number(r.hr || 0),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const hr = Number(it.hr || 0);
        const ret = returnsByHour.get(hr) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/busy-hours",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const items = await query(
        `
        SELECT 
          HOUR(p.sale_datetime) AS hr,
          COALESCE(AVG(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total
         FROM pos_sales p
         WHERE p.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
          AND p.status = 'COMPLETED'
          AND HOUR(p.sale_datetime) BETWEEN 7 AND 22
        GROUP BY HOUR(p.sale_datetime)
        ORDER BY hr ASC
        `,
        { companyId, branchId, branchIdsStr },
      );
      const returnRows = await query(
        `
        SELECT
          HOUR(return_datetime) AS hr,
          COALESCE(AVG(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND HOUR(return_datetime) BETWEEN 7 AND 22
        GROUP BY HOUR(return_datetime)
        `,
        { companyId, branchId, branchIdsStr },
      );
      const returnsByHour = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          Number(r.hr || 0),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const hr = Number(it.hr || 0);
        const ret = returnsByHour.get(hr) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/analytics/category-share",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let dateCond = "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        dateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
      }
      const items = await query(
        `
        SELECT 
          c.category_name AS category,
          COALESCE(SUM(l.line_total - (COALESCE(l.returned_qty, 0) * l.unit_price)), 0) AS total
         FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        JOIN inv_items i ON i.id = l.item_id AND i.company_id = p.company_id
         JOIN inv_item_categories c ON c.id = i.category_id AND c.company_id = p.company_id
         WHERE p.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
          AND p.status = 'COMPLETED'
          AND ${dateCond}
        GROUP BY c.category_name
        ORDER BY total DESC
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/analytics/profit-by-group",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let dateCond = "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        dateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
      }
      const items = await query(
        `
        SELECT
          c.category_name AS item_group,
          COALESCE(SUM(l.unit_price * l.qty), 0) AS revenue,
          COALESCE(SUM(i.cost_price * l.qty), 0) AS total_cost,
          COALESCE(SUM(l.unit_price * l.qty - i.cost_price * l.qty), 0) AS profit
         FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        JOIN inv_items i ON i.id = l.item_id AND i.company_id = p.company_id
         JOIN inv_item_categories c ON c.id = i.category_id AND c.company_id = p.company_id
         WHERE p.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
           AND p.status = 'COMPLETED'
           AND ${dateCond}
        GROUP BY c.category_name
        ORDER BY profit DESC
        `,
        params,
      );
      const result = (Array.isArray(items) ? items : []).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        total_cost: Number(r.total_cost || 0),
        profit: Number(r.profit || 0),
        margin_pct: Number(r.revenue) > 0 ? (Number(r.profit) / Number(r.revenue)) * 100 : 0,
      }));
      res.json({ items: result });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/analytics/profit-by-item",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const params = { companyId, branchId, branchIdsStr };
      let dateCond = "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)";
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        dateCond = "DATE(p.sale_datetime) BETWEEN :startDate AND :endDate";
      }
      const items = await query(
        `
        SELECT
          COALESCE(l.item_name, i.item_name, 'Unknown') AS item,
          COALESCE(SUM(l.unit_price * l.qty), 0) AS revenue,
          COALESCE(SUM(i.cost_price * l.qty), 0) AS total_cost,
          COALESCE(SUM(l.unit_price * l.qty - i.cost_price * l.qty), 0) AS profit
         FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
         JOIN inv_items i ON i.id = l.item_id AND i.company_id = p.company_id
         WHERE p.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
           AND p.status = 'COMPLETED'
           AND ${dateCond}
        GROUP BY COALESCE(l.item_name, i.item_name, 'Unknown')
        ORDER BY profit DESC
        `,
        params,
      );
      const result = (Array.isArray(items) ? items : []).map((r) => ({
        ...r,
        revenue: Number(r.revenue || 0),
        total_cost: Number(r.total_cost || 0),
        profit: Number(r.profit || 0),
        margin_pct: Number(r.revenue) > 0 ? (Number(r.profit) / Number(r.revenue)) * 100 : 0,
      }));
      res.json({ items: result });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/daily-sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push(
          "DATE(p.sale_datetime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        );
      }
      const items = await query(
        `
        SELECT 
          DATE(p.sale_datetime) AS date,
          COUNT(*) AS count,
          COALESCE(SUM(p.gross_amount), 0) AS gross,
          COALESCE(SUM(p.discount_amount), 0) AS discount,
          COALESCE(SUM(p.tax_amount), 0) AS tax,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS net,
          p.created_at,
          u.username AS created_by_name
         FROM pos_sales p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE ${where.join(" AND ")}
        GROUP BY DATE(p.sale_datetime)
        ORDER BY date ASC
        `,
        params,
      );
      const retWhere = ["company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))"];
      const retParams = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        retParams.startDate = startDate;
        retParams.endDate = endDate;
        retWhere.push(
          "DATE(return_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        retWhere.push(
          "DATE(return_datetime) >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)",
        );
      }
      const returnRows = await query(
        `
        SELECT
          DATE(return_datetime) AS date,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE ${retWhere.join(" AND ")}
        GROUP BY DATE(return_datetime)
        `,
        retParams,
      );
      const returnsByDate = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.date || "").slice(0, 10),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const d = String(it.date || "").slice(0, 10);
        const rawNet = Number(it.net || 0);
        const rawTax = Number(it.tax || 0);
        const ret = returnsByDate.get(d) || 0;
        const net = roundTo2(rawNet - ret);
        const taxRatio = rawNet > 0 ? rawTax / rawNet : 0;
        const tax = roundTo2(rawTax - ret * taxRatio);
        return {
          ...it,
          tax,
          net,
          return_total: roundTo2(ret),
          net_after_returns: net,
        };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/payment-breakdown",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        params.today = new Date();
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(p.payment_method, 'UNKNOWN') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
         FROM pos_sales p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(p.payment_method, 'UNKNOWN')
        ORDER BY total DESC
        `,
        params,
      );
      const retWhere = ["company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))"];
      const retParams = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        retParams.startDate = startDate;
        retParams.endDate = endDate;
        retWhere.push(
          "DATE(return_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        retWhere.push("DATE(return_datetime) = CURDATE()");
      }
      const returnRows = await query(
        `
        SELECT
          COALESCE(refund_method, 'UNKNOWN') AS method,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE ${retWhere.join(" AND ")}

        GROUP BY COALESCE(refund_method, 'UNKNOWN')
        `,
        retParams,
      );
      const returnsByMethod = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.method || "UNKNOWN").toUpperCase(),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const m = String(it.method || "UNKNOWN").toUpperCase();
        const ret = returnsByMethod.get(m) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/report/payment-breakdown",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(p.payment_method, 'UNKNOWN') AS method,
          COUNT(*) AS count,
          COALESCE(SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)), 0) AS total,
          p.created_at,
          u.username AS created_by_name
         FROM pos_sales p
        LEFT JOIN adm_users u ON u.id = p.created_by
         WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(p.payment_method, 'UNKNOWN')
        ORDER BY total DESC
        `,
        params,
      );
      const retWhere = ["company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))"];
      const retParams = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        retParams.startDate = startDate;
        retParams.endDate = endDate;
        retWhere.push(
          "DATE(return_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        retWhere.push("DATE(return_datetime) = CURDATE()");
      }
      const returnRows = await query(
        `
        SELECT
          COALESCE(refund_method, 'UNKNOWN') AS method,
          COALESCE(SUM(total_refund), 0) AS return_total
         FROM pos_returns
         WHERE ${retWhere.join(" AND ")}
        GROUP BY COALESCE(refund_method, 'UNKNOWN')
        `,
        retParams,
      );
      const returnsByMethod = new Map(
        (Array.isArray(returnRows) ? returnRows : []).map((r) => [
          String(r.method || "UNKNOWN").toUpperCase(),
          Number(r.return_total || 0),
        ]),
      );
      const adjusted = (Array.isArray(items) ? items : []).map((it) => {
        const m = String(it.method || "UNKNOWN").toUpperCase();
        const ret = returnsByMethod.get(m) || 0;
        return { ...it, total: roundTo2(Number(it.total || 0) - ret) };
      });
      res.json({ items: adjusted });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/reports/top-items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const rawLimit = Number(req.query.limit || 10);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 10;
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, branchIdsStr, limit };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(l.item_name, 'Unknown') AS item,
          COALESCE(SUM(l.qty - COALESCE(l.returned_qty, 0)), 0) AS qty,
          COALESCE(SUM(l.line_total - (COALESCE(l.returned_qty, 0) * l.unit_price)), 0) AS amount,
          l.created_at,
          u.username AS created_by_name
         FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        LEFT JOIN adm_users u ON u.id = l.created_by
         WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(l.item_name, 'Unknown')
        ORDER BY amount DESC
        LIMIT ${limit}
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/reports/returns-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      await ensurePosTables();
      const where = [
        "r.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))",
      ];
      const params = { companyId, branchId, branchIdsStr };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push("DATE(r.return_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)");
      }
      const byDay = await query(`
        SELECT DATE(r.return_datetime) AS day, COUNT(*) AS count, COALESCE(SUM(r.total_refund), 0) AS total
        FROM pos_returns r
        WHERE ${where.join(" AND ")}
        GROUP BY DATE(r.return_datetime)
        ORDER BY day ASC
      `, params);
      const byMethod = await query(`
        SELECT r.refund_method AS method, COUNT(*) AS count, COALESCE(SUM(r.total_refund), 0) AS total
        FROM pos_returns r
        WHERE ${where.join(" AND ")}
        GROUP BY r.refund_method
      `, params);
      res.json({ byDay, byMethod });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/report/top-items",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const rawLimit = Number(req.query.limit || 10);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(100, Math.floor(rawLimit))
          : 10;
      await ensurePosTables();
      const where = [
        "p.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))",
        "p.status = 'COMPLETED'",
      ];
      const params = { companyId, branchId, branchIdsStr, limit };
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push(
          "DATE(p.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)",
        );
      } else {
        where.push("DATE(p.sale_datetime) = CURDATE()");
      }
      const items = await query(
        `
        SELECT 
          COALESCE(l.item_name, 'Unknown') AS item,
          COALESCE(SUM(l.qty - COALESCE(l.returned_qty, 0)), 0) AS qty,
          COALESCE(SUM(l.line_total - (COALESCE(l.returned_qty, 0) * l.unit_price)), 0) AS amount,
          l.created_at,
          u.username AS created_by_name
         FROM pos_sale_lines l
        JOIN pos_sales p ON p.id = l.sale_id
        LEFT JOIN adm_users u ON u.id = l.created_by
         WHERE ${where.join(" AND ")}
        GROUP BY COALESCE(l.item_name, 'Unknown')
        ORDER BY amount DESC
        LIMIT ${limit}
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);
router.get(
  "/sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const date = String(req.query.date || "").trim();
      const startDate = String(req.query.startDate || req.query.from || "").trim();
      const endDate = String(req.query.endDate || req.query.to || "").trim();
      const receiptNo = String(
        req.query.receipt_no || req.query.receiptNo || "",
      )
        .trim()
        .toUpperCase();
      const terminalCode = String(
        req.query.terminal || req.query.till || "",
      ).trim();
      const terminalId = Number(
        req.query.terminal_id || req.query.terminalId || 0,
      );
      const warehouse = String(req.query.warehouse || "").trim();
      const rawLimit = Number(req.query.limit || 0);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0
          ? Math.min(5000, Math.floor(rawLimit))
          : 1000;
      await ensurePosTables();
      const params = { companyId, branchId, branchIdsStr };
      const where = [
        "ps.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(ps.branch_id, :branchIdsStr))",
        "ps.status IN ('COMPLETED', 'PAID')",
      ];
      if (date) {
        params.date = date;
        where.push("DATE(ps.sale_datetime) = DATE(:date)");
      } else if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
        where.push("DATE(ps.sale_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)");
      }
      if (receiptNo) {
        params.receiptNo = receiptNo;
        where.push("UPPER(ps.receipt_no) = :receiptNo");
      }
      if (Number.isFinite(terminalId) && terminalId > 0) {
        params.terminalId = terminalId;
        where.push("ps.terminal_id = :terminalId");
      } else if (terminalCode) {
        params.terminalCode = terminalCode.toUpperCase();
        where.push("UPPER(pt.code) = :terminalCode");
      }
      if (warehouse) {
        params.warehouse = warehouse;
        where.push("pt.warehouse = :warehouse");
      }
      const items = await query(
        `SELECT 
           ps.id,
           ps.receipt_no AS sale_no,
           ps.sale_datetime AS sale_date,
           ps.customer_name,
           ps.gross_amount,
           ps.discount_amount,
           ps.tax_amount,
           ps.net_amount,
           ps.net_amount AS total_amount,
           COALESCE(ps.payment_status,
             CASE ps.status 
               WHEN 'COMPLETED' THEN 'PAID' 
               WHEN 'DRAFT' THEN 'PENDING' 
               ELSE ps.status 
             END
           ) AS payment_status,
           ps.payment_method,
           ps.payments,
           ps.terminal_id,
           COALESCE(pt.code, '') AS terminal_code,
           COALESCE(pt.warehouse, '') AS warehouse,
           (SELECT COALESCE(SUM(l.returned_qty), 0) > 0 FROM pos_sale_lines l WHERE l.sale_id = ps.id) AS has_returns,
           ps.created_at,
           u.username AS created_by_name
         FROM pos_sales ps
         LEFT JOIN pos_terminals pt ON pt.id = ps.terminal_id AND pt.company_id = ps.company_id
         LEFT JOIN adm_users u ON u.id = ps.created_by
         WHERE ${where.join(" AND ")}
         ORDER BY ps.sale_datetime DESC
         LIMIT ${limit}`,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/sales/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensurePosTables();
      const items = await query(
        `SELECT 
           id,
           receipt_no AS sale_no,
           sale_datetime AS sale_date,
           customer_name,
           payment_method,
           payments,
           gross_amount,
           discount_amount,
           tax_amount,
           tax_components,
           net_amount,
            (SELECT COALESCE(SUM(r.total_refund), 0)
               FROM pos_returns r
              WHERE r.sale_id = pos_sales.id
                AND r.company_id = pos_sales.company_id
                AND r.branch_id = pos_sales.branch_id) AS return_total,
           (net_amount - (SELECT COALESCE(SUM(r.total_refund), 0)
              FROM pos_returns r
             WHERE r.sale_id = pos_sales.id
               AND r.company_id = pos_sales.company_id
               AND r.branch_id = pos_sales.branch_id)) AS net_after_returns,
           CASE status 
             WHEN 'COMPLETED' THEN 'PAID' 
             WHEN 'DRAFT' THEN 'PENDING' 
             ELSE status 
           END AS payment_status,
          created_at,
          u.username AS created_by_name
         FROM pos_sales
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_sales.branch_id, :branchIdsStr)) 
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!items.length) throw httpError(404, "NOT_FOUND", "Sale not found");
      const saleItem = items[0];
      // Parse payments JSON column
      if (saleItem.payments) {
        if (typeof saleItem.payments === "string") {
          try { saleItem.payments = JSON.parse(saleItem.payments); } catch { saleItem.payments = []; }
        } else if (Buffer.isBuffer(saleItem.payments)) {
          try { saleItem.payments = JSON.parse(saleItem.payments.toString("utf8")); } catch { saleItem.payments = []; }
        } else if (saleItem.payments && typeof saleItem.payments === "object" && saleItem.payments.type === "Buffer" && Array.isArray(saleItem.payments.data)) {
          try { saleItem.payments = JSON.parse(Buffer.from(saleItem.payments.data).toString("utf8")); } catch { saleItem.payments = []; }
        }
      }
      const details = await query(
        `SELECT id AS sale_line_id, item_id, item_name, qty, returned_qty, unit_price, line_total,
          created_at,
          u.username AS created_by_name
         FROM pos_sale_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE sale_id = :id 
         ORDER BY line_no ASC`,
        { id },
      );
      res.json({ item: saleItem, details });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const date = String(req.query.date || "").trim();
      const startDate = String(req.query.startDate || "").trim();
      const endDate = String(req.query.endDate || "").trim();
      const terminalId = toNumber(
        req.query.terminal_id || req.query.terminalId,
      );
      const terminalCode = String(req.query.terminal || "").trim();
      const warehouseName = String(req.query.warehouse || "").trim();

      let sql = `
        SELECT
          r.id,
          r.receipt_no,
          r.return_datetime,
          r.refund_method,
          r.total_refund,
          r.notes,
          r.sale_id,
          ps.receipt_no AS sale_receipt_no,
          ps.sale_datetime AS sale_datetime,
          COALESCE(t.code, '') AS terminal_code,
          COALESCE(t.warehouse, '') AS warehouse,
          (SELECT COUNT(*) FROM pos_return_lines rl WHERE rl.return_id = r.id) AS items_count,
          r.created_at,
          u.username AS created_by_name
        FROM pos_returns r
        JOIN pos_sales ps
          ON ps.id = r.sale_id
         AND ps.company_id = r.company_id
         AND ps.branch_id = r.branch_id
        LEFT JOIN pos_terminals t
          ON t.id = ps.terminal_id
         AND t.company_id = ps.company_id
         AND t.branch_id = ps.branch_id
        LEFT JOIN adm_users u
          ON u.id = r.created_by
        WHERE r.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
      `;
      const params = { companyId, branchId, branchIdsStr };
      if (date) {
        sql += " AND DATE(r.return_datetime) = DATE(:date)";
        params.date = date;
      } else if (startDate && endDate) {
        sql +=
          " AND DATE(r.return_datetime) BETWEEN DATE(:startDate) AND DATE(:endDate)";
        params.startDate = startDate;
        params.endDate = endDate;
      }

      if (terminalId) {
        sql += " AND ps.terminal_id = :terminalId";
        params.terminalId = terminalId;
      } else if (terminalCode) {
        sql += " AND UPPER(t.code) = :terminalCode";
        params.terminalCode = terminalCode.toUpperCase();
      }
      if (warehouseName) {
        sql += " AND COALESCE(t.warehouse,'') = :warehouseName";
        params.warehouseName = warehouseName;
      }

      sql += " ORDER BY r.return_datetime DESC, r.id DESC";

      const items = await query(sql, params);
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const userId = req.user?.id;
      const {
        saleId,
        receiptNo,
        returnItems,
        refundMethod,
        notes,
        totalRefund,
      } = req.body;

      const refundMethodEnum = ["CASH", "CARD", "MOBILE"].includes(
        String(refundMethod || "").toUpperCase(),
      )
        ? String(refundMethod).toUpperCase()
        : "CASH";

      if (!saleId)
        throw httpError(400, "VALIDATION_ERROR", "saleId is required");
      if (!returnItems?.length)
        throw httpError(400, "VALIDATION_ERROR", "returnItems is required");

      // Get original sale to find terminal for warehouse
      const [saleRow] = await query(
        `SELECT id, terminal_id, receipt_no, sale_datetime
          FROM pos_sales WHERE id = :saleId AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'COMPLETED'`,
        { saleId, companyId, branchId, branchIdsStr },
      );
      if (!saleRow) throw httpError(404, "NOT_FOUND", "Sale not found");

      // Get warehouse from terminal
      let warehouseId = null;
      if (saleRow.terminal_id) {
        const [termRow] = await query(
          "SELECT warehouse_id FROM pos_terminals WHERE id = :id",
          { id: saleRow.terminal_id },
        );
        warehouseId = termRow?.warehouse_id || null;
      }
      const hasStockItems =
        Array.isArray(returnItems) &&
        returnItems.some((x) => Number(x?.itemId || 0) > 0);
      if (hasStockItems && !warehouseId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Terminal warehouse is required to adjust stock for POS returns.",
        );
      }

      await conn.beginTransaction();

      // Insert return header
      const returnResult = await conn.execute(
        `INSERT INTO pos_returns
          (company_id, branch_id, sale_id, receipt_no, return_datetime,
           refund_method, total_refund, notes, created_by)
         VALUES
          (:companyId, :branchId, :saleId, :receiptNo, NOW(),
           :refundMethodEnum, :totalRefund, :notes, :userId)`,
        {
          companyId,
          branchId, branchIdsStr,
          saleId,
          receiptNo,
          refundMethodEnum,
          totalRefund,
          notes,
          userId,
        },
      );
      const returnId = returnResult[0].insertId;

      for (const item of returnItems) {
        const {
          saleLineId,
          itemId,
          itemName,
          returnQuantity,
          unitPrice,
          reason,
        } = item;
        if (!saleLineId || !returnQuantity || returnQuantity <= 0) continue;

        const [lineRow] = await conn.execute(
          `SELECT id, sale_id, qty, returned_qty, item_id
           FROM pos_sale_lines
           WHERE id = :saleLineId AND sale_id = :saleId
           LIMIT 1`,
          { saleLineId, saleId },
        );
        const line = Array.isArray(lineRow) ? lineRow[0] : null;
        if (!line) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            `Invalid saleLineId ${saleLineId} for sale ${saleId}`,
          );
        }
        const soldQty = Number(line.qty || 0);
        const alreadyReturned = Number(line.returned_qty || 0);
        const remaining = soldQty - alreadyReturned;
        if (Number(returnQuantity) > remaining + 1e-6) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            `Return quantity exceeds remaining qty for sale line ${saleLineId}`,
          );
        }

        const effectiveItemId = Number(line.item_id || itemId || 0) || null;
        const lineTotal =
          Math.round(Number(unitPrice || 0) * Number(returnQuantity) * 100) /
          100;

        // Insert return line
        await conn.execute(
          `INSERT INTO pos_return_lines
            (return_id, sale_line_id, item_id, item_name, qty, unit_price, line_total, reason)
           VALUES
            (:returnId, :saleLineId, :itemId, :itemName, :returnQuantity, :unitPrice, :lineTotal, :reason)`,
          {
            returnId,
            saleLineId,
            itemId: effectiveItemId,
            itemName,
            returnQuantity,
            unitPrice,
            lineTotal,
            reason,
          },
        );

        // Update returned_qty on the sale line
        await conn.execute(
          `UPDATE pos_sale_lines SET returned_qty = returned_qty + :returnQuantity WHERE id = :saleLineId`,
          { returnQuantity, saleLineId },
        );

        // Restore stock if item_id is known and we have a warehouse
        if (effectiveItemId && warehouseId) {
          await recordMovementTx(conn, {
            companyId,
            branchId, branchIdsStr,
            warehouseId,
            itemId: effectiveItemId,
            transactionType: "POS_RETURN",
            qtyChange: Number(returnQuantity),
            sourceRef: receiptNo,
            createdBy: userId,
            sourceType: "pos_return",
            sourceId: returnId,
          });
        }
      }

      await conn.commit();
      res.json({ success: true, returnId });
    } catch (err) {
      await conn.rollback().catch(() => {});
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/sales",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchIdsStr = '' } = req.scope || {};
      const branchId = req.scope?.branchId || null;
      const {
        payment_method,
        payment_mode_id,
        payments: reqPayments,
        customer_id,
        customer_name,
        payment_status,
        lines,
        status,
        tax_rate_percent,
        tax_type,
        tax_components,
        terminal,
      } = req.body || {};
      await ensurePosTables();
      await ensureStockBalancesWarehouseInfrastructure();
      // Enforce daily POS day requirement:
      // - A day must be opened for today's business date before sales are allowed
      // - Sales remain allowed even if the day has been closed, as long as it's the same date
      {
        const [dayRows] = await conn.execute(
          `
          SELECT id, status
          FROM pos_day_status
          WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            AND business_date = CURDATE()
            ${terminal ? "AND terminal_code = :terminal" : ""}
          ORDER BY open_datetime DESC
          LIMIT 1
          `,
          terminal
            ? { companyId, branchId, branchIdsStr, terminal: String(terminal || "") }
            : { companyId, branchId, branchIdsStr },
        );
        if (!dayRows || dayRows.length === 0) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Open POS day required for today. Please open day in POS Setup.",
          );
        }
        // If found and status is OPEN or CLOSED, proceed (CLOSED still allowed same day)
      }
      await conn.beginTransaction();

      const receipt_no = await nextReceiptNoTx(conn, companyId);
      const sale_datetime = new Date();
      const createdBy = req.user?.id ?? req.user?.sub ?? null;
      const items = Array.isArray(lines) ? lines : [];

      const gross = roundTo2(
        items.reduce(
          (sum, it) =>
            sum +
            Number(it?.price || it?.unit_price || 0) *
              Number(it?.quantity || it?.qty || 0),
          0,
        ),
      );

      const subtotal = roundTo2(
        items.reduce((sum, it) => {
          const qty = Number(it?.quantity || it?.qty || 0);
          const price = Number(it?.price || it?.unit_price || 0);
          const disc = Number(it?.discount || 0);
          const lineTotal = Math.max(0, qty * price - disc);
          return sum + lineTotal;
        }, 0),
      );

      const discountRaw = gross - subtotal;
      const discount =
        Number.isFinite(discountRaw) && discountRaw > 0
          ? roundTo2(discountRaw)
          : 0;

      const [taxSettingRows] = await conn.execute(
        `SELECT tax_code_id, tax_account_id, tax_type, is_active
         FROM pos_tax_settings
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        { companyId, branchId, branchIdsStr },
      );
      const taxSetting = taxSettingRows?.[0] || null;
      const taxSettingActive =
        taxSetting && Number(taxSetting.is_active) === 0 ? 0 : 1;

      const ratePercent = taxSettingActive
        ? Number(tax_rate_percent ?? 12.5)
        : 0;
      const rateFraction =
        Number.isFinite(ratePercent) && ratePercent > 0 ? ratePercent / 100 : 0;

      const taxMode = String(tax_type || "Exclusive").toLowerCase();

      let tax = 0;
      let net = subtotal;
      if (rateFraction > 0 && subtotal > 0) {
        if (taxMode === "inclusive") {
          const base = subtotal / (1 + rateFraction);
          tax = subtotal - base;
          net = subtotal;
        } else {
          tax = subtotal * rateFraction;
          net = subtotal + tax;
        }
      }
      tax = roundTo2(tax);
      net = roundTo2(net);

      const pm = String(payment_method || "CASH").toUpperCase();
      const st = String(status || "COMPLETED").toUpperCase();
      const finalStatus = pm === "CREDIT" ? "COMPLETED" : st === "DRAFT" ? "DRAFT" : "COMPLETED";

      let terminalIdValue = null;
      let terminalWarehouseId = null;
      if (terminal) {
        const [tRows] = await conn.execute(
          `SELECT id, warehouse_id FROM pos_terminals 
           WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND code = :code 
           LIMIT 1`,
          { companyId, branchId, branchIdsStr, code: String(terminal || "") },
        );
        if (!tRows || tRows.length === 0) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            `Terminal "${terminal}" not found for this branch.`,
          );
        }
        terminalIdValue = Number(tRows[0].id || 0) || null;
        terminalWarehouseId = Number(tRows[0].warehouse_id || 0) || null;
      } else {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Active terminal code is missing from the request.",
        );
      }

      if (!terminalWarehouseId && finalStatus !== "DRAFT") {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          `Active terminal "${terminal}" does not have an assigned warehouse for inventory deduction. Please assign a warehouse in POS Setup.`,
        );
      }
      const paymentsJson =
        Array.isArray(reqPayments) && reqPayments.length > 0
          ? JSON.stringify(reqPayments)
          : null;

      const [saleResult] = await conn.execute(
         `INSERT INTO pos_sales 
          (company_id, branch_id, terminal_id, receipt_no, sale_datetime, customer_name, customer_id, payment_status, paid_amount, payment_method, payments, gross_amount, discount_amount, tax_amount, tax_components, net_amount, status, created_by)
          VALUES 
          (:companyId, :branchId, :terminal_id, :receipt_no, :sale_datetime, :customer_name, :customer_id, :payment_status, :paid_amount, :payment_method, :payments, :gross_amount, :discount_amount, :tax_amount, :tax_components, :net_amount, :status, :created_by)`,
        {
          companyId,
          branchId, branchIdsStr,
          terminal_id: terminalIdValue,
          receipt_no,
          sale_datetime,
          customer_name: customer_name || null,
          customer_id: customer_id || null,
          payment_status: customer_id && payment_status ? payment_status : null,
          paid_amount: customer_id && payment_status === "PAID" ? net : 0,
          payment_method: (Array.isArray(reqPayments) && reqPayments.length > 1) ? "SPLIT" : (pm === "CARD" || pm === "MOBILE" || pm === "CREDIT" ? pm : "CASH"),
          payments: paymentsJson,
          gross_amount: gross,
          discount_amount: discount,
          tax_amount: tax,
          tax_components:
            Array.isArray(tax_components) && tax_components.length > 0
              ? JSON.stringify(tax_components)
              : null,
          net_amount: net,
          status: finalStatus,
          created_by: createdBy,
        },
      );

      const saleId = saleResult.insertId;

      for (let i = 0; i < items.length; i += 1) {
        const it = items[i] || {};
        const qty = Number(it?.quantity || it?.qty || 0);
        const unit = Number(it?.price || it?.unit_price || 0);
        const total = roundTo2(qty * unit);
        const itemId = Number(it?.item_id || 0);
        await conn.execute(
          `INSERT INTO pos_sale_lines (sale_id, line_no, item_id, item_name, qty, unit_price, line_total)
           VALUES (:sale_id, :line_no, :item_id, :item_name, :qty, :unit_price, :line_total)`,
          {
            sale_id: saleId,
            line_no: i + 1,
            item_id: itemId,
            item_name: String(it?.name || it?.item_name || ""),
            qty,
            unit_price: unit,
            line_total: total,
          },
        );
        if (itemId && qty > 0 && finalStatus === "COMPLETED") {
          // Consume stock using FIFO via StockService
          await consumeStockFIFOTx(conn, {
            companyId,
            branchId, branchIdsStr,
            warehouseId: terminalWarehouseId, // Use terminal-specific warehouse
            itemId,
            transactionType: "POS_SALE",
            qtyToConsume: qty,
            sourceRef: receipt_no,
            createdBy: createdBy,
          });
        }
      }

      if (false) {
        const fiscalYearId = await resolveOpenFiscalYearId(conn, {
          companyId,
        });
        if (!fiscalYearId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "No open fiscal year found for Finance",
          );
        }
        const voucherTypeId = await ensureReceiptVoucherTypeIdTx(conn, {
          companyId,
        });
        if (!voucherTypeId) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Receipt voucher type (RV) not configured",
          );
        }
        let paymentAccId = 0;
        let pmType = "";
        if (Number(payment_mode_id || 0) > 0) {
          const [pmRows] = await conn.execute(
            `SELECT type, account FROM pos_payment_modes 
             WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND id = :id LIMIT 1`,
            { companyId, branchId, id: Number(payment_mode_id) },
          );
          pmType = String(pmRows?.[0]?.type || "").toUpperCase();
          const pmAccRef = String(pmRows?.[0]?.account || "").trim();
          if (pmAccRef) {
            paymentAccId = await resolveFinAccountId(conn, {
              companyId,
              accountRef: pmAccRef,
            });
          }
        }
        // If "On Account" (AR) payment mode is used, post to customer's AR account
        const isArMode =
          pmType === "AR" || pm === "AR" || pmType === "ON_ACCOUNT";
        if (isArMode) {
          const custIdNum = Number(customer_id || 0);
          if (!custIdNum) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "customer_id is required for On Account sales",
            );
          }
          paymentAccId =
            (await ensureCustomerFinAccountIdTx(conn, {
              companyId,
              customerId: custIdNum,
            })) || 0;
        }
        if (!paymentAccId) {
          const fallbackRef = pm === "CASH" ? "1000" : "1000";
          paymentAccId = await resolveFinAccountId(conn, {
            companyId,
            accountRef: fallbackRef,
          });
        }
        let salesAccId =
          (await resolveFinAccountId(conn, {
            companyId,
            accountRef: "4000",
          })) || (await resolveDefaultSalesAccountId(conn, { companyId }));
        const vatOutputAccId = await resolveFinAccountId(conn, {
          companyId,
          accountRef: "1310",
        });
        if (!paymentAccId || !salesAccId || (tax > 0 && !vatOutputAccId)) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "Required Finance accounts not found for posting",
          );
        }
        const baseSales = roundTo2(net - tax);
        const voucherNo = await nextVoucherNoTx(conn, {
          companyId,
          voucherTypeId,
        });
        const voucherDate =
          toYmd(sale_datetime) || new Date().toISOString().slice(0, 10);
        const [vIns] = await conn.execute(
          `INSERT INTO fin_vouchers
            (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, approved_by, posted_by)
           VALUES
            (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, :ba, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
          {
            companyId,
            branchId, branchIdsStr,
            fiscalYearId,
            voucherTypeId,
            voucherNo,
            voucherDate,
            narration: `POS Sale Receipt ${receipt_no}${customer_name ? " to " + String(customer_name) : ""}`,
            totalDebit: net,
            totalCredit: roundTo2(baseSales + tax),
            ba: net,
            createdBy,
            approvedBy: createdBy,
            postedBy: createdBy,
          },
        );
        const voucherId = Number(vIns.insertId || 0);
        let lineNo = 1;
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: paymentAccId,
            description: isArMode
              ? `Accounts Receivable${customer_name ? " • " + String(customer_name) : ""}`
              : "POS receipt payment",
            debit: net,
            credit: 0,
            referenceNo: receipt_no,
          },
        );
        if (baseSales > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: salesAccId,
              description: "POS sales revenue",
              debit: 0,
              credit: baseSales,
              referenceNo: receipt_no,
            },
          );
        }
        if (tax > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, :referenceNo)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: vatOutputAccId,
              description: "VAT on sales",
              debit: 0,
              credit: tax,
              referenceNo: receipt_no,
            },
          );
        }
      }

      await conn.commit();
      res.status(201).json({
        id: saleId,
        receipt_no,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/day/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const terminal = String(req.query.terminal || "").trim();
      const requestedDate = String(req.query.date || "").trim();
      const businessDate = /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
        ? requestedDate
        : null;
      await ensurePosTables();
      const coerceJsonValue = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === "string") {
          try {
            return JSON.parse(value);
          } catch {
            return value;
          }
        }
        if (Buffer.isBuffer(value)) {
          try {
            return JSON.parse(value.toString("utf8"));
          } catch {
            return value.toString("utf8");
          }
        }
        if (
          value &&
          typeof value === "object" &&
          value.type === "Buffer" &&
          Array.isArray(value.data)
        ) {
          try {
            const text = Buffer.from(value.data).toString("utf8");
            return JSON.parse(text);
          } catch {
            return value;
          }
        }
        return value;
      };
      const userId = req.user?.id ?? req.user?.sub ?? null;
      let rows = [];
      if (userId) {
        rows = await query(
          `
          SELECT
            id,
            terminal_code,
            business_date,
            open_datetime,
            opening_float,
            supervisor_name,
            shift,
            open_notes,
            open_denomination_counts,
            close_datetime,
            actual_cash,
            actual_momo,
            momo_opening_balance,
            momo_closing_balance,
            momo_closing_main,
            momo_closing_pay,
            momo_opening_main,
            momo_opening_pay,
            close_notes,
            close_denomination_counts,
            next_opening_float,
            status,
            created_at,
            created_by,
            u.username AS created_by_name
           FROM pos_day_status
          LEFT JOIN adm_users u ON u.id = created_by
           WHERE company_id = :companyId
             AND (:branchIdsStr = '' OR FIND_IN_SET(pos_day_status.branch_id, :branchIdsStr))
             ${businessDate ? "AND business_date = :businessDate" : ""}
             ${terminal ? "AND terminal_code = :terminal" : ""}
             AND created_by = :userId
             AND status = 'OPEN'
          ORDER BY open_datetime DESC
          LIMIT 1
          `,
          terminal
            ? { companyId, branchId, branchIdsStr, terminal, businessDate, userId }
            : { companyId, branchId, branchIdsStr, businessDate, userId },
        );
      }

      let item = rows.length ? rows[0] : null;
      if (item && String(item.status || "").toUpperCase() === "OPEN") {
        const openDateStr = new Date(item.open_datetime || item.created_at).toISOString().slice(0, 10);
        const todayDateStr = new Date().toISOString().slice(0, 10);
        if (openDateStr < todayDateStr) {
          // Auto-close stale unclosed shift from a previous date
          await query(
            `
            UPDATE pos_day_status
            SET status = 'CLOSED',
                close_datetime = COALESCE(close_datetime, NOW()),
                closed_by = :userId,
                close_notes = COALESCE(close_notes, 'Auto-closed stale past-day shift')
            WHERE id = :id
            `,
            { userId, id: item.id },
          ).catch(() => {});
          await query(
            `
            UPDATE pos_sessions
            SET status = 'CLOSED',
                end_time = NOW(),
                closed_by = :userId
            WHERE day_status_id = :id AND company_id = :companyId
            `,
            { userId, id: item.id, companyId },
          ).catch(() => {});
          item = null;
        }
      }
      if (item) {
        item.open_denomination_counts = coerceJsonValue(
          item.open_denomination_counts,
        );
        item.close_denomination_counts = coerceJsonValue(
          item.close_denomination_counts,
        );
      }
      let nextOpeningFloat = null;
      let nextMomoOpeningMain = null;
      let nextMomoOpeningPay = null;
      if (!item || item.status === "CLOSED" || String(item.created_by || "") !== String(userId || "")) {
        const fallbackRows = await query(
          `
          SELECT next_opening_float, actual_cash, momo_closing_main, momo_closing_pay, momo_closing_balance, actual_momo
          FROM pos_day_status
          WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
            ${terminal ? "AND terminal_code = :terminal" : ""}
            AND status = 'CLOSED'
          ORDER BY COALESCE(close_datetime, open_datetime) DESC, id DESC
          LIMIT 1
          `,
          terminal
            ? { companyId, branchId, branchIdsStr, terminal }
            : { companyId, branchId, branchIdsStr },
        );
        const fallback = fallbackRows?.[0] || null;
        if (fallback) {
          const nextFloat = Number(fallback.next_opening_float);
          const actCash = Number(fallback.actual_cash);
          nextOpeningFloat = Number.isFinite(nextFloat) && nextFloat > 0
            ? nextFloat
            : Number.isFinite(actCash)
              ? actCash
              : 0;

          const nMain = Number(fallback.momo_closing_main);
          const nPay = Number(fallback.momo_closing_pay);
          nextMomoOpeningMain = Number.isFinite(nMain) ? nMain : 0;
          nextMomoOpeningPay = Number.isFinite(nPay) ? nPay : 0;

          if (nextMomoOpeningMain === 0 && nextMomoOpeningPay === 0) {
            const actMomo = Number(fallback.actual_momo ?? fallback.momo_closing_balance ?? 0);
            if (actMomo > 0) {
              nextMomoOpeningMain = actMomo;
            }
          }
        }
      }
      res.json({ item, nextOpeningFloat, nextMomoOpeningMain, nextMomoOpeningPay });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/sessions/:sessionNo/finance-post",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const sessionNo = String(req.params.sessionNo || "").trim();
      if (!sessionNo)
        throw httpError(400, "VALIDATION_ERROR", "Invalid sessionNo");
      await conn.beginTransaction();
      await ensurePosTables();
      const [sessRows] = await conn.execute(
        `SELECT id, terminal_code, cashier_name, start_time, end_time, opening_cash, total_sales, status
         FROM pos_sessions
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND session_no = :sessionNo
         LIMIT 1`,
        { companyId, branchId, branchIdsStr, sessionNo },
      );
      const sess = sessRows?.[0] || null;
      if (!sess) throw httpError(404, "NOT_FOUND", "Session not found");
      if (String(sess.status || "") !== "CLOSED")
        throw httpError(400, "VALIDATION_ERROR", "Session must be CLOSED");
      const startTime = new Date(sess.start_time);
      const endTime = new Date(sess.end_time || new Date());
      if (
        Number.isNaN(startTime.getTime()) ||
        Number.isNaN(endTime.getTime())
      ) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid session time range");
      }
      const [aggRows] = await conn.execute(
        `SELECT
           SUM(CASE WHEN COALESCE(payment_method, '')='CASH' THEN (COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) ELSE 0 END) AS cash_total,
           SUM(CASE WHEN COALESCE(payment_method, '')='CARD' THEN (COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) ELSE 0 END) AS card_total,
           SUM(CASE WHEN COALESCE(payment_method, '')='MOBILE' THEN (COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) ELSE 0 END) AS mobile_total,
           SUM(CASE WHEN COALESCE(payment_method, '')='CREDIT' THEN (COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) ELSE 0 END) AS credit_total,
           SUM(tax_amount) AS tax_total,
           SUM(discount_amount) AS discount_total,
           SUM(COALESCE(gross_amount,0) + COALESCE(tax_amount,0) - COALESCE(discount_amount,0)) AS net_total
         FROM pos_sales
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND status = 'COMPLETED'
           AND sale_datetime BETWEEN :startTime AND :endTime`,
        { companyId, branchId, branchIdsStr, startTime, endTime },
      );
      const [retRows] = await conn.execute(
        `SELECT
           SUM(CASE WHEN refund_method='CASH' THEN total_refund ELSE 0 END) AS cash_return,
           SUM(CASE WHEN refund_method='CARD' THEN total_refund ELSE 0 END) AS card_return,
           SUM(CASE WHEN refund_method='MOBILE' THEN total_refund ELSE 0 END) AS mobile_return,
           SUM(CASE WHEN refund_method='CREDIT' THEN total_refund ELSE 0 END) AS credit_return,
           SUM(total_refund) AS return_total
         FROM pos_returns
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND return_datetime BETWEEN :startTime AND :endTime`,
        { companyId, branchId, branchIdsStr, startTime, endTime },
      );
      const cashTotal = roundTo2(
        (aggRows?.cash_total || 0) - (retRows?.cash_return || 0),
      );
      const cardTotal = roundTo2(
        (aggRows?.card_total || 0) - (retRows?.card_return || 0),
      );
      const mobileTotal = roundTo2(
        (aggRows?.mobile_total || 0) - (retRows?.mobile_return || 0),
      );
      const creditTotal = roundTo2(
        (aggRows?.credit_total || 0) - (retRows?.credit_return || 0),
      );
      const rawNetTotal = roundTo2(aggRows?.net_total || 0);
      const rawTaxTotal = roundTo2(aggRows?.tax_total || 0);
      const returnTotal = roundTo2(retRows?.return_total || 0);
      const netTotal = roundTo2(rawNetTotal - returnTotal);
      const taxRatio = rawNetTotal > 0 ? rawTaxTotal / rawNetTotal : 0;
      const taxTotal = roundTo2(rawTaxTotal - returnTotal * taxRatio);
      let baseSales = roundTo2(netTotal - taxTotal);
      if (baseSales < 0) baseSales = 0;
      let bankTotal = roundTo2(cashTotal + cardTotal + mobileTotal);
      if (bankTotal <= 0 && netTotal > 0) bankTotal = netTotal;
      if (bankTotal <= 0) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "No eligible sales for posting",
        );
      }
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      if (!fiscalYearId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "No open fiscal year found for Finance",
        );
      }
      let voucherTypeId = await ensureSalesVoucherTypeIdTx(conn, {
        companyId,
      });
      if (!voucherTypeId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Sales voucher type (SV) not configured",
        );
      }
      await ensureFinanceReportingInfrastructure();
      let bankAccId =
        (await resolveFinAccountId(conn, { companyId, accountRef: "1000" })) ||
        (await ensureFinAccountExistsTx(conn, {
          companyId,
          code: "1000",
          name: "Cash/Bank",
          nature: "ASSET",
        }));
      let salesAccId =
        (await resolveFinAccountId(conn, { companyId, accountRef: "4000" })) ||
        (await ensureFinAccountExistsTx(conn, {
          companyId,
          code: "4000",
          name: "Sales Revenue",
          nature: "INCOME",
        }));
      let vatOutputAccId =
        (await resolveFinAccountId(conn, { companyId, accountRef: "1310" })) ||
        (await ensureFinAccountExistsTx(conn, {
          companyId,
          code: "1310",
          name: "VAT Output",
          nature: "LIABILITY",
        }));
      const [existingV] = await conn.execute(
        `SELECT id FROM fin_vouchers
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND narration = :narration
         LIMIT 1`,
        { companyId, branchId, branchIdsStr, narration: `POS Session ${sessionNo}` },
      );
      if (existingV?.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Session already finance-posted",
        );
      }
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = endTime.toISOString().slice(0, 10);
      const createdBy = req.user?.id ?? req.user?.sub ?? null;
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, :ba, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId, branchIdsStr,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration: `POS Aggregated Sales for Session ${sessionNo} - ${sess.cashier_name || "Cashier"}`,
          totalDebit: bankTotal,
          totalCredit: roundTo2(baseSales + taxTotal),
          ba: bankTotal,
          createdBy,
          approvedBy: createdBy,
          postedBy: createdBy,
        },
      );
      const voucherId = Number(vIns.insertId || 0);
      let lineNo = 1;
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: bankAccId,
          description: "POS aggregated receipts",
          debit: bankTotal,
          credit: 0,
        },
      );
      if (baseSales > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: salesAccId,
            description: "POS sales revenue",
            debit: 0,
            credit: baseSales,
          },
        );
      }
      if (taxTotal > 0) {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: vatOutputAccId,
            description: "VAT on sales",
            debit: 0,
            credit: taxTotal,
          },
        );
      }
      const [dayRows] = await conn.execute(
        `SELECT actual_cash, opening_float, business_date
         FROM pos_day_status
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND terminal_code = :terminal
           AND business_date BETWEEN DATE(:startTime) AND DATE(:endTime)
         ORDER BY business_date DESC
         LIMIT 1`,
        {
          companyId,
          branchId, branchIdsStr,
          terminal: String(sess.terminal_code || ""),
          startTime,
          endTime,
        },
      );
      const day = dayRows?.[0] || null;
      if (day && day.actual_cash !== null) {
        const expectedCash = roundTo2(
          Number(day.opening_float || 0) + cashTotal,
        );
        const declaredCash = roundTo2(Number(day.actual_cash || 0));
        const variance = roundTo2(declaredCash - expectedCash);
        if (variance !== 0) {
          const cashOverShortAccId = await resolveFinAccountId(conn, {
            companyId,
            accountRef: "CASH_OVER_SHORT",
          });
          if (cashOverShortAccId) {
            if (variance < 0) {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: cashOverShortAccId,
                  description: "Cash short variance",
                  debit: Math.abs(variance),
                  credit: 0,
                },
              );
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: bankAccId,
                  description: "Cash short variance",
                  debit: 0,
                  credit: Math.abs(variance),
                },
              );
            } else {
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: bankAccId,
                  description: "Cash over variance",
                  debit: Math.abs(variance),
                  credit: 0,
                },
              );
              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
                 VALUES
                  (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
                {
                  companyId,
                  voucherId,
                  lineNo: lineNo++,
                  accountId: cashOverShortAccId,
                  description: "Cash over variance",
                  debit: 0,
                  credit: Math.abs(variance),
                },
              );
            }
          }
        }
      }
      await conn.commit();
      res.status(201).json({
        session_no: sessionNo,
        voucher_no: voucherNo,
        voucher_id: voucherId,
      });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);
router.post(
  "/day/open",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const {
        terminal,
        openingDateTime,
        openingFloat,
        shift,
        notes,
        denominationCounts,
        momoOpeningMain,
        momoOpeningPay,
      } = req.body || {};
      if (!terminal || !openingDateTime) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "terminal and openingDateTime are required",
        );
      }
      await ensurePosTables();
      const openDate = new Date(openingDateTime);
      const businessDate = Number.isNaN(openDate.getTime())
        ? new Date()
        : openDate;
      const userId = req.user?.id ?? req.user?.sub ?? null;
      const shiftName = String(shift || "Morning Shift").trim();
      const existing = await query(
        `
        SELECT id, status, open_datetime,
          created_at,
          u.username AS created_by_name
         FROM pos_day_status
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(pos_day_status.branch_id, :branchIdsStr))
          ${terminal ? "AND terminal_code = :terminal" : ""}
          ${userId ? "AND created_by = :userId" : ""}
          AND status = 'OPEN'
        ORDER BY open_datetime DESC
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr, terminal, userId },
      );
      if (existing.length && existing[0].status === "OPEN") {
        const prev = existing[0];
        const prevOpenDateStr = new Date(prev.open_datetime || prev.created_at).toISOString().slice(0, 10);
        const newOpenDateStr = openDate.toISOString().slice(0, 10);
        const isFromPreviousDay = prevOpenDateStr < newOpenDateStr;
        if (req.body.forceOpen || req.body.autoClosePrevious || isFromPreviousDay) {
          await query(
            `
            UPDATE pos_day_status
            SET status = 'CLOSED',
                close_datetime = :openDate,
                closed_by = :userId,
                close_notes = COALESCE(close_notes, 'Auto-closed upon opening next shift/day')
            WHERE id = :prevId
            `,
            { openDate, userId, prevId: prev.id },
          );
          await query(
            `
            UPDATE pos_sessions
            SET status = 'CLOSED',
                end_time = :openDate,
                closed_by = :userId
            WHERE (day_status_id = :prevId OR (terminal_code = :terminal AND status = 'OPEN'))
              AND company_id = :companyId
            `,
            { openDate, userId, prevId: prev.id, terminal, companyId },
          ).catch(() => {});
        } else {
          throw httpError(
            400,
            "ALREADY_OPEN",
            "You already have an open shift for this terminal. Please close your current shift or use Force Open.",
          );
        }
      }
      const result = await query(
        `
        INSERT INTO pos_day_status
          (company_id, branch_id, terminal_code, business_date, open_datetime, opening_float, supervisor_name, shift, open_notes, open_denomination_counts, momo_opening_main, momo_opening_pay, created_by, created_at, status)
        VALUES
          (:companyId, :branchId, :terminal, DATE(:businessDate), :open_datetime, :opening_float, :supervisor_name, :shiftName, :open_notes, :open_denomination_counts, :momo_opening_main, :momo_opening_pay, :userId, NOW(), 'OPEN')
        `,
        {
          companyId,
          branchId, branchIdsStr,
          terminal,
          businessDate,
          open_datetime: openDate,
          opening_float: Number(openingFloat || 0),
          supervisor_name: null,
          shiftName,
          open_notes: notes || null,
          open_denomination_counts:
            normalizeDenominationCounts(denominationCounts),
          momo_opening_main: Number(momoOpeningMain || 0),
          momo_opening_pay: Number(momoOpeningPay || 0),
          userId,
        },
      );

      // Create session in pos_sessions
      const sessionNo = `SESS-${Date.now().toString().slice(-8)}`;
      await query(
        `
        INSERT INTO pos_sessions
          (company_id, branch_id, day_status_id, session_no, terminal_code, cashier_name, shift, start_time, opening_cash, total_sales, status, created_by, created_at)
        VALUES
          (:companyId, :branchId, :dayStatusId, :sessionNo, :terminal, :cashierName, :shiftName, :startTime, :openingCash, 0, 'OPEN', :userId, NOW())
        `,
        {
          companyId,
          branchId,
          dayStatusId: result.insertId,
          sessionNo,
          terminal,
          cashierName: req.user?.username || req.user?.name || "Cashier",
          shiftName,
          startTime: openDate,
          openingCash: Number(openingFloat || 0),
          userId,
        },
      ).catch(() => {});

      const [item] = await query(
        `
        SELECT
          id,
          terminal_code,
          business_date,
          open_datetime,
          opening_float,
          supervisor_name,
          shift,
          open_notes,
          open_denomination_counts,
          close_datetime,
          actual_cash,
          actual_momo,
          momo_opening_balance,
          momo_closing_balance,
          momo_opening_main,
          momo_opening_pay,
          close_notes,
          close_denomination_counts,
          next_opening_float,
          status,
          created_at,
          created_by,
          u.username AS created_by_name
         FROM pos_day_status
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id
        LIMIT 1
        `,
        { id: result.insertId },
      );
      res.status(201).json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/finance-post",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      const dateStr = String(body.date || "").trim();
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "date (YYYY-MM-DD) is required",
        );
      }
      const terminalId = toNumber(body.terminal_id);
      const terminalCode = String(body.terminal || "").trim();
      const warehouseName = String(body.warehouse || "").trim();
      await conn.beginTransaction();
      await ensurePosTables();
      const startTime = new Date(`${dateStr}T00:00:00`);
      const endTime = new Date(`${dateStr}T23:59:59`);
      const params = { companyId, branchId, branchIdsStr, startTime, endTime };
      const inputLines = Array.isArray(body.lines) ? body.lines : [];
      const useCustomLines = inputLines.some(
        (l) => Number(l?.debit || 0) > 0 || Number(l?.credit || 0) > 0,
      );
      let filterSql = "";
      if (terminalId) {
        filterSql += " AND p.terminal_id = :terminalId";
        params.terminalId = terminalId;
      } else if (terminalCode) {
        filterSql += " AND t.code = :terminalCode";
        params.terminalCode = terminalCode;
      }
      if (warehouseName) {
        filterSql += " AND COALESCE(t.warehouse,'') = :warehouseName";
        params.warehouseName = warehouseName;
      }
      let cashTotal = 0;
      let cardTotal = 0;
      let mobileTotal = 0;
      let taxTotal = 0;
      let netTotal = 0;
      let baseSales = 0;
      let bankTotal = 0;
      let totalDebitHeader = 0;
      let totalCreditHeader = 0;
      if (!useCustomLines) {
        const [aggRows] = await conn.execute(
          `SELECT
             SUM(CASE WHEN COALESCE(p.payment_method, '')='CASH' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS cash_total,
             SUM(CASE WHEN COALESCE(p.payment_method, '')='CARD' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS card_total,
             SUM(CASE WHEN COALESCE(p.payment_method, '')='MOBILE' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS mobile_total,
             SUM(CASE WHEN COALESCE(p.payment_method, '')='CREDIT' THEN (COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) ELSE 0 END) AS credit_total,
             SUM(p.tax_amount) AS tax_total,
             SUM(p.discount_amount) AS discount_total,
             SUM(COALESCE(p.gross_amount,0) + COALESCE(p.tax_amount,0) - COALESCE(p.discount_amount,0)) AS net_total
           FROM pos_sales p
           LEFT JOIN pos_terminals t
             ON t.id = p.terminal_id AND t.company_id = p.company_id AND t.branch_id = p.branch_id
           WHERE p.company_id = :companyId
             AND (:branchIdsStr = '' OR FIND_IN_SET(p.branch_id, :branchIdsStr))
             AND p.status = 'COMPLETED'
             AND p.sale_datetime BETWEEN :startTime AND :endTime
             ${filterSql}`,
          params,
        );
        const returnFilterSql = filterSql
          .replace(/p\./g, "ps.")
          .replace(/t\.code/g, "t.code");
        const retParams = { ...params };
        const [retRows] = await conn.execute(
          `SELECT
             SUM(CASE WHEN r.refund_method='CASH' THEN r.total_refund ELSE 0 END) AS cash_return,
             SUM(CASE WHEN r.refund_method='CARD' THEN r.total_refund ELSE 0 END) AS card_return,
             SUM(CASE WHEN r.refund_method='MOBILE' THEN r.total_refund ELSE 0 END) AS mobile_return,
             SUM(CASE WHEN r.refund_method='CREDIT' THEN r.total_refund ELSE 0 END) AS credit_return,
             SUM(r.total_refund) AS return_total
           FROM pos_returns r
           JOIN pos_sales ps ON ps.id = r.sale_id
           LEFT JOIN pos_terminals t
             ON t.id = ps.terminal_id AND t.company_id = ps.company_id AND t.branch_id = ps.branch_id
           WHERE r.company_id = :companyId
             AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
             AND r.return_datetime BETWEEN :startTime AND :endTime
             ${filterSql.replace(/p\./g, "ps.")}`,
          retParams,
        );
        cashTotal = roundTo2(
          (aggRows?.cash_total || 0) - (retRows?.cash_return || 0),
        );
        cardTotal = roundTo2(
          (aggRows?.card_total || 0) - (retRows?.card_return || 0),
        );
        mobileTotal = roundTo2(
          (aggRows?.mobile_total || 0) - (retRows?.mobile_return || 0),
        );
        const creditTotal = roundTo2(
          (aggRows?.credit_total || 0) - (retRows?.credit_return || 0),
        );
        const rawNetTotal = roundTo2(aggRows?.net_total || 0);
        const rawTaxTotal = roundTo2(aggRows?.tax_total || 0);
        const returnTotal = roundTo2(retRows?.return_total || 0);
        netTotal = roundTo2(rawNetTotal - returnTotal);
        const taxRatio = rawNetTotal > 0 ? rawTaxTotal / rawNetTotal : 0;
        taxTotal = roundTo2(rawTaxTotal - returnTotal * taxRatio);
        baseSales = roundTo2(netTotal - taxTotal);
        bankTotal = roundTo2(cashTotal + cardTotal + mobileTotal);
        if (bankTotal <= 0 || baseSales < 0) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "No eligible sales for posting",
          );
        }
        totalDebitHeader = bankTotal;
        totalCreditHeader = roundTo2(baseSales + taxTotal);
      } else {
        totalDebitHeader = roundTo2(
          inputLines.reduce((s, l) => s + Number(l?.debit || 0), 0),
        );
        totalCreditHeader = roundTo2(
          inputLines.reduce((s, l) => s + Number(l?.credit || 0), 0),
        );
        if (totalDebitHeader <= 0 && totalCreditHeader <= 0) {
          throw httpError(
            400,
            "VALIDATION_ERROR",
            "No eligible custom lines for posting",
          );
        }
      }
      const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
      if (!fiscalYearId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "No open fiscal year found for Finance",
        );
      }
      const voucherTypeId = await ensureSalesVoucherTypeIdTx(conn, {
        companyId,
      });
      if (!voucherTypeId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Sales voucher type (SV) not configured",
        );
      }
      await ensureFinanceReportingInfrastructure();
      let bankAccId = 0;
      let salesAccId = 0;
      let vatOutputAccId = 0;
      if (!useCustomLines) {
        bankAccId =
          (await resolveFinAccountId(conn, {
            companyId,
            accountRef: "1000",
          })) ||
          (await ensureFinAccountExistsTx(conn, {
            companyId,
            code: "1000",
            name: "Cash/Bank",
            nature: "ASSET",
          }));
        salesAccId =
          (await resolveFinAccountId(conn, {
            companyId,
            accountRef: "4000",
          })) ||
          (await ensureFinAccountExistsTx(conn, {
            companyId,
            code: "4000",
            name: "Sales Revenue",
            nature: "INCOME",
          }));
        vatOutputAccId =
          (await resolveFinAccountId(conn, {
            companyId,
            accountRef: "1310",
          })) ||
          (await ensureFinAccountExistsTx(conn, {
            companyId,
            code: "1310",
            name: "VAT Output",
            nature: "LIABILITY",
          }));
      }
      const narration = `POS Aggregated Sales for Day ${dateStr}${terminalCode ? " - Terminal " + terminalCode : ""}`;
      const [existingV] = await conn.execute(
        `SELECT id FROM fin_vouchers
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND voucher_type_id = :voucherTypeId AND voucher_date = DATE(:voucherDate)
           AND narration = :narration
         LIMIT 1`,
        {
          companyId,
          branchId, branchIdsStr,
          voucherTypeId,
          voucherDate: startTime,
          narration,
        },
      );
      if (existingV?.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "POS finance already posted for this day/filter",
        );
      }
      const voucherNo = await nextVoucherNoTx(conn, {
        companyId,
        voucherTypeId,
      });
      const voucherDate = dateStr;
      const createdBy = req.user?.id ?? req.user?.sub ?? null;
      const [curRows] = await conn.execute(
        `SELECT id FROM fin_currencies WHERE company_id = :companyId AND is_base = 1 LIMIT 1`,
        { companyId },
      );
      const baseCurrencyId = Number(curRows?.[0]?.id || 0) || null;
      const [vIns] = await conn.execute(
        `INSERT INTO fin_vouchers
          (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
          (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId, branchIdsStr,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration,
          currencyId: baseCurrencyId,
          totalDebit: totalDebitHeader,
          totalCredit: totalCreditHeader,
          createdBy,
          approvedBy: createdBy,
          postedBy: createdBy,
        },
      );
      const voucherId = Number(vIns.insertId || 0);
      let lineNo = 1;
      const defaultLineDesc = `pos sales made for ${dateStr}`;
      if (useCustomLines) {
        for (const ln of inputLines) {
          const accId =
            Number(ln?.account_id || 0) ||
            (await resolveFinAccountIdByLabel(conn, {
              companyId,
              label: String(ln?.account || ""),
            })) ||
            0;
          if (!accId) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              `Account not found for label: ${String(ln?.account || "")}`,
            );
          }
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: accId,
              description: defaultLineDesc,
              debit: roundTo2(Number(ln?.debit || 0)),
              credit: roundTo2(Number(ln?.credit || 0)),
            },
          );
        }
      } else {
        await conn.execute(
          `INSERT INTO fin_voucher_lines
            (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
            (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId: bankAccId,
            description: defaultLineDesc,
            debit: bankTotal,
            credit: 0,
          },
        );
        if (roundTo2(baseSales) > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: salesAccId,
              description: defaultLineDesc,
              debit: 0,
              credit: baseSales,
            },
          );
        }
        if (roundTo2(taxTotal) > 0) {
          await conn.execute(
            `INSERT INTO fin_voucher_lines
              (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
             VALUES
              (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
            {
              companyId,
              voucherId,
              lineNo: lineNo++,
              accountId: vatOutputAccId,
              description: defaultLineDesc,
              debit: 0,
              credit: taxTotal,
            },
          );
        }
      }
      await conn.commit();
      res.status(201).json({ voucher_no: voucherNo, voucher_id: voucherId });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/day/close",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const {
        terminal,
        closingDateTime,
        actualCash,
        nextOpeningFloat,
        notes,
        denominationCounts,
        actualMoMo,
        momoOpeningBalance,
        momoClosingBalance,
        momoClosingMain,
        momoClosingPay,
      } = req.body || {};
      if (!terminal || !closingDateTime) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "terminal and closingDateTime are required",
        );
      }
      await ensurePosTables();
      const closeDate = new Date(closingDateTime);
      const businessDate = Number.isNaN(closeDate.getTime())
        ? new Date()
        : closeDate;
      const userId = req.user?.id ?? req.user?.sub ?? null;
      let existing = [];
      if (userId) {
        existing = await query(
          `
          SELECT id,
            created_at,
            u.username AS created_by_name
           FROM pos_day_status
          LEFT JOIN adm_users u ON u.id = created_by
           WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(pos_day_status.branch_id, :branchIdsStr))
            AND terminal_code = :terminal
            AND (created_by = :userId OR created_by IS NULL)
            AND status = 'OPEN'
          ORDER BY (created_by = :userId) DESC, open_datetime DESC
          LIMIT 1
          `,
          { companyId, branchId, branchIdsStr, terminal, userId },
        );
      }
      if (!existing.length) {
        existing = await query(
          `
          SELECT id,
            created_at,
            u.username AS created_by_name
           FROM pos_day_status
          LEFT JOIN adm_users u ON u.id = created_by
           WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(pos_day_status.branch_id, :branchIdsStr))
            AND terminal_code = :terminal
            AND status = 'OPEN'
          ORDER BY open_datetime DESC
          LIMIT 1
          `,
          { companyId, branchId, branchIdsStr, terminal },
        );
      }
      if (!existing.length) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Open day not found for this terminal",
        );
      }
      const id = existing[0].id;
      await query(
        `
        UPDATE pos_day_status
        SET close_datetime = :close_datetime,
            actual_cash = :actual_cash,
            actual_momo = :actual_momo,
            momo_opening_balance = :momo_opening_balance,
            momo_closing_balance = :momo_closing_balance,
            momo_closing_main = :momo_closing_main,
            momo_closing_pay = :momo_closing_pay,
            close_notes = :close_notes,
            close_denomination_counts = :close_denomination_counts,
            next_opening_float = :next_opening_float,
            closed_by = :userId,
            status = 'CLOSED'
        WHERE id = :id
          AND company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
        `,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          close_datetime: closeDate,
          actual_cash: Number(actualCash || 0),
          actual_momo: Number(actualMoMo || 0),
          momo_opening_balance: Number(momoOpeningBalance || 0),
          momo_closing_balance: Number(momoClosingBalance || 0),
          momo_closing_main: Number(momoClosingMain || 0),
          momo_closing_pay: Number(momoClosingPay || 0),
          close_notes: notes || null,
          close_denomination_counts:
            normalizeDenominationCounts(denominationCounts),
          next_opening_float: Number(nextOpeningFloat || 0),
          userId,
        },
      );

      // Also close the pos_sessions record
      await query(
        `
        UPDATE pos_sessions
        SET end_time = :close_datetime,
            status = 'CLOSED',
            closed_by = :userId,
            updated_at = NOW()
        WHERE company_id = :companyId
          AND (day_status_id = :id OR (terminal_code = :terminal AND (created_by = :userId OR created_by IS NULL) AND status = 'OPEN'))
        `,
        {
          id,
          companyId,
          terminal,
          close_datetime: closeDate,
          userId,
        },
      ).catch(() => {});

      const [item] = await query(
        `
        SELECT
          id,
          terminal_code,
          business_date,
          open_datetime,
          opening_float,
          supervisor_name,
          shift,
          open_notes,
          open_denomination_counts,
          close_datetime,
          actual_cash,
          actual_momo,
          momo_opening_balance,
          momo_closing_balance,
          momo_opening_main,
          momo_opening_pay,
          close_notes,
          close_denomination_counts,
          next_opening_float,
          status,
          created_at,
          created_by,
          closed_by,
          u.username AS created_by_name
         FROM pos_day_status
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id
        LIMIT 1
        `,
        { id },
      );
      res.json({ item });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/day/history",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const terminal = String(req.query.terminal || "").trim();
      const dateFrom = String(req.query.dateFrom || "").trim();
      const dateTo = String(req.query.dateTo || "").trim();
      await ensurePosTables();
      const coerceJsonValue = (value) => {
        if (value === null || value === undefined) return null;
        if (typeof value === "string") {
          try { return JSON.parse(value); } catch { return value; }
        }
        if (Buffer.isBuffer(value)) {
          try { return JSON.parse(value.toString("utf8")); } catch { return value.toString("utf8"); }
        }
        if (value && typeof value === "object" && value.type === "Buffer" && Array.isArray(value.data)) {
          try { const text = Buffer.from(value.data).toString("utf8"); return JSON.parse(text); } catch { return value; }
        }
        return value;
      };
      const params = { companyId, branchId, branchIdsStr };
      const conditions = ["ds.company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(ds.branch_id, :branchIdsStr))"];
      if (terminal) {
        conditions.push("ds.terminal_code = :terminal");
        params.terminal = terminal;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
        conditions.push("ds.business_date >= :dateFrom");
        params.dateFrom = dateFrom;
      }
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
        conditions.push("ds.business_date <= :dateTo");
        params.dateTo = dateTo;
      }
      const rows = await query(
        `SELECT ds.id, ds.terminal_code, ds.business_date, ds.open_datetime, ds.opening_float,
                ds.supervisor_name, ds.shift, ds.open_notes, ds.open_denomination_counts,
                ds.close_datetime, ds.actual_cash, ds.actual_momo,
                ds.momo_opening_balance, ds.momo_closing_balance,
                ds.momo_closing_main, ds.momo_closing_pay,
                ds.momo_opening_main, ds.momo_opening_pay,
                ds.close_notes, ds.close_denomination_counts, ds.next_opening_float, ds.status,
                ds.created_at, ds.created_by, ds.closed_by, u.username AS created_by_name,
                COALESCE((
                  SELECT SUM(s.net_amount)
                  FROM pos_sales s
                  LEFT JOIN pos_terminals t ON t.id = s.terminal_id AND t.company_id = s.company_id AND t.branch_id = s.branch_id
                  WHERE s.company_id = ds.company_id
                    AND s.branch_id = ds.branch_id
                    AND t.code = ds.terminal_code
                    AND s.sale_datetime >= ds.open_datetime
                    AND (ds.close_datetime IS NULL OR s.sale_datetime <= ds.close_datetime)
                    AND s.status = 'COMPLETED'
                ), 0) AS total_sales
         FROM pos_day_status ds
         LEFT JOIN adm_users u ON u.id = ds.created_by
         WHERE ${conditions.join(" AND ")}
         ORDER BY ds.open_datetime DESC`,
        params,
      );
      const items = [];
      for (const item of rows) {
        item.open_denomination_counts = coerceJsonValue(item.open_denomination_counts);
        item.close_denomination_counts = coerceJsonValue(item.close_denomination_counts);
        item.total_sales = Number(item.total_sales || 0);
        // Compute cash_amount and mobile_amount from matching sales, handling split payments
        let cashAmount = 0;
        let mobileAmount = 0;
        try {
          const saleRows = await query(
            `SELECT s.payment_method, s.payments, s.net_amount
             FROM pos_sales s
             LEFT JOIN pos_terminals t ON t.id = s.terminal_id AND t.company_id = s.company_id AND t.branch_id = s.branch_id
             WHERE s.company_id = :companyId
               AND (:branchIdsStr = '' OR FIND_IN_SET(s.branch_id, :branchIdsStr))
               AND t.code = :terminalCode
               AND s.sale_datetime >= :openDatetime
               AND (:closeDatetime IS NULL OR s.sale_datetime <= :closeDatetime)
               AND s.status = 'COMPLETED'`,
            {
              companyId: item.company_id || companyId,
              branchId: item.branch_id || branchId,
              terminalCode: String(item.terminal_code || ""),
              openDatetime: item.open_datetime,
              closeDatetime: item.close_datetime || null,
            },
          );
          for (const sale of saleRows) {
            const payments = sale.payments;
            if (payments && typeof payments === "string") {
              try {
                const parsed = JSON.parse(payments);
                if (Array.isArray(parsed)) {
                  for (const pmt of parsed) {
                    const method = String(pmt.method || "").toUpperCase();
                    if (method === "CASH") {
                      cashAmount += Number(pmt.amount || 0);
                    } else if (method === "MOBILE") {
                      mobileAmount += Number(pmt.amount || 0);
                    }
                  }
                  continue;
                }
              } catch {}
            }
            // Fallback: no payments JSON — use payment_method
            const method = String(sale.payment_method || "").toUpperCase();
            if (method === "CASH") {
              cashAmount += Number(sale.net_amount || 0);
            } else if (method === "MOBILE") {
              mobileAmount += Number(sale.net_amount || 0);
            }
          }
        } catch {}
        item.cash_amount = cashAmount;
        item.mobile_amount = mobileAmount;
        items.push(item);
      }
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/terminals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const items = await query(
        `SELECT id, code, name, warehouse, warehouse_id, counter_no, ip_address, is_active,
          enable_vfd, vfd_type, vfd_port,
          created_at,
          u.username AS created_by_name
         FROM pos_terminals
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_terminals.branch_id, :branchIdsStr)) AND is_active = 1
         ORDER BY code ASC`,
        { companyId, branchId, branchIdsStr },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/terminals/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await ensurePosTables();
      const items = await query(
        `SELECT id, code, name, warehouse, warehouse_id, counter_no, ip_address, is_active,
          enable_vfd, vfd_type, vfd_port,
          created_at,
          u.username AS created_by_name
         FROM pos_terminals
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_terminals.branch_id, :branchIdsStr)) 
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!items.length)
        throw httpError(404, "NOT_FOUND", "Terminal not found");
      res.json({ item: items[0] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/terminals",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const {
        code,
        name,
        warehouse,
        warehouse_id,
        counter_no,
        ip_address,
        active,
        enable_vfd,
        vfd_type,
        vfd_port,
      } = req.body || {};
      if (!code || !name)
        throw httpError(400, "VALIDATION_ERROR", "code and name are required");
      await ensurePosTables();
      const result = await query(
        `INSERT INTO pos_terminals (company_id, branch_id, code, name, warehouse, warehouse_id, counter_no, ip_address, is_active, enable_vfd, vfd_type, vfd_port)
         VALUES (:companyId, :branchId, :code, :name, :warehouse, :warehouse_id, :counter_no, :ip_address, :is_active, :enable_vfd, :vfd_type, :vfd_port)`,
        {
          companyId,
          branchId, branchIdsStr,
          code,
          name,
          warehouse: warehouse || null,
          warehouse_id: warehouse_id ? Number(warehouse_id) : null,
          counter_no: counter_no ? Number(counter_no) : null,
          ip_address: ip_address || null,
          is_active: active ? 1 : 0,
          enable_vfd: enable_vfd ? 1 : 0,
          vfd_type: vfd_type || "generic",
          vfd_port: vfd_port ? Number(vfd_port) : 9100,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/terminals/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const {
        code,
        name,
        warehouse,
        warehouse_id,
        counter_no,
        ip_address,
        active,
        enable_vfd,
        vfd_type,
        vfd_port,
      } = req.body || {};
      await ensurePosTables();
      const [existing] = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_terminals
        LEFT JOIN adm_users u ON u.id = created_by
          WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_terminals.branch_id, :branchIdsStr)) AND status = 'COMPLETED'
          LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Terminal not found");
      await query(
        `UPDATE pos_terminals
         SET code = :code, name = :name, warehouse = :warehouse, warehouse_id = :warehouse_id, counter_no = :counter_no, ip_address = :ip_address, is_active = :is_active, enable_vfd = :enable_vfd, vfd_type = :vfd_type, vfd_port = :vfd_port
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          code,
          name,
          warehouse: warehouse || null,
          warehouse_id: warehouse_id ? Number(warehouse_id) : null,
          counter_no: counter_no ? Number(counter_no) : null,
          ip_address: ip_address || null,
          is_active: active ? 1 : 0,
          enable_vfd: enable_vfd ? 1 : 0,
          vfd_type: vfd_type || "generic",
          vfd_port: vfd_port ? Number(vfd_port) : 9100,
        },
      );
      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/vfd/display",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const { terminal_id, terminal_code, line1, line2 } = req.body || {};
      if (!terminal_id && !terminal_code) {
        return res
          .status(400)
          .json({ message: "terminal_id or terminal_code is required" });
      }
      await ensurePosTables();
      const rows = await query(
        `SELECT enable_vfd, ip_address, vfd_port, vfd_type
         FROM pos_terminals
         WHERE ${terminal_id ? "id = :id" : "code = :code"}
           AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        terminal_id
          ? { id: Number(terminal_id), companyId, branchId, branchIdsStr }
          : { code: String(terminal_code || "").trim(), companyId, branchId, branchIdsStr },
      );
      const term = rows?.[0];
      if (!term || !Number(term.enable_vfd)) {
        return res.json({ sent: false, reason: "VFD not enabled" });
      }
      const host = String(term.ip_address || "").trim();
      const port = Number(term.vfd_port) || 9100;
      if (!host) {
        return res.json({ sent: false, reason: "VFD IP not configured" });
      }

      // Build ESC/POS display commands
      const esc = String.fromCharCode(27);
      const lf = String.fromCharCode(10);
      const ff = String.fromCharCode(12);
      const cr = String.fromCharCode(13);

      const t1 = String(line1 || "")
        .trim()
        .slice(0, 40);
      const t2 = String(line2 || "")
        .trim()
        .slice(0, 40);
      let payload;

      const type = String(term.vfd_type || "generic").toLowerCase();
      if (type === "epson-dm-d") {
        // Epson DM-D protocol: ESC RS n (n=1 line1, n=2 line2) + text
        const rs = String.fromCharCode(30);
        payload = esc + "@"; // Initialize
        payload += esc + rs + String.fromCharCode(1) + t1; // Line 1
        payload += esc + rs + String.fromCharCode(2) + t2; // Line 2
      } else {
        // Generic: overwrite lines with spaces to clear, then write text
        const lineLen = 20;
        payload = cr + " ".repeat(lineLen) + cr + " ".repeat(lineLen) + cr;
        payload += (t1 + " ".repeat(lineLen)).slice(0, lineLen) + cr + lf;
        payload += (t2 + " ".repeat(lineLen)).slice(0, lineLen) + lf;
      }

      // Send via TCP with a short timeout
      const { default: net } = await import("node:net");
      await new Promise((resolve, reject) => {
        const sock = new net.Socket();
        const timeout = setTimeout(() => {
          sock.destroy();
          reject(new Error("VFD connection timeout"));
        }, 3000);
        sock.connect(port, host, () => {
          sock.write(Buffer.from(payload, "ascii"));
          sock.end();
          clearTimeout(timeout);
          resolve();
        });
        sock.on("error", (err) => {
          clearTimeout(timeout);
          sock.destroy();
          reject(err);
        });
      });

      res.json({ sent: true });
    } catch (err) {
      res.json({
        sent: false,
        reason: err.message || "VFD communication failed",
      });
    }
  },
);
router.get(
  "/terminal-users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const terminalId = toNumber(req.query.terminalId, 0) || 0;
      await ensurePosTables();
      const items = await query(
        `
        SELECT
          ptu.terminal_id,
          ptu.user_id,
          ptu.is_active,
          u.username,
          u.email,
          ptu.created_at,
          cu.username AS created_by_name
         FROM pos_terminal_users ptu
        JOIN adm_users u ON u.id = ptu.user_id
        LEFT JOIN adm_users cu ON cu.id = ptu.created_by
         WHERE ptu.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(ptu.branch_id, :branchIdsStr))
          AND (:terminalId = 0 OR ptu.terminal_id = :terminalId)
        ORDER BY u.username ASC
        `,
        { companyId, branchId, branchIdsStr, terminalId },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/terminal-users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const { terminalId, userIds } = req.body || {};
      const tId = toNumber(terminalId, 0);
      if (!tId) {
        throw httpError(400, "VALIDATION_ERROR", "terminalId is required");
      }
      const cleanUserIds = Array.from(
        new Set(Array.isArray(userIds) ? userIds : []),
      )
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0);

      await ensurePosTables();

      const [term] = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_terminals
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_terminals.branch_id, :branchIdsStr))
         LIMIT 1`,
        { id: tId, companyId, branchId, branchIdsStr },
      );
      if (!term) throw httpError(404, "NOT_FOUND", "Terminal not found");

      if (cleanUserIds.length) {
        const placeholders = cleanUserIds.map((_, i) => `:uid${i}`).join(", ");
        const params = { companyId, branchId, branchIdsStr };
        for (let i = 0; i < cleanUserIds.length; i += 1) {
          params[`uid${i}`] = cleanUserIds[i];
        }
        const rows = await query(
          `
          SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(adm_users.branch_id, :branchIdsStr))
            AND id IN (${placeholders})
          `,
          params,
        );
        const validSet = new Set((rows || []).map((r) => Number(r.id)));
        for (const uid of cleanUserIds) {
          if (!validSet.has(uid)) {
            throw httpError(
              400,
              "VALIDATION_ERROR",
              "One or more users are invalid for this branch",
            );
          }
        }
      }

      await query(
        `DELETE FROM pos_terminal_users
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND terminal_id = :terminalId`,
        { companyId, branchId, branchIdsStr, terminalId: tId },
      );

      for (const uid of cleanUserIds) {
        await query(
          `INSERT INTO pos_terminal_users (company_id, branch_id, terminal_id, user_id, is_active)
           VALUES (:companyId, :branchId, :terminalId, :userId, 1)`,
          { companyId, branchId, branchIdsStr, terminalId: tId, userId: uid },
        );
      }

      res.json({ terminalId: tId, assigned: cleanUserIds.length });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/tax-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const rows = await query(
        `
        SELECT
          s.tax_code_id,
          s.tax_account_id,
          s.tax_type,
          s.is_active,
          s.component_mappings,
          t.code AS tax_code,
          t.name AS tax_name,
          t.rate_percent AS tax_rate_percent,
          s.created_at,
          u.username AS created_by_name
         FROM pos_tax_settings s
        LEFT JOIN fin_tax_codes t
          ON t.company_id = s.company_id
          AND t.id = s.tax_code_id
        LEFT JOIN adm_users u ON u.id = s.created_by
         WHERE s.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(s.branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      res.json({ item: rows?.[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/tax-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const { taxCodeId, taxAccountId, taxType, isActive, componentMappings } =
        req.body || {};
      await ensurePosTables();

      const normalizedTaxType = String(taxType || "").trim();
      if (
        normalizedTaxType &&
        normalizedTaxType !== "Inclusive" &&
        normalizedTaxType !== "Exclusive"
      ) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid taxType");
      }

      const taxCodeIdNum = toNumber(taxCodeId, null);
      const taxAccountIdNum = toNumber(taxAccountId, null);
      const isActiveNum =
        isActive === undefined ? null : Number(Boolean(isActive));

      if (taxCodeIdNum) {
        const rows = await query(
          `
          SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_tax_codes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
            AND id = :id
          LIMIT 1
          `,
          { companyId, id: taxCodeIdNum },
        );
        if (!rows.length)
          throw httpError(400, "VALIDATION_ERROR", "Invalid taxCodeId");
      }

      if (taxAccountIdNum) {
        const rows = await query(
          `
          SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_accounts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
            AND id = :id
          LIMIT 1
          `,
          { companyId, id: taxAccountIdNum },
        );
        if (!rows.length)
          throw httpError(400, "VALIDATION_ERROR", "Invalid taxAccountId");
      }

      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_tax_settings
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(pos_tax_settings.branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );

      if (existing?.id) {
        await query(
          `
          UPDATE pos_tax_settings
          SET tax_code_id = :tax_code_id,
              tax_account_id = :tax_account_id,
              tax_type = :tax_type,
              is_active = COALESCE(:is_active, is_active),
              component_mappings = :component_mappings
          WHERE id = :id
            AND company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            tax_code_id: taxCodeIdNum,
            tax_account_id: taxAccountIdNum,
            tax_type: normalizedTaxType || "Exclusive",
            is_active: isActiveNum,
            component_mappings: componentMappings
              ? JSON.stringify(componentMappings)
              : null,
          },
        );
        return res.json({ id: existing.id });
      }

      const result = await query(
        `
        INSERT INTO pos_tax_settings
          (company_id, branch_id, tax_code_id, tax_account_id, tax_type, is_active, component_mappings)
        VALUES
          (:companyId, :branchId, :tax_code_id, :tax_account_id, :tax_type, :is_active, :component_mappings)
        `,
        {
          companyId,
          branchId, branchIdsStr,
          tax_code_id: taxCodeIdNum,
          tax_account_id: taxAccountIdNum,
          tax_type: normalizedTaxType || "Exclusive",
          is_active: isActiveNum === null ? 1 : isActiveNum,
          component_mappings: componentMappings
            ? JSON.stringify(componentMappings)
            : null,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/receipt-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const rows = await query(
        `
        SELECT
          company_name,
          show_logo,
          header_text,
          footer_text,
          contact_number,
          address_line1,
          address_line2,
          logo_url,
          created_at,
          u.username AS created_by_name
         FROM pos_receipt_settings
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(pos_receipt_settings.branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      res.json({ item: rows?.[0] || null });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/receipt-settings",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const {
        companyName,
        showLogo,
        headerText,
        footerText,
        contactNumber,
        addressLine1,
        addressLine2,
        logoUrl,
      } = req.body || {};
      await ensurePosTables();

      const company_name = companyName
        ? String(companyName).slice(0, 255)
        : null;
      const showLogoNum =
        showLogo === undefined ? null : Number(Boolean(showLogo));
      const header_text = headerText ? String(headerText).slice(0, 2000) : null;
      const footer_text = footerText ? String(footerText).slice(0, 2000) : null;
      const contact_number = contactNumber
        ? String(contactNumber).slice(0, 50)
        : null;
      const address_line1 = addressLine1
        ? String(addressLine1).slice(0, 255)
        : null;
      const address_line2 = addressLine2
        ? String(addressLine2).slice(0, 255)
        : null;
      const logo_url = logoUrl ? String(logoUrl).slice(0, 255) : null;

      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_receipt_settings
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(pos_receipt_settings.branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );

      if (existing?.id) {
        await query(
          `
          UPDATE pos_receipt_settings
          SET show_logo = COALESCE(:show_logo, show_logo),
              company_name = :company_name,
              header_text = :header_text,
              footer_text = :footer_text,
              contact_number = :contact_number,
              address_line1 = :address_line1,
              address_line2 = :address_line2,
              logo_url = :logo_url
          WHERE id = :id
            AND company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            company_name,
            show_logo: showLogoNum,
            header_text,
            footer_text,
            contact_number,
            address_line1,
            address_line2,
            logo_url,
          },
        );
        return res.json({ id: existing.id });
      }

      const result = await query(
        `
        INSERT INTO pos_receipt_settings
          (company_id, branch_id, company_name, show_logo, header_text, footer_text, contact_number, address_line1, address_line2, logo_url)
        VALUES
          (:companyId, :branchId, :company_name, :show_logo, :header_text, :footer_text, :contact_number, :address_line1, :address_line2, :logo_url)
        `,
        {
          companyId,
          branchId, branchIdsStr,
          company_name,
          show_logo: showLogoNum === null ? 0 : showLogoNum,
          header_text,
          footer_text,
          contact_number,
          address_line1,
          address_line2,
          logo_url,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-reasons",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const defaults = [
        "Defective",
        "Wrong Item",
        "Damaged",
        "Unwanted",
        "Other",
      ];
      const existing = await query(
        `SELECT id FROM pos_return_reasons WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
        { companyId, branchId, branchIdsStr },
      );
      if (!existing?.length) {
        for (const r of defaults) {
          await query(
            `INSERT INTO pos_return_reasons (company_id, branch_id, reason, is_active)
             VALUES (:companyId, :branchId, :reason, 1)
             ON DUPLICATE KEY UPDATE is_active = 1`,
            { companyId, branchId, branchIdsStr, reason: r },
          );
        }
      }
      const rows = await query(
        `SELECT id, reason, is_active, created_at, updated_at
         FROM pos_return_reasons
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND is_active = 1
         ORDER BY reason ASC`,
        { companyId, branchId, branchIdsStr },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/return-reasons",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const reasons = Array.isArray(req.body?.reasons) ? req.body.reasons : [];
      const cleaned = Array.from(
        new Set(
          reasons
            .map((r) => String(r || "").trim())
            .filter(Boolean)
            .map((r) => r.slice(0, 150)),
        ),
      );
      if (!cleaned.length) {
        return res
          .status(400)
          .json({ message: "reasons must be a non-empty array" });
      }
      await ensurePosTables();
      for (const reason of cleaned) {
        await query(
          `INSERT INTO pos_return_reasons (company_id, branch_id, reason, is_active)
           VALUES (:companyId, :branchId, :reason, 1)
           ON DUPLICATE KEY UPDATE is_active = 1`,
          { companyId, branchId, branchIdsStr, reason },
        );
      }
      const params = { companyId, branchId, branchIdsStr };
      const placeholders = cleaned.map((_, i) => `:r${i}`).join(", ");
      cleaned.forEach((r, i) => {
        params[`r${i}`] = r;
      });
      await query(
        `UPDATE pos_return_reasons
         SET is_active = 0
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND reason NOT IN (${placeholders})`,
        params,
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

const posLogoUpload = multer({ storage: multer.memoryStorage() });
router.post(
  "/receipt-settings/logo",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  posLogoUpload.single("logo"),
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      await query("UPDATE adm_companies SET logo = :blob WHERE id = :id", {
        blob: req.file.buffer,
        id: companyId,
      });
      await ensurePosTables();
      const logoUrl = `/api/admin/companies/${companyId}/logo`;
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_receipt_settings
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(pos_receipt_settings.branch_id, :branchIdsStr))
        LIMIT 1
        `,
        { companyId, branchId, branchIdsStr },
      );
      if (existing?.id) {
        await query(
          `
          UPDATE pos_receipt_settings
          SET logo_url = :logo_url,
              show_logo = 1
          WHERE id = :id
            AND company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          `,
          {
            id: existing.id,
            companyId,
            branchId,
            logo_url: logoUrl,
          },
        );
      } else {
        await query(
          `
          INSERT INTO pos_receipt_settings
            (company_id, branch_id, show_logo, logo_url)
          VALUES
            (:companyId, :branchId, 1, :logo_url)
          `,
          { companyId, branchId, branchIdsStr, logo_url: logoUrl },
        );
      }
      return res.json({
        message: "Logo uploaded",
        logoUrl,
        hasLogo: true,
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const items = await query(
        `SELECT
           id,
           name,
           type,
           account,
           require_reference,
           is_active,
          created_at,
          u.username AS created_by_name
         FROM pos_payment_modes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(pos_payment_modes.branch_id, :branchIdsStr))
         ORDER BY name ASC`,
        { companyId, branchId, branchIdsStr },
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const result = await query(
        `INSERT INTO pos_payment_modes
           (company_id, branch_id, name, type, account, require_reference, is_active)
         VALUES
           (:companyId, :branchId, :name, :type, :account, :require_reference, :is_active)`,
        {
          companyId,
          branchId, branchIdsStr,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/payment-modes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const [existing] = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_payment_modes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_payment_modes.branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing) {
        throw httpError(404, "NOT_FOUND", "Payment mode not found");
      }
      await query(
        `UPDATE pos_payment_modes
         SET name = :name,
             type = :type,
             account = :account,
             require_reference = :require_reference,
             is_active = :is_active
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/customer-history",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const { customerName, customerId, fromDate, toDate } = req.query;

      let sql = `
        SELECT 
          s.id,
          s.receipt_no,
          s.sale_datetime,
          s.customer_name,
          s.customer_id,
          s.payment_status,
          s.paid_amount,
          s.gross_amount,
          s.discount_amount,
          s.tax_amount,
          s.net_amount,
          s.status
        FROM pos_sales s
        WHERE s.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND s.status = 'COMPLETED'
          AND NOT EXISTS (SELECT 1 FROM pos_returns r WHERE r.sale_id = s.id)
      `;
      const params = { companyId, branchId, branchIdsStr };

      if (customerId) {
        sql += " AND s.customer_id = :customerId";
        params.customerId = Number(customerId);
      } else if (customerName) {
        sql += " AND s.customer_name LIKE :customerName";
        params.customerName = `%${customerName}%`;
      }
      if (fromDate) {
        sql += " AND s.sale_datetime >= :fromDate";
        params.fromDate = `${fromDate} 00:00:00`;
      }
      if (toDate) {
        sql += " AND s.sale_datetime <= :toDate";
        params.toDate = `${toDate} 23:59:59`;
      }

      sql += " ORDER BY s.sale_datetime ASC LIMIT 200";

      const sales = await query(sql, params);

      if (!sales.length) {
        return res.json({ items: [] });
      }

      const saleIds = sales.map((s) => s.id);
      const placeholders = saleIds.map((_, i) => `:id${i}`).join(",");
      const lineParams = {};
      saleIds.forEach((id, i) => {
        lineParams[`id${i}`] = id;
      });

      const lines = await query(
        `SELECT sale_id, item_name, qty, unit_price, line_total,
          created_at,
          u.username AS created_by_name
         FROM pos_sale_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE sale_id IN (${placeholders})`,
        lineParams,
      );

      const linesBySaleId = {};
      lines.forEach((l) => {
        if (!linesBySaleId[l.sale_id]) linesBySaleId[l.sale_id] = [];
        linesBySaleId[l.sale_id].push(l);
      });

      const items = sales.map((s) => ({
        ...s,
        lines: linesBySaleId[s.id] || [],
      }));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);


router.post(
  "/payment-modes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const result = await query(
        `INSERT INTO pos_payment_modes
           (company_id, branch_id, name, type, account, require_reference, is_active)
         VALUES
           (:companyId, :branchId, :name, :type, :account, :require_reference, :is_active)`,
        {
          companyId,
          branchId, branchIdsStr,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.status(201).json({ id: result.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/payment-modes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const { name, type, account, requireReference, active } = req.body || {};
      const trimmedName = String(name || "").trim();
      const trimmedType = String(type || "").trim();
      if (!trimmedName || !trimmedType) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "name and type are required for payment mode",
        );
      }
      await ensurePosTables();
      const [existing] = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM pos_payment_modes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pos_payment_modes.branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing) {
        throw httpError(404, "NOT_FOUND", "Payment mode not found");
      }
      await query(
        `UPDATE pos_payment_modes
         SET name = :name,
             type = :type,
             account = :account,
             require_reference = :require_reference,
             is_active = :is_active
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id,
          companyId,
          branchId, branchIdsStr,
          name: trimmedName,
          type: trimmedType,
          account: account || null,
          require_reference: requireReference ? 1 : 0,
          is_active: active ? 1 : 0,
        },
      );
      res.json({ id });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/customer-history",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const { customerName, customerId, fromDate, toDate } = req.query;

      let sql = `
        SELECT 
          s.id,
          s.receipt_no,
          s.sale_datetime,
          s.customer_name,
          s.customer_id,
          s.payment_status,
          s.paid_amount,
          s.gross_amount,
          s.discount_amount,
          s.tax_amount,
          s.net_amount,
          s.status
        FROM pos_sales s
        WHERE s.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
          AND s.status = 'COMPLETED'
      `;
      const params = { companyId, branchId, branchIdsStr };

      if (customerId) {
        sql += " AND s.customer_id = :customerId";
        params.customerId = Number(customerId);
      } else if (customerName) {
        sql += " AND s.customer_name LIKE :customerName";
        params.customerName = `%${customerName}%`;
      }
      if (fromDate) {
        sql += " AND s.sale_datetime >= :fromDate";
        params.fromDate = `${fromDate} 00:00:00`;
      }
      if (toDate) {
        sql += " AND s.sale_datetime <= :toDate";
        params.toDate = `${toDate} 23:59:59`;
      }

      sql += " ORDER BY s.sale_datetime ASC LIMIT 200";

      const sales = await query(sql, params);

      if (!sales.length) {
        return res.json({ items: [] });
      }

      const saleIds = sales.map((s) => s.id);
      const placeholders = saleIds.map((_, i) => `:id${i}`).join(",");
      const lineParams = {};
      saleIds.forEach((id, i) => {
        lineParams[`id${i}`] = id;
      });

      const lines = await query(
        `SELECT sale_id, item_name, qty, unit_price, line_total,
          created_at,
          u.username AS created_by_name
         FROM pos_sale_lines
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE sale_id IN (${placeholders})`,
        lineParams,
      );

      const linesBySaleId = {};
      lines.forEach((l) => {
        if (!linesBySaleId[l.sale_id]) linesBySaleId[l.sale_id] = [];
        linesBySaleId[l.sale_id].push(l);
      });

      const items = sales.map((s) => ({
        ...s,
        lines: linesBySaleId[s.id] || [],
      }));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/sales/:id/payment-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const saleId = Number(req.params.id || 0);
      const { paid_amount, payment_method_id } = req.body || {};

      if (!saleId) {
        return res.status(400).json({ message: "Invalid sale ID" });
      }
      const paidVal = Number(paid_amount);
      if (isNaN(paidVal) || paidVal < 0) {
        return res.status(400).json({ message: "paid_amount must be a non-negative number" });
      }

      const [existing] = await query(
        "SELECT id, net_amount, customer_name, receipt_no FROM pos_sales WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'COMPLETED'",
        { id: saleId, companyId, branchId, branchIdsStr },
      );
      if (!existing) {
        return res.status(404).json({ message: "Sale not found" });
      }

      const payment_status = paidVal >= Number(existing.net_amount) ? "PAID" : "UNPAID";

      if (payment_method_id) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();

          const [modeRows] = await conn.execute(
            "SELECT id, type, account, name FROM pos_payment_modes WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND id = :pmid LIMIT 1",
            { companyId, branchId, pmid: payment_method_id }
          );
          const selectedMode = modeRows?.[0];

          const [creditModeRows] = await conn.execute(
            "SELECT id, type, account, name FROM pos_payment_modes WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND type = 'credit' LIMIT 1",
            { companyId, branchId, branchIdsStr }
          );
          const creditMode = creditModeRows?.[0];

          if (selectedMode && creditMode && paidVal > 0) {
            const debitAccountId = await resolveFinAccountId(conn, { companyId, accountRef: selectedMode.account });
            const creditAccountId = await resolveFinAccountId(conn, { companyId, accountRef: creditMode.account });

            if (debitAccountId && creditAccountId) {
              const jvTypeId = await ensureJournalVoucherTypeIdTx(conn, { companyId });
              const jvNo = await nextVoucherNoTx(conn, { companyId, voucherTypeId: jvTypeId });
              const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
              const todayYmd = new Date().toISOString().slice(0, 10);
              const userId = req.user?.id ?? req.user?.sub ?? null;

              const [insV] = await conn.execute(
                `INSERT INTO fin_vouchers
                  (company_id, branch_id, fiscal_year_id, voucher_no, voucher_date, voucher_type_id, status, created_by)
                 VALUES
                  (:companyId, :branchId, :fiscalYearId, :voucherNo, :voucherDate, :voucherTypeId, 'POSTED', :userId)`,
                {
                  companyId,
                  branchId, branchIdsStr,
                  fiscalYearId,
                  voucherNo: jvNo,
                  voucherDate: todayYmd,
                  voucherTypeId: jvTypeId,
                  userId,
                }
              );
              const voucherId = insV.insertId;

              const customerLabel = String(existing.customer_name || "Walk-in Customer").trim();
              const description = `Payment received from ${customerLabel} for POS sale`;

              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit)
                 VALUES
                  (:companyId, :voucherId, 1, :accountId, :desc, :amt, 0)`,
                {
                  companyId,
                  voucherId,
                  accountId: debitAccountId,
                  desc: description,
                  amt: paidVal,
                }
              );

              await conn.execute(
                `INSERT INTO fin_voucher_lines
                  (company_id, voucher_id, line_no, account_id, description, debit, credit)
                 VALUES
                  (:companyId, :voucherId, 2, :accountId, :desc, 0, :amt)`,
                {
                  companyId,
                  voucherId,
                  accountId: creditAccountId,
                  desc: description,
                  amt: paidVal,
                }
              );
            }
          }

          await conn.execute(
            "UPDATE pos_sales SET paid_amount = :paid_amount, payment_status = :payment_status WHERE id = :id",
            { paid_amount: paidVal, payment_status, id: saleId }
          );

          await conn.commit();
        } catch (e) {
          await conn.rollback();
          throw e;
        } finally {
          conn.release();
        }
      } else {
        await query(
          "UPDATE pos_sales SET paid_amount = :paid_amount, payment_status = :payment_status WHERE id = :id",
          { paid_amount: paidVal, payment_status, id: saleId },
        );
      }

      res.json({ message: "Payment recorded", payment_status, paid_amount: paidVal });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/holds",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      await ensurePosTables();
      const sales = await query(
        `SELECT s.id, s.status, s.receipt_no, s.sale_datetime, s.customer_name, s.customer_id,
                s.gross_amount, s.discount_amount, s.tax_amount, s.net_amount,
                (COALESCE(s.gross_amount,0) - COALESCE(s.discount_amount,0) + COALESCE(s.tax_amount,0)) AS total_amount,
                s.payment_status, s.paid_amount, s.terminal_id
         FROM pos_sales s
         WHERE s.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND s.status = 'DRAFT'
         ORDER BY s.sale_datetime DESC
         LIMIT 200`,
        { companyId, branchId, branchIdsStr },
      );
      if (!sales.length) return res.json({ items: [] });

      const saleIds = sales.map((s) => s.id);
      const placeholders = saleIds.map((_, i) => `:id${i}`).join(",");
      const lineParams = {};
      saleIds.forEach((id, i) => { lineParams[`id${i}`] = id; });

      const lines = await query(
        `SELECT sale_id, item_name, qty, item_id, unit_price, line_total
         FROM pos_sale_lines
         WHERE sale_id IN (${placeholders})`,
        lineParams,
      );
      const linesBySaleId = {};
      lines.forEach((l) => {
        if (!linesBySaleId[l.sale_id]) linesBySaleId[l.sale_id] = [];
        linesBySaleId[l.sale_id].push(l);
      });
      const items = sales.map((s) => ({
        ...s,
        lines: linesBySaleId[s.id] || [],
      }));
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/holds/:id/unhold",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const saleId = Number(req.params.id || 0);
      if (!saleId) throw httpError(400, "VALIDATION_ERROR", "Invalid sale ID");

      const [sale] = await conn.execute(
        `SELECT s.id, s.status, s.receipt_no, s.terminal_id,
                s.customer_id, s.customer_name, s.gross_amount, s.discount_amount,
                s.tax_amount, s.tax_components, s.net_amount,
                s.payment_status, s.paid_amount, s.sale_datetime,
                COALESCE(t.code, '') AS terminal_code
         FROM pos_sales s
         LEFT JOIN pos_terminals t ON t.id = s.terminal_id AND t.company_id = s.company_id AND t.branch_id = s.branch_id
         WHERE s.id = :id AND s.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(s.branch_id, :branchIdsStr)) AND s.status = 'DRAFT'
         LIMIT 1`,
        { id: saleId, companyId, branchId, branchIdsStr },
      );
      if (!sale) throw httpError(404, "NOT_FOUND", "Sale not found or already completed");

      const [saleLines] = await conn.execute(
        `SELECT id, item_id, item_name, qty, unit_price, line_total
         FROM pos_sale_lines WHERE sale_id = :saleId`,
        { saleId },
      );

      res.json({
        sale: {
          ...sale,
          lines: saleLines,
        },
      });
    } catch (err) {
      next(err);
    } finally {
      conn.release();
    }
  },
);

router.get(
  "/holds/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const saleId = Number(req.params.id || 0);
      if (!saleId) throw httpError(400, "VALIDATION_ERROR", "Invalid sale ID");

      const [sale] = await query(
        `SELECT s.id, s.status, s.receipt_no, s.terminal_id,
                s.customer_id, s.customer_name, s.gross_amount, s.discount_amount,
                s.tax_amount, s.tax_components, s.net_amount,
                s.payment_status, s.paid_amount, s.sale_datetime,
                COALESCE(t.code, '') AS terminal_code
         FROM pos_sales s
         LEFT JOIN pos_terminals t ON t.id = s.terminal_id AND t.company_id = s.company_id AND t.branch_id = s.branch_id
         WHERE s.id = :id AND s.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(s.branch_id, :branchIdsStr)) AND s.status = 'DRAFT'
         LIMIT 1`,
        { id: saleId, companyId, branchId, branchIdsStr },
      );
      if (!sale) throw httpError(404, "NOT_FOUND", "Sale not found or already completed");

      const lines = await query(
        `SELECT id, item_id, item_name, qty, unit_price, line_total
         FROM pos_sale_lines WHERE sale_id = :saleId`,
        { saleId },
      );

      res.json({ sale: { ...sale, lines } });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/holds/:id/cancel",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId, branchIdsStr = '' } = req.scope || {};
      const saleId = Number(req.params.id || 0);
      if (!saleId) throw httpError(400, "VALIDATION_ERROR", "Invalid sale ID");

      const [sale] = await query(
        `SELECT id, status FROM pos_sales WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status = 'DRAFT'
         LIMIT 1`,
        { id: saleId, companyId, branchId, branchIdsStr },
      );
      if (!sale) throw httpError(404, "NOT_FOUND", "Sale not found or already completed");

      await query(`UPDATE pos_sales SET status = 'VOID' WHERE id = :id`, { id: saleId });
      res.json({ message: "Sale cancelled successfully", id: saleId });
    } catch (err) {
      next(err);
    }
  },
);

export default router;

