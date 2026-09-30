/**
 * @file purchase.controller.js
 * @description Handles procurement and purchasing operations including service confirmations,
 * shipping advices, port clearances, and supplier management.
 */
// Database and Utility Dependencies
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

// Utility Function: Safely convert a value to a finite number
function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// Utility Function: Generate a unique document number with a prefix and date
function nextDocNo(prefix) {
  return `${prefix}-${new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "")}-${Math.floor(Math.random() * 10000)}`;
}

async function nextScNo(companyId, branchId) {
  const rows = await query(
    `SELECT sc_no FROM inv_service_confirmations
      WHERE company_id = :companyId AND (:branchId IS NULL OR branch_id = :branchId)
        AND sc_no REGEXP '^SC-[0-9]{6}$'
      ORDER BY CAST(SUBSTRING(sc_no, 4) AS UNSIGNED) DESC LIMIT 1`,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const numPart = String(rows[0].sc_no || "").slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `SC-${String(nextNum).padStart(6, "0")}`;
}

// Utility Function: Check if a specific column exists in a database table
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

// Voucher Management: Resolve voucher type ID by its code
async function resolveVoucherTypeIdByCode(conn, { companyId, code }) {
  const [rows] = await conn.execute(
    "SELECT id FROM fin_voucher_types WHERE company_id = :companyId AND code = :code LIMIT 1",
    { companyId, code },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
// Voucher Management: Ensure Journal Voucher type exists and return its ID
async function ensureJournalVoucherTypeIdTx(conn, { companyId }) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
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
// Voucher Management: Ensure Purchase Voucher type exists and return its ID
async function ensurePurchaseVoucherTypeIdTx(conn, { companyId }) {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const existingId = await resolveVoucherTypeIdByCode(conn, {
    companyId,
    code: "PV",
  });
  if (existingId) return existingId;
  try {
    await conn.execute(
      `INSERT INTO fin_voucher_types
        (company_id, code, name, category, prefix, next_number, requires_approval, is_active)
       VALUES
        (:companyId, 'PV', 'Purchase Voucher', 'PURCHASE', 'PV', 1, 0, 1)`,
      { companyId },
    );
  } catch (e) {
    if (String(e?.code || "") !== "ER_DUP_ENTRY") throw e;
  }
  const id = await resolveVoucherTypeIdByCode(conn, { companyId, code: "PV" });
  return id || 0;
}
// Voucher Management: Generate the next voucher number and increment the sequence
async function nextVoucherNoTx(conn, { companyId, voucherTypeId }) {
  const [rows] = await conn.execute(
    "SELECT prefix, next_number FROM fin_voucher_types WHERE company_id = :companyId AND id = :voucherTypeId LIMIT 1",
    { companyId, voucherTypeId },
  );
  const vt = rows?.[0];
  if (!vt) throw httpError(404, "NOT_FOUND", "Voucher type not found");
  const voucherNo = `${vt.prefix}-${vt.next_number}`;
  await conn.execute(
    "UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE company_id = :companyId AND id = :voucherTypeId",
    { companyId, voucherTypeId },
  );
  return voucherNo;
}
// Utility Function: Format a Date object or string to YYYY-MM-DD
function toYmd(d) {
  const dt = d instanceof Date ? d : new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
// Financial Configuration: Resolve the ID of an open fiscal year, creating one if necessary
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
    `SELECT id, is_open
     FROM fin_fiscal_years
     WHERE company_id = :companyId
       AND :todayYmd >= start_date
       AND :todayYmd <= end_date
     ORDER BY start_date DESC
     LIMIT 1`,
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
    `INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open)
     VALUES (:companyId, :code, :startDate, :endDate, 1)`,
    { companyId, code, startDate, endDate },
  );
  const newId = Number(ins?.insertId || 0) || 0;
  return newId;
}
// Financial Configuration: Auto-resolve the VAT Input account ID
async function resolveVatInputAccountIdAuto(conn, { companyId }) {
  const [codeRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = '2200'
     LIMIT 1`,
    { companyId },
  );
  const codeId = Number(codeRows?.[0]?.id || 0) || 0;
  if (codeId) return codeId;
  const [rows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND (LOWER(a.name) LIKE '%vat%' OR LOWER(a.name) LIKE '%tax%')
       AND (LOWER(a.name) LIKE '%input%' OR LOWER(a.name) LIKE '%recoverable%' OR LOWER(a.name) LIKE '%claim%')
     ORDER BY 
       CASE WHEN LOWER(a.name) LIKE '%vat%' THEN 0 ELSE 1 END,
       a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(rows?.[0]?.id || 0) || 0;
}
// Financial Configuration: Auto-resolve the Service Expense account ID
async function resolveServiceExpenseAccountIdAuto(conn, { companyId }) {
  const [preferRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
       AND (LOWER(a.name) LIKE '%service%' OR LOWER(a.name) LIKE '%professional%' OR LOWER(a.name) LIKE '%consult%')
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  const preferId = Number(preferRows?.[0]?.id || 0) || 0;
  if (preferId) return preferId;
  const [fallbackRows] = await conn.execute(
    `SELECT a.id
     FROM fin_accounts a
     JOIN fin_account_groups g ON g.id = a.group_id
     WHERE a.company_id = :companyId
       AND a.is_active = 1
       AND a.is_postable = 1
       AND g.nature = 'EXPENSE'
     ORDER BY a.code ASC
     LIMIT 1`,
    { companyId },
  );
  return Number(fallbackRows?.[0]?.id || 0) || 0;
}
// Financial Configuration: Auto-resolve the AP Trade account ID for a supplier
async function resolveApTradeAccountIdAuto(conn, { companyId, supplierId }) {
  if (supplierId) {
    const [supRows] = await conn.execute(
      "SELECT id, supplier_code, supplier_name, currency_id FROM pur_suppliers WHERE company_id = :companyId AND id = :id LIMIT 1",
      { companyId, id: supplierId },
    );
    const sup = supRows?.[0] || null;
    if (sup) {
      const code =
        sup.supplier_code && String(sup.supplier_code).trim()
          ? String(sup.supplier_code).trim()
          : `SU-${String(Number(sup.id || 0)).padStart(6, "0")}`;
      const [accRows] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE company_id = :companyId AND code = :code LIMIT 1",
        { companyId, code },
      );
      const accIdExisting = Number(accRows?.[0]?.id || 0) || 0;
      if (accIdExisting) return accIdExisting;
    }
  }
  const [apRows] = await conn.execute(
    `SELECT id
     FROM fin_accounts
     WHERE company_id = :companyId
       AND is_active = 1
       AND is_postable = 1
       AND code = '2001'
     LIMIT 1`,
    { companyId },
  );
  return Number(apRows?.[0]?.id || 0) || 0;
}
// Database Migration: Ensure supplier_type column exists on pur_suppliers
async function ensureSupplierTypeColumn() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (!(await hasColumn("pur_suppliers", "supplier_type"))) {
    await pool.query(
      "ALTER TABLE pur_suppliers ADD COLUMN supplier_type VARCHAR(10) NOT NULL DEFAULT 'LOCAL'",
    );
  }
}

// Database Migration: Ensure currency_id column exists on pur_suppliers
async function ensureSupplierCurrencyColumn() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (!(await hasColumn("pur_suppliers", "currency_id"))) {
    await pool.query(
      "ALTER TABLE pur_suppliers ADD COLUMN currency_id BIGINT UNSIGNED NULL",
    );
  }
}

// Database Migration: Ensure tables for service confirmations and details exist
async function ensureServiceConfirmationTables() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inv_service_confirmations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      sc_no VARCHAR(50) NOT NULL,
      sc_date DATE NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      status ENUM('DRAFT','CONFIRMED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(255) NULL,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sc_scope_no (company_id, branch_id, sc_no),
      KEY idx_sc_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("inv_service_confirmations", "order_id"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER sc_date",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "order_no"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN order_no VARCHAR(50) NULL AFTER order_id",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "execution_id"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN execution_id BIGINT UNSIGNED NULL AFTER order_id",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "service_time"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN service_time TIME NULL AFTER supplier_id",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "acceptance_1"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN acceptance_1 TINYINT(1) NOT NULL DEFAULT 0 AFTER service_time",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "acceptance_2"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN acceptance_2 TINYINT(1) NOT NULL DEFAULT 0 AFTER acceptance_1",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "acceptance_3"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN acceptance_3 TINYINT(1) NOT NULL DEFAULT 0 AFTER acceptance_2",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "acceptance_4"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN acceptance_4 TINYINT(1) NOT NULL DEFAULT 0 AFTER acceptance_3",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "acceptance_5"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN acceptance_5 TINYINT(1) NOT NULL DEFAULT 0 AFTER acceptance_4",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "satisfaction"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN satisfaction TINYINT UNSIGNED NULL AFTER acceptance_5",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "customer_feedback"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN customer_feedback TEXT NULL AFTER satisfaction",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "warranty_provided"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN warranty_provided TINYINT(1) NOT NULL DEFAULT 0 AFTER customer_feedback",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "follow_up_required"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN follow_up_required TINYINT(1) NOT NULL DEFAULT 0 AFTER warranty_provided",
    );
  }
  if (!(await hasColumn("inv_service_confirmations", "follow_up_notes"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmations ADD COLUMN follow_up_notes TEXT NULL AFTER follow_up_required",
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inv_service_confirmation_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      confirmation_id BIGINT UNSIGNED NOT NULL,
      description VARCHAR(255) NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      unit_price DECIMAL(18,2) NOT NULL,
      line_total DECIMAL(18,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_scd_confirmation (confirmation_id),
      CONSTRAINT fk_scd_confirmation FOREIGN KEY (confirmation_id) REFERENCES inv_service_confirmations(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("inv_service_confirmation_details", "is_confirmed"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmation_details ADD COLUMN is_confirmed TINYINT(1) NOT NULL DEFAULT 0 AFTER line_total",
    );
  }
  if (!(await hasColumn("inv_service_confirmation_details", "item_id"))) {
    await pool.query(
      "ALTER TABLE inv_service_confirmation_details ADD COLUMN item_id BIGINT UNSIGNED NULL AFTER confirmation_id",
    );
  }
}

// Utility Function: Generate the next sequential document number for a specific table
async function nextSequentialNo(table, column, prefix) {
  const rows = await query(`
    SELECT ${column} AS no,
          created_at,
          u.username AS created_by_name
         FROM ${table}
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE ${column} REGEXP '^${prefix}-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(${column}, ${prefix.length + 2}) AS UNSIGNED) DESC
    LIMIT 1
    `);
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].no || "");
    const numPart = prev.slice(prefix.length + 1);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `${prefix}-${String(nextNum).padStart(6, "0")}`;
}

/**
 * Retrieves a list of all service confirmations with their corresponding supplier details.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listServiceConfirmations = async (req, res, next) => {
  try {
    await ensureServiceConfirmationTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const rows = await query(
      `
      SELECT c.id,
             c.sc_no,
             COALESCE(c.order_no, so.order_no) AS order_no,
             c.sc_date,
             c.status,
             c.total_amount,
             s.supplier_name,
             c.created_at,
             u.username AS created_by_name
         FROM inv_service_confirmations c
      LEFT JOIN pur_suppliers s ON s.id = c.supplier_id
      LEFT JOIN adm_users u ON u.id = c.created_by
      LEFT JOIN pur_service_orders so ON so.id = c.order_id
         WHERE c.company_id = :companyId
        AND (:branchIdsStr = '' OR FIND_IN_SET(c.branch_id, :branchIdsStr))
      ORDER BY c.sc_date DESC, c.id DESC
      `,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves a specific service confirmation and its line-item details by ID.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getServiceConfirmationById = async (req, res, next) => {
  try {
    await ensureServiceConfirmationTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT c.*,
          c.created_at,
          u.username AS created_by_name
         FROM inv_service_confirmations c
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.id = :id AND c.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(c.branch_id, :branchIdsStr))
      LIMIT 1
      `,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Service confirmation not found");
    const details = await query(
      `
      SELECT d.id, d.item_id, d.description, d.qty, d.unit_price, d.line_total, d.is_confirmed,
          d.created_at,
          u.username AS created_by_name
         FROM inv_service_confirmation_details d
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.confirmation_id = :id
      ORDER BY d.id ASC
      `,
      { id },
    );
    res.json({ item: rows[0], details });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a new service confirmation document and its line items inside a database transaction.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createServiceConfirmation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceConfirmationTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    const scNo = body.sc_no || (await nextScNo(companyId, branchId));
    const scDate = body.sc_date;
    const supplierId = toNumber(body.supplier_id);
    const orderId = body.order_id ? Number(body.order_id) : null;
    const executionId = body.execution_id ? Number(body.execution_id) : null;
    const serviceTime = body.service_time || null;
    const status = body.status || "DRAFT";
    const remarks = body.remarks || null;
    const acceptance1 = body.acceptance_1 ? 1 : 0;
    const acceptance2 = body.acceptance_2 ? 1 : 0;
    const acceptance3 = body.acceptance_3 ? 1 : 0;
    const acceptance4 = body.acceptance_4 ? 1 : 0;
    const acceptance5 = body.acceptance_5 ? 1 : 0;
    const satisfaction =
      body.satisfaction == null || body.satisfaction === ""
        ? null
        : Number(body.satisfaction);
    const customerFeedback = body.customer_feedback || null;
    const warrantyProvided = body.warranty_provided ? 1 : 0;
    const followUpRequired = body.follow_up_required ? 1 : 0;
    const followUpNotes = body.follow_up_notes || null;
    const createdBy = req.user?.sub ? Number(req.user.sub) : null;
    const details = Array.isArray(body.details) ? body.details : [];
    let orderNo = body.order_no || null;
    if (orderId && !orderNo) {
      const [orderRows] = await pool.execute(
        `SELECT order_no FROM pur_service_orders WHERE id = :orderId`,
        { orderId }
      );
      if (orderRows.length) orderNo = orderRows[0].order_no;
    }
    if (!scDate || !supplierId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "sc_date and supplier_id are required",
      );
    }
    let totalAmount = 0;
    const normalizedDetails = [];
    for (const d of details) {
      const description = String(d.description || "").trim();
      const qty = Number(d.qty);
      const unitPrice = Number(d.unit_price);
      if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
        continue;
      const lineTotal = Number.isFinite(Number(d.line_total))
        ? Number(d.line_total)
        : qty * unitPrice;
      const isConfirmed = d.is_confirmed ? 1 : 0;
      totalAmount += lineTotal;
      normalizedDetails.push({
        itemId: d.item_id ? Number(d.item_id) : null,
        description,
        qty,
        unitPrice,
        lineTotal,
        isConfirmed,
      });
    }
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `
      INSERT INTO inv_service_confirmations
        (
          company_id, branch_id, sc_no, sc_date, order_id, order_no, execution_id,
          supplier_id, service_time, acceptance_1, acceptance_2, acceptance_3,
          acceptance_4, acceptance_5, satisfaction, customer_feedback,
          warranty_provided, follow_up_required, follow_up_notes,
          total_amount, status, remarks, created_by
        )
      VALUES
        (
          :companyId, :branchId, :scNo, :scDate, :orderId, :orderNo, :executionId,
          :supplierId, :serviceTime, :acceptance1, :acceptance2, :acceptance3,
          :acceptance4, :acceptance5, :satisfaction, :customerFeedback,
          :warrantyProvided, :followUpRequired, :followUpNotes,
          :totalAmount, :status, :remarks, :createdBy
        )
      `,
      {
        companyId,
        branchId, branchIdsStr,
        scNo,
        scDate,
        orderId,
        orderNo,
        executionId,
        supplierId,
        serviceTime,
        acceptance1,
        acceptance2,
        acceptance3,
        acceptance4,
        acceptance5,
        satisfaction,
        customerFeedback,
        warrantyProvided,
        followUpRequired,
        followUpNotes,
        totalAmount,
        status,
        remarks,
        createdBy,
      },
    );
    const confirmationId = hdr.insertId;
    for (const nd of normalizedDetails) {
      await conn.execute(
        `
        INSERT INTO inv_service_confirmation_details
          (confirmation_id, item_id, description, qty, unit_price, line_total, is_confirmed)
        VALUES
          (:confirmationId, :itemId, :description, :qty, :unitPrice, :lineTotal, :isConfirmed)
        `,
        {
          confirmationId,
          itemId: nd.itemId,
          description: nd.description,
          qty: nd.qty,
          unitPrice: nd.unitPrice,
          lineTotal: nd.lineTotal,
          isConfirmed: nd.isConfirmed,
        },
      );
    }
    if (orderId) {
      await conn.execute(
        `UPDATE pur_service_orders SET status = 'DONE' WHERE id = :orderId`,
        { orderId }
      );
    }
    await conn.commit();
    res
      .status(201)
      .json({ id: confirmationId, sc_no: scNo, total_amount: totalAmount });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

async function ensureShippingAdviceStatusEnum() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const rows = await query(`SELECT column_type, column_default
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
       AND table_name = 'pur_shipping_advices'
       AND column_name = 'status'`);
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasDesired =
    colType.includes("'DRAFT'") &&
    colType.includes("'IN_TRANSIT'") &&
    colType.includes("'ARRIVED'") &&
    colType.includes("'CANCELLED'") &&
    colType.includes("'CLEARED'");
  if (!hasDesired) {
    await pool.query(
      "ALTER TABLE pur_shipping_advices MODIFY COLUMN status ENUM('DRAFT','IN_TRANSIT','ARRIVED','CANCELLED','CLEARED') NOT NULL DEFAULT 'IN_TRANSIT'",
    );
  } else {
    const defVal = String(rows?.[0]?.column_default || "").toUpperCase();
    if (defVal !== "IN_TRANSIT" && defVal !== "'IN_TRANSIT'") {
      await pool.query(
        "ALTER TABLE pur_shipping_advices MODIFY COLUMN status ENUM('DRAFT','IN_TRANSIT','ARRIVED','CANCELLED','CLEARED') NOT NULL DEFAULT 'IN_TRANSIT'",
      );
    }
  }
}

async function ensureShippingAdviceETDColumn() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const hasEtd = await hasColumn("pur_shipping_advices", "etd_date");
  if (!hasEtd) {
    try {
      await pool.query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN etd_date DATE NULL AFTER container_no",
      );
    } catch {}
  }
}

async function ensureShippingAdviceCreatedByColumn() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const hasCreatedBy = await hasColumn("pur_shipping_advices", "created_by");
  if (!hasCreatedBy) {
    try {
      await pool.query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN created_by INT NULL",
      );
    } catch {}
  }
}

async function ensurePortClearanceStatusEnum() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  const rows = await query(`SELECT column_type, column_default
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
       AND table_name = 'pur_port_clearances'
       AND column_name = 'status'`);
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasPending = colType.includes("'PENDING'");
  const hasInProgress = colType.includes("'IN_PROGRESS'");
  const hasCleared = colType.includes("'CLEARED'");
  const hasCancelled = colType.includes("'CANCELLED'");
  const desired = "ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT')";
  const hasDesired = hasPending && hasInProgress && hasCleared && hasCancelled;
  if (!hasDesired || !colType.includes("'DRAFT'")) {
    await pool.query(
      "ALTER TABLE pur_port_clearances MODIFY COLUMN status ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT') NOT NULL DEFAULT 'PENDING'",
    );
  } else {
    const defVal = String(rows?.[0]?.column_default || "").toUpperCase();
    if (defVal !== "PENDING" && defVal !== "'PENDING'") {
      await pool.query(
        "ALTER TABLE pur_port_clearances MODIFY COLUMN status ENUM('PENDING','IN_PROGRESS','CLEARED','CANCELLED','DRAFT') NOT NULL DEFAULT 'PENDING'",
      );
    }
  }
}

/**
 * Computes the next sequential supplier code based on existing suppliers and financial accounts.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getNextSupplierCode = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const [supRows] = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(supplier_code, 4) AS UNSIGNED)) AS maxnum,
          created_at,
          u.username AS created_by_name
         FROM pur_suppliers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND supplier_code REGEXP '^SU-[0-9]{6}$'`,
      { companyId },
    );
    const [accRows] = await pool.query(
      `SELECT MAX(CAST(SUBSTRING(code, 4) AS UNSIGNED)) AS maxnum,
          created_at,
          u.username AS created_by_name
         FROM fin_accounts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND code REGEXP '^SU-[0-9]{6}$'`,
      { companyId },
    );
    const maxnum = Math.max(
      Number(supRows?.[0]?.maxnum || 0),
      Number(accRows?.[0]?.maxnum || 0),
    );
    const nextNum = maxnum + 1;
    const code = `SU-${String(nextNum).padStart(6, "0")}`;
    res.json({ code });
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches all shipping advices, optionally filtered by status and PO type.
 * Includes a check for associated port clearances.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listShippingAdvices = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { status, po_type } = req.query;
    if (!(await hasColumn("pur_shipping_advices", "is_active"))) {
      await query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
      ).catch(() => {});
    }
    if (!(await hasColumn("pur_shipping_advices", "deleted_at"))) {
      await query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN deleted_at DATETIME NULL",
      ).catch(() => {});
    }
    if (!(await hasColumn("pur_shipping_advices", "created_by"))) {
      await query(
        "ALTER TABLE pur_shipping_advices ADD COLUMN created_by INT NULL",
      ).catch(() => {});
    }
    let sql = `SELECT sa.*, s.supplier_name, p.po_no, p.po_type,
         u.username AS created_by_name,
         EXISTS(
           SELECT 1 FROM pur_port_clearances pc
            WHERE pc.company_id = sa.company_id 
              AND pc.branch_id = sa.branch_id
              AND pc.advice_id = sa.id
            LIMIT 1
         ) AS has_clearing
         FROM pur_shipping_advices sa
         JOIN pur_suppliers s ON s.id = sa.supplier_id
         JOIN pur_orders p ON p.id = sa.po_id
         LEFT JOIN adm_users u ON u.id = sa.created_by
         WHERE sa.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(sa.branch_id, :branchIdsStr))
           AND COALESCE(sa.is_active,'Y') = 'Y'`;
    if (status) sql += ` AND sa.status = :status`;
    if (po_type) sql += ` AND p.po_type = :po_type`;
    sql += ` ORDER BY sa.advice_date DESC, sa.id DESC`;
    const rows = await query(sql, { companyId, branchId, branchIdsStr, status, po_type });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Generates the next sequential shipping advice document number.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getNextShippingAdviceNo = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const rows = await query(
      `SELECT MAX(CAST(SUBSTRING(advice_no, 4) AS UNSIGNED)) AS maxnum,
          created_at,
          u.username AS created_by_name
         FROM pur_shipping_advices
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND advice_no REGEXP '^SA-[0-9]{6}$'`,
      { companyId, branchId, branchIdsStr },
    );
    const maxnum = Number(rows?.[0]?.maxnum || 0);
    const next = maxnum + 1;
    const nextNo = `SA-${String(next).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves a specific shipping advice and its details by ID.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getShippingAdviceById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `SELECT sa.*, s.supplier_name, p.po_no,
          sa.created_at,
          u.username AS created_by_name
         FROM pur_shipping_advices sa
       JOIN pur_suppliers s ON s.id = sa.supplier_id
       JOIN pur_orders p ON p.id = sa.po_id
        LEFT JOIN adm_users u ON u.id = sa.created_by
         WHERE sa.id = :id AND sa.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(sa.branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Shipping Advice not found");
    const details = await query(
      `SELECT d.*, i.item_name, i.item_code,
          d.created_at,
          u.username AS created_by_name
         FROM pur_shipping_advice_details d 
       JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.advice_id = :id`,
      { id },
    );
    res.json({ item: { ...rows[0], details } });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a new shipping advice along with its line items within a transaction.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createShippingAdvice = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    await ensureShippingAdviceStatusEnum();
    await ensureShippingAdviceETDColumn();
    await ensureShippingAdviceCreatedByColumn();
    const adviceNo = body.advice_no || nextDocNo("SA");
    const adviceDate = body.advice_date || new Date();
    const poId = toNumber(body.po_id);
    const supplierId = toNumber(body.supplier_id);
    if (!poId || !supplierId)
      throw httpError(400, "VALIDATION_ERROR", "PO and Supplier are required");
    const details = Array.isArray(body.details) ? body.details : [];
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `INSERT INTO pur_shipping_advices 
       (company_id, branch_id, advice_no, advice_date, po_id, supplier_id, 
        bill_of_lading, vessel_name, container_no, etd_date, eta_date, status, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :adviceNo, :adviceDate, :poId, :supplierId,
        :bl, :vessel, :container, :etd, :eta, :status, :remarks, :createdBy)`,
      {
        companyId,
        branchId, branchIdsStr,
        adviceNo,
        adviceDate,
        poId,
        supplierId,
        bl: body.bill_of_lading ?? null,
        vessel: body.vessel_name ?? null,
        container: body.container_no ?? null,
        etd: body.etd_date ?? null,
        eta: body.eta_date ?? null,
        status: body.status || "IN_TRANSIT",
        remarks: body.remarks ?? null,
        createdBy: (req.user && (req.user.sub ?? req.user.id)) ?? null,
      },
    );
    const adviceId = hdr.insertId;
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      const qty = Number(d.qty_shipped);
      if (!itemId || !qty) continue;
      await conn.execute(
        `INSERT INTO pur_shipping_advice_details (advice_id, item_id, qty_shipped, remarks)
         VALUES (:adviceId, :itemId, :qty, :remarks)`,
        { adviceId, itemId, qty, remarks: d.remarks || null },
      );
    }
    await conn.commit();
    res.status(201).json({ id: adviceId, advice_no: adviceNo });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Updates an existing shipping advice and replaces all its associated line items.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const updateShippingAdvice = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const adviceDate = body.advice_date || new Date();
    const poId = toNumber(body.po_id);
    const supplierId = toNumber(body.supplier_id);
    if (!poId || !supplierId)
      throw httpError(400, "VALIDATION_ERROR", "PO and Supplier are required");
    await ensureShippingAdviceStatusEnum();
    await ensureShippingAdviceETDColumn();
    await conn.beginTransaction();
    const [exists] = await conn.execute(
      `SELECT id FROM pur_shipping_advices 
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!Array.isArray(exists) || !exists.length) {
      throw httpError(404, "NOT_FOUND", "Shipping Advice not found");
    }
    await conn.execute(
      `UPDATE pur_shipping_advices SET
         advice_date = :adviceDate,
         po_id = :poId,
         supplier_id = :supplierId,
         bill_of_lading = :bl,
         vessel_name = :vessel,
         container_no = :container,
         etd_date = :etd,
         eta_date = :eta,
         status = :status,
         remarks = :remarks
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        adviceDate,
        poId,
        supplierId,
        bl: body.bill_of_lading ?? null,
        vessel: body.vessel_name ?? null,
        container: body.container_no ?? null,
        etd: body.etd_date ?? null,
        eta: body.eta_date ?? null,
        status: body.status || "IN_TRANSIT",
        remarks: body.remarks ?? null,
      },
    );
    await conn.execute(
      `DELETE FROM pur_shipping_advice_details WHERE advice_id = :id`,
      { id },
    );
    const details = Array.isArray(body.details) ? body.details : [];
    for (const d of details) {
      const itemId = toNumber(d.item_id);
      const qty = Number(d.qty_shipped);
      if (!itemId || !qty) continue;
      await conn.execute(
        `INSERT INTO pur_shipping_advice_details (advice_id, item_id, qty_shipped, remarks)
         VALUES (:adviceId, :itemId, :qty, :remarks)`,
        { adviceId: id, itemId, qty, remarks: d.remarks || null },
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Retrieves a list of port clearances.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listPortClearances = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const { status } = req.query;
    if (!(await hasColumn("pur_port_clearances", "is_active"))) {
      await query(
        "ALTER TABLE pur_port_clearances ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
      ).catch(() => {});
    }
    if (!(await hasColumn("pur_port_clearances", "deleted_at"))) {
      await query(
        "ALTER TABLE pur_port_clearances ADD COLUMN deleted_at DATETIME NULL",
      ).catch(() => {});
    }
    let sql = `SELECT pc.*, sa.advice_no, p.po_no, s.supplier_name,
         EXISTS(
           SELECT 1 FROM inv_goods_receipt_notes g
            WHERE g.company_id = pc.company_id
              AND g.branch_id = pc.branch_id
              AND g.port_clearance_id = pc.id
            LIMIT 1
         ) AS has_grn
         FROM pur_port_clearances pc
         LEFT JOIN pur_shipping_advices sa ON sa.id = pc.advice_id
         LEFT JOIN pur_orders p ON p.id = sa.po_id
         LEFT JOIN pur_suppliers s ON s.id = sa.supplier_id
         WHERE pc.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pc.branch_id, :branchIdsStr))
           AND COALESCE(pc.is_active,'Y') = 'Y'`;
    if (status) sql += ` AND pc.status = :status`;
    sql += ` ORDER BY pc.clearance_date DESC, pc.id DESC`;
    const rows = await query(sql, { companyId, branchId, branchIdsStr, status });
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getNextPortClearanceNo = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const rows = await query(
      `SELECT MAX(CAST(SUBSTRING(clearance_no, 4) AS UNSIGNED)) AS maxnum,
          created_at,
          u.username AS created_by_name
         FROM pur_port_clearances
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
         AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         AND clearance_no REGEXP '^CC-[0-9]{6}$'`,
      { companyId, branchId, branchIdsStr },
    );
    const maxnum = Number(rows?.[0]?.maxnum || 0);
    const next = maxnum + 1;
    const nextNo = `CC-${String(next).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const getPortClearanceById = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `SELECT pc.*, sa.advice_no,
          pc.created_at,
          u.username AS created_by_name
         FROM pur_port_clearances pc
       LEFT JOIN pur_shipping_advices sa ON sa.id = pc.advice_id
        LEFT JOIN adm_users u ON u.id = pc.created_by
         WHERE pc.id = :id AND pc.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(pc.branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Port Clearance not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createPortClearance = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    await ensurePortClearanceStatusEnum();
    let clearanceNo = body.clearance_no || null;
    const cd1 = body.clearance_date;
    const clearanceDate = cd1
      ? typeof cd1 === "string"
        ? cd1.split("T")[0]
        : new Date(cd1).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const adviceId = toNumber(body.advice_id ?? body.shipping_advice_id);
    if (!clearanceNo) {
      const [rows] = await conn.query(
        `SELECT MAX(CAST(SUBSTRING(clearance_no, 4) AS UNSIGNED)) AS maxnum,
          created_at,
          u.username AS created_by_name
         FROM pur_port_clearances
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = ? AND branch_id = ?
           AND clearance_no REGEXP '^CC-[0-9]{6}$'`,
        [companyId, branchId],
      );
      const maxnum = Number(rows?.[0]?.maxnum || 0);
      const next = maxnum + 1;
      clearanceNo = `CC-${String(next).padStart(6, "0")}`;
    }
    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `INSERT INTO pur_port_clearances 
       (company_id, branch_id, clearance_no, clearance_date, advice_id, 
        customs_entry_no, clearing_agent, duty_amount, other_charges, status, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :clearanceNo, :clearanceDate, :adviceId,
        :customsEntry, :agent, :duty, :other, :status, :remarks, :createdBy)`,
      {
        companyId,
        branchId, branchIdsStr,
        clearanceNo,
        clearanceDate,
        adviceId: adviceId || null,
        customsEntry:
          body.customs_entry_no ?? body.customs_declaration_number ?? null,
        agent: body.clearing_agent ?? null,
        duty: Number(body.duty_amount) || 0,
        other: Number(body.other_charges) || 0,
        status: body.status || "PENDING",
        remarks: body.remarks ?? null,
        createdBy: (req.user && (req.user.sub ?? req.user.id)) ?? null,
      },
    );
    const clearanceId = hdr.insertId;
    await conn.commit();
    res.status(201).json({ id: clearanceId, clearance_no: clearanceNo });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

export const updatePortClearance = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    await ensurePortClearanceStatusEnum();
    await ensureShippingAdviceStatusEnum();
    const adviceId = toNumber(body.advice_id ?? body.shipping_advice_id);
    const [exists] = await conn.execute(
      `SELECT id FROM pur_port_clearances 
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!Array.isArray(exists) || !exists.length) {
      throw httpError(404, "NOT_FOUND", "Port Clearance not found");
    }
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE pur_port_clearances SET
         clearance_date = :clearanceDate,
         advice_id = :adviceId,
         customs_entry_no = :customsEntry,
         clearing_agent = :agent,
         duty_amount = :duty,
         other_charges = :other,
         status = :status,
         remarks = :remarks
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        clearanceDate: (() => {
          const cd2 = body.clearance_date;
          return cd2
            ? typeof cd2 === "string"
              ? cd2.split("T")[0]
              : new Date(cd2).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10);
        })(),
        adviceId: adviceId || null,
        customsEntry:
          body.customs_entry_no ?? body.customs_declaration_number ?? null,
        agent: body.clearing_agent ?? null,
        duty: Number(body.duty_amount) || 0,
        other: Number(body.other_charges) || 0,
        status: body.status || "PENDING",
        remarks: body.remarks ?? null,
      },
    );
    if (String(body.status).toUpperCase() === "CLEARED" && adviceId) {
      await conn.execute(
        `UPDATE pur_shipping_advices 
           SET status = 'CLEARED' 
         WHERE id = :adviceId AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { adviceId, companyId, branchId, branchIdsStr },
      );
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};
export const updateServiceConfirmation = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceConfirmationTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const scDate = body.sc_date;
    const supplierId = toNumber(body.supplier_id);
    const orderId = body.order_id ? Number(body.order_id) : null;
    const executionId = body.execution_id ? Number(body.execution_id) : null;
    const serviceTime = body.service_time || null;
    const status = body.status || "DRAFT";
    const remarks = body.remarks || null;
    const acceptance1 = body.acceptance_1 ? 1 : 0;
    const acceptance2 = body.acceptance_2 ? 1 : 0;
    const acceptance3 = body.acceptance_3 ? 1 : 0;
    const acceptance4 = body.acceptance_4 ? 1 : 0;
    const acceptance5 = body.acceptance_5 ? 1 : 0;
    const satisfaction =
      body.satisfaction == null || body.satisfaction === ""
        ? null
        : Number(body.satisfaction);
    const customerFeedback = body.customer_feedback || null;
    const warrantyProvided = body.warranty_provided ? 1 : 0;
    const followUpRequired = body.follow_up_required ? 1 : 0;
    const followUpNotes = body.follow_up_notes || null;
    const details = Array.isArray(body.details) ? body.details : [];
    let orderNo = body.order_no || null;
    if (orderId && !orderNo) {
      const [orderRows] = await pool.execute(
        `SELECT order_no FROM pur_service_orders WHERE id = :orderId`,
        { orderId }
      );
      if (orderRows.length) orderNo = orderRows[0].order_no;
    }
    if (!scDate || !supplierId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "sc_date and supplier_id are required",
      );
    }
    let totalAmount = 0;
    const normalizedDetails = [];
    for (const d of details) {
      const description = String(d.description || "").trim();
      const qty = Number(d.qty);
      const unitPrice = Number(d.unit_price);
      if (!description || !Number.isFinite(qty) || !Number.isFinite(unitPrice))
        continue;
      const lineTotal = Number.isFinite(Number(d.line_total))
        ? Number(d.line_total)
        : qty * unitPrice;
      const isConfirmed = d.is_confirmed ? 1 : 0;
      totalAmount += lineTotal;
      normalizedDetails.push({
        itemId: d.item_id ? Number(d.item_id) : null,
        description,
        qty,
        unitPrice,
        lineTotal,
        isConfirmed,
      });
    }
    await conn.beginTransaction();
    const [upd] = await conn.execute(
      `
      UPDATE inv_service_confirmations
      SET sc_date = :scDate,
          supplier_id = :supplierId,
          order_id = :orderId,
          order_no = :orderNo,
          execution_id = :executionId,
          service_time = :serviceTime,
          acceptance_1 = :acceptance1,
          acceptance_2 = :acceptance2,
          acceptance_3 = :acceptance3,
          acceptance_4 = :acceptance4,
          acceptance_5 = :acceptance5,
          satisfaction = :satisfaction,
          customer_feedback = :customerFeedback,
          warranty_provided = :warrantyProvided,
          follow_up_required = :followUpRequired,
          follow_up_notes = :followUpNotes,
          total_amount = :totalAmount,
          status = :status,
          remarks = :remarks
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        scDate,
        supplierId,
        orderId,
        orderNo,
        executionId,
        serviceTime,
        acceptance1,
        acceptance2,
        acceptance3,
        acceptance4,
        acceptance5,
        satisfaction,
        customerFeedback,
        warrantyProvided,
        followUpRequired,
        followUpNotes,
        totalAmount,
        status,
        remarks,
      },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Service confirmation not found");
    await conn.execute(
      `DELETE FROM inv_service_confirmation_details WHERE confirmation_id = :id`,
      { id },
    );
    for (const nd of normalizedDetails) {
      await conn.execute(
        `
        INSERT INTO inv_service_confirmation_details
          (confirmation_id, item_id, description, qty, unit_price, line_total, is_confirmed)
        VALUES
          (:id, :itemId, :description, :qty, :unitPrice, :lineTotal, :isConfirmed)
        `,
        {
          id,
          itemId: nd.itemId,
          description: nd.description,
          qty: nd.qty,
          unitPrice: nd.unitPrice,
          lineTotal: nd.lineTotal,
          isConfirmed: nd.isConfirmed,
        },
      );
    }
    await conn.commit();
    res.json({ ok: true, total_amount: totalAmount });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

async function ensureServiceRequestTables() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_requests (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      request_no VARCHAR(50) NOT NULL,
      request_date DATE NOT NULL,
      requester_full_name VARCHAR(100) NOT NULL,
      requester_email VARCHAR(150) NOT NULL,
      requester_phone VARCHAR(50) NOT NULL,
      requester_company VARCHAR(150) NULL,
      requester_address VARCHAR(255) NULL,
      service_type VARCHAR(50) NOT NULL,
      department VARCHAR(50) NULL,
      request_title VARCHAR(150) NOT NULL,
      description TEXT NOT NULL,
      priority ENUM('low','medium','high') NOT NULL DEFAULT 'low',
      preferred_date DATE NULL,
      preferred_time VARCHAR(30) NULL,
      contact_method ENUM('email','phone','sms') NOT NULL DEFAULT 'email',
      recurring ENUM('yes','no') NOT NULL DEFAULT 'no',
      additional_notes TEXT NULL,
      agreed_terms TINYINT(1) NOT NULL DEFAULT 0,
      attachments_json JSON NULL,
      status ENUM('PENDING','IN_PROGRESS','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING',
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sr_scope_no (company_id, branch_id, request_no),
      KEY idx_sr_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function ensureServiceBillTables() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_bills (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NULL,
      bill_no VARCHAR(50) NOT NULL,
      bill_date DATE NOT NULL,
      due_date DATE NULL,
      service_date DATE NULL,
      status ENUM('PENDING','PAID','OVERDUE') NOT NULL DEFAULT 'PENDING',
      payment VARCHAR(30) NOT NULL DEFAULT 'UNPAID',
      client_name VARCHAR(150) NULL,
      client_company VARCHAR(150) NULL,
      client_address VARCHAR(255) NULL,
      client_phone VARCHAR(50) NULL,
      client_email VARCHAR(150) NULL,
      payment_method VARCHAR(30) NULL,
      payment_reference VARCHAR(100) NULL,
      payment_terms TEXT NULL,
      notes TEXT NULL,
      discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      tax_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
      subtotal DECIMAL(18,2) NOT NULL DEFAULT 0,
      discount_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_sb_scope_no (company_id, branch_id, bill_no),
      KEY idx_sb_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pur_service_bills", "payment"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN payment VARCHAR(30) NOT NULL DEFAULT 'UNPAID' AFTER status",
    );
  }
  // Rename payment -> payment_status
  try {
    const [colChk] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pur_service_bills' AND column_name='payment'",
    );
    const [colChk2] = await pool.query(
      "SELECT COUNT(*) AS cnt FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pur_service_bills' AND column_name='payment_status'",
    );
    if (colChk?.[0]?.cnt && !colChk2?.[0]?.cnt) {
      await pool.query("ALTER TABLE pur_service_bills CHANGE COLUMN payment payment_status VARCHAR(30) NOT NULL DEFAULT 'UNPAID'");
    }
  } catch {}
  if (!(await hasColumn("pur_service_bills", "amount_paid"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN amount_paid DECIMAL(18,2) DEFAULT 0 AFTER total_amount",
    );
  }
  if (!(await hasColumn("pur_service_bills", "supplier_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN supplier_id BIGINT UNSIGNED NULL AFTER branch_id",
    );
  }
  if (!(await hasColumn("pur_service_bills", "currency_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN currency_id BIGINT UNSIGNED NULL AFTER total_amount",
    );
  }
  if (!(await hasColumn("pur_service_bills", "exchange_rate"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1 AFTER currency_id",
    );
  }
  if (!(await hasColumn("pur_service_bills", "freight_charges"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN freight_charges DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER exchange_rate",
    );
  }
  if (!(await hasColumn("pur_service_bills", "other_charges"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN other_charges DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER freight_charges",
    );
  }
  if (!(await hasColumn("pur_service_bills", "order_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bills ADD COLUMN order_id BIGINT UNSIGNED NULL AFTER supplier_id",
    );
  }
  try {
    await pool.query(`
      UPDATE pur_service_bills sb
      JOIN pur_suppliers s
        ON s.company_id = sb.company_id
       AND s.branch_id = sb.branch_id
       AND s.supplier_name = sb.client_name
      SET sb.supplier_id = s.id
      WHERE sb.supplier_id IS NULL AND sb.client_name IS NOT NULL
      `);
  } catch {}
  const rows = await query(`SELECT column_type
         FROM information_schema.columns
         WHERE table_schema = DATABASE()
       AND table_name = 'pur_service_bills'
       AND column_name = 'status'`);
  const colType = String(rows?.[0]?.column_type || "").toUpperCase();
  const hasPosted = colType.includes("'POSTED'");
  if (!hasPosted) {
    await pool.query(
      "ALTER TABLE pur_service_bills MODIFY COLUMN status ENUM('PENDING','COMPLETED','OVERDUE','PAID','POSTED') NOT NULL DEFAULT 'PENDING'",
    );
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pur_service_bill_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      bill_id BIGINT UNSIGNED NOT NULL,
      description VARCHAR(255) NOT NULL,
      category VARCHAR(50) NULL,
      qty DECIMAL(18,3) NOT NULL,
      rate DECIMAL(18,2) NOT NULL,
      amount DECIMAL(18,2) NOT NULL,
      PRIMARY KEY (id),
      KEY idx_sbd_bill (bill_id),
      CONSTRAINT fk_sbd_bill FOREIGN KEY (bill_id) REFERENCES pur_service_bills(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("pur_service_bill_details", "item_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN item_id BIGINT UNSIGNED NULL AFTER bill_id",
    );
  }
  if (!(await hasColumn("pur_service_bill_details", "uom_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN uom_id BIGINT UNSIGNED NULL AFTER category",
    );
  }
  if (!(await hasColumn("pur_service_bill_details", "discount_percent"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER amount",
    );
  }
  if (!(await hasColumn("pur_service_bill_details", "tax_code_id"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN tax_code_id BIGINT UNSIGNED NULL AFTER discount_percent",
    );
  }
  if (!(await hasColumn("pur_service_bill_details", "tax_amount"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER tax_code_id",
    );
  }
  if (!(await hasColumn("pur_service_bill_details", "line_total"))) {
    await pool.query(
      "ALTER TABLE pur_service_bill_details ADD COLUMN line_total DECIMAL(18,2) NOT NULL DEFAULT 0 AFTER tax_amount",
    );
  }
}

async function ensureProspectCustomersTable() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sal_prospect_customers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      prospect_customer VARCHAR(200) NULL,
      customer_name VARCHAR(255) NULL,
      address VARCHAR(255) NULL,
      city VARCHAR(100) NULL,
      state VARCHAR(100) NULL,
      country VARCHAR(100) NULL,
      telephone VARCHAR(50) NULL,
      phone VARCHAR(100) NULL,
      email VARCHAR(150) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_prospect_scope (company_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  // Also ensure prospect_customer is nullable if it was created as NOT NULL
  try {
    await pool.query(
      "ALTER TABLE sal_prospect_customers MODIFY COLUMN prospect_customer VARCHAR(200) NULL",
    );
  } catch (e) {}
}

export const listServiceRequests = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const rows = await query(
      `
      SELECT r.id, r.request_no, r.request_date, r.requester_full_name, r.service_type, r.priority, r.status,
             u.username AS forwarded_to_username,
             r.created_at,
             uc.username AS created_by_username
      FROM pur_service_requests r
      LEFT JOIN (
        SELECT t.document_id, t.assigned_to_user_id
        FROM adm_document_workflows t
        JOIN (
          SELECT document_id, MAX(id) AS max_id
          FROM adm_document_workflows
          WHERE company_id = :companyId
            AND status = 'PENDING'
            AND (document_type = 'SERVICE_REQUEST' OR document_type = 'Service Request')
          GROUP BY document_id
        ) m ON m.max_id = t.id
      ) x ON x.document_id = r.id
      LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
      LEFT JOIN adm_users uc ON uc.id = r.created_by
      WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
      ORDER BY r.request_date DESC, r.id DESC
      `,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getServiceRequestById = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT *,
          created_at,
          u.username AS created_by_name
         FROM pur_service_requests
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      LIMIT 1
      `,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Service request not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const getNextServiceRequestNo = async (req, res, next) => {
  try {
    await ensureServiceRequestTables();
    const nextNo = await nextSequentialNo(
      "pur_service_requests",
      "request_no",
      "SR",
    );
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const createServiceRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceRequestTables();
    await ensureProspectCustomersTable();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    const requestNo =
      body.request_no ||
      (await nextSequentialNo("pur_service_requests", "request_no", "SR"));
    const requestDate =
      body.request_date || new Date().toISOString().slice(0, 10);
    const fullName = String(body.full_name || body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const company = body.company || null;
    const address = body.address || null;
    const serviceType = String(
      body.service_type || body.serviceType || "",
    ).trim();
    const department = body.department || null;
    const requestTitle = String(
      body.request_title || body.requestTitle || "",
    ).trim();
    const description = String(body.description || "").trim();
    const priority = ["low", "medium", "high"].includes(
      String(body.priority || "").toLowerCase(),
    )
      ? String(body.priority).toLowerCase()
      : "low";
    const preferredDate = body.preferred_date || body.preferredDate || null;
    const preferredTime = body.preferred_time || body.preferredTime || null;
    const contactMethod = ["email", "phone", "sms"].includes(
      String(body.contact_method || body.contactMethod || "").toLowerCase(),
    )
      ? String(body.contact_method || body.contactMethod).toLowerCase()
      : "email";
    const recurring = ["yes", "no"].includes(
      String(body.recurring || "").toLowerCase(),
    )
      ? String(body.recurring).toLowerCase()
      : "no";
    const additionalNotes =
      body.additional_notes || body.additionalNotes || null;
    const agreedTerms = Boolean(body.terms || body.agreed_terms);
    const attachmentsJson =
      body.attachments_json ||
      (Array.isArray(body.attachments)
        ? JSON.stringify(body.attachments)
        : null);
    const createdBy = req.user?.sub ? Number(req.user.sub) : null;

    if (
      (body.customer_type !== "existing" && (!fullName || !email || !phone)) ||
      !serviceType ||
      !requestTitle ||
      !description
    ) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const [hdr] = await conn.execute(
      `
      INSERT INTO pur_service_requests (
        company_id, branch_id, request_no, request_date,
        requester_full_name, requester_email, requester_phone,
        requester_company, requester_address,
        service_type, department, request_title, description,
        priority, preferred_date, preferred_time,
        contact_method, recurring, additional_notes,
        agreed_terms, attachments_json, status, created_by
      ) VALUES (
        :companyId, :branchId, :requestNo, :requestDate,
        :fullName, :email, :phone,
        :company, :address,
        :serviceType, :department, :requestTitle, :description,
        :priority, :preferredDate, :preferredTime,
        :contactMethod, :recurring, :additionalNotes,
        :agreedTerms, :attachmentsJson, 'PENDING', :createdBy
      )
      `,
      {
        companyId,
        branchId, branchIdsStr,
        requestNo,
        requestDate,
        fullName,
        email,
        phone,
        company,
        address,
        serviceType,
        department,
        requestTitle,
        description,
        priority,
        preferredDate,
        preferredTime,
        contactMethod,
        recurring,
        additionalNotes,
        agreedTerms,
        attachmentsJson,
        createdBy,
      },
    );
    const prospect = body.prospect || {};
    const pName = String(prospect.prospect_customer || "").trim();
    if (pName) {
      await conn.execute(
        `
        INSERT INTO sal_prospect_customers (
          company_id, prospect_customer, customer_name, address, city, state, country, telephone, phone, email
        ) VALUES (
          :companyId, :prospect_customer, :customer_name, :address, :city, :state, :country, :telephone, :phone, :email
        )
        ON DUPLICATE KEY UPDATE
          customer_name = VALUES(customer_name),
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          country = VALUES(country),
          telephone = VALUES(telephone),
          phone = VALUES(phone),
          email = VALUES(email)
        `,
        {
          companyId,
          prospect_customer: pName,
          customer_name: pName,
          address: prospect.address || null,
          city: prospect.city || null,
          state: prospect.state || null,
          country: prospect.country || null,
          telephone: prospect.telephone || null,
          phone: prospect.telephone || null,
          email: prospect.email || null,
        },
      );
    }
    res.status(201).json({ id: hdr.insertId, request_no: requestNo });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
};

export const updateServiceRequest = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceRequestTables();
    await ensureProspectCustomersTable();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const fullName = String(body.full_name || body.fullName || "").trim();
    const email = String(body.email || "").trim();
    const phone = String(body.phone || "").trim();
    const company = body.company || null;
    const address = body.address || null;
    const serviceType = String(
      body.service_type || body.serviceType || "",
    ).trim();
    const department = body.department || null;
    const requestTitle = String(
      body.request_title || body.requestTitle || "",
    ).trim();
    const description = String(body.description || "").trim();
    const priority = ["low", "medium", "high"].includes(
      String(body.priority || "").toLowerCase(),
    )
      ? String(body.priority).toLowerCase()
      : "low";
    const preferredDate = body.preferred_date || body.preferredDate || null;
    const preferredTime = body.preferred_time || body.preferredTime || null;
    const contactMethod = ["email", "phone", "sms"].includes(
      String(body.contact_method || body.contactMethod || "").toLowerCase(),
    )
      ? String(body.contact_method || body.contactMethod).toLowerCase()
      : "email";
    const recurring = ["yes", "no"].includes(
      String(body.recurring || "").toLowerCase(),
    )
      ? String(body.recurring).toLowerCase()
      : "no";
    const additionalNotes =
      body.additional_notes || body.additionalNotes || null;
    const agreedTerms = Boolean(body.terms || body.agreed_terms);
    const attachmentsJson =
      body.attachments_json ||
      (Array.isArray(body.attachments)
        ? JSON.stringify(body.attachments)
        : null);

    if (
      (body.customer_type !== "existing" && (!fullName || !email || !phone)) ||
      !serviceType ||
      !requestTitle ||
      !description
    ) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const [exists] = await conn.execute(
      `
      SELECT id FROM pur_service_requests
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      LIMIT 1
      `,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!exists.length)
      throw httpError(404, "NOT_FOUND", "Service request not found");

    await conn.execute(
      `
      UPDATE pur_service_requests SET
        requester_full_name = :fullName,
        requester_email = :email,
        requester_phone = :phone,
        requester_company = :company,
        requester_address = :address,
        service_type = :serviceType,
        department = :department,
        request_title = :requestTitle,
        description = :description,
        priority = :priority,
        preferred_date = :preferredDate,
        preferred_time = :preferredTime,
        contact_method = :contactMethod,
        recurring = :recurring,
        additional_notes = :additionalNotes,
        agreed_terms = :agreedTerms,
        attachments_json = :attachmentsJson
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        fullName,
        email,
        phone,
        company,
        address,
        serviceType,
        department,
        requestTitle,
        description,
        priority,
        preferredDate,
        preferredTime,
        contactMethod,
        recurring,
        additionalNotes,
        agreedTerms,
        attachmentsJson,
      },
    );

    const prospect = body.prospect || {};
    const pName = String(prospect.prospect_customer || "").trim();
    if (pName) {
      await conn.execute(
        `
        INSERT INTO sal_prospect_customers (
          company_id, prospect_customer, customer_name, address, city, state, country, telephone, phone, email
        ) VALUES (
          :companyId, :prospect_customer, :customer_name, :address, :city, :state, :country, :telephone, :phone, :email
        )
        ON DUPLICATE KEY UPDATE
          customer_name = VALUES(customer_name),
          address = VALUES(address),
          city = VALUES(city),
          state = VALUES(state),
          country = VALUES(country),
          telephone = VALUES(telephone),
          phone = VALUES(phone),
          email = VALUES(email)
        `,
        {
          companyId,
          prospect_customer: pName,
          customer_name: pName,
          address: prospect.address || null,
          city: prospect.city || null,
          state: prospect.state || null,
          country: prospect.country || null,
          telephone: prospect.telephone || null,
          phone: prospect.telephone || null,
          email: prospect.email || null,
        },
      );
    }
    res.json({ id });
  } catch (err) {
    next(err);
  } finally {
    conn.release();
  }
};
export const listServiceBills = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const status = String(req.query.status || "")
      .trim()
      .toUpperCase();
    const clientName = String(req.query.clientName || "").trim();
    const payment = String(req.query.payment || "")
      .trim()
      .toUpperCase();
    const supplierId = toNumber(req.query.supplierId);
    let sql = `
      SELECT b.id, b.bill_no, b.bill_date, b.status, b.payment_status, b.total_amount, b.amount_paid,
             b.client_name, b.supplier_id, s.supplier_name,
             b.created_by, (SELECT username FROM adm_users WHERE id = b.created_by) AS created_by_username, b.created_at
      FROM pur_service_bills b
      LEFT JOIN pur_suppliers s ON s.id = b.supplier_id AND s.company_id = b.company_id
      WHERE b.company_id = :companyId
    `;
    const params = { companyId };
    
    if (branchIdsStr) {
      sql += " AND FIND_IN_SET(b.branch_id, :branchIdsStr)";
      params.branchIdsStr = branchIdsStr;
    } else if (branchId) {
      sql += " AND b.branch_id = :branchId";
      params.branchId = branchId;
    }
    if (status) {
      sql += " AND b.status = :status";
      params.status = status;
    }
    if (clientName) {
      sql += " AND (b.client_name LIKE :clientName OR s.supplier_name LIKE :clientName)";
      params.clientName = `%${clientName}%`;
    }
    if (payment) {
      sql += " AND b.payment_status = :payment";
      params.payment = payment;
    }
    if (supplierId) {
      sql += " AND b.supplier_id = :supplierId";
      params.supplierId = supplierId;
    }
    sql += " ORDER BY b.bill_date DESC, b.id DESC";
    const rows = await query(sql, params);
    const idsToComplete = rows
      .filter(
        (r) =>
          String(r.payment_status || "").toUpperCase() === "PAID" &&
          String(r.status || "").toUpperCase() === "PENDING",
      )
      .map((r) => Number(r.id));
    if (idsToComplete.length) {
      const placeholders = idsToComplete.map(() => "?").join(",");
      await pool.query(
        `UPDATE pur_service_bills SET status = 'COMPLETED' WHERE id IN (${placeholders})`,
        idsToComplete,
      );
      for (const r of rows) {
        if (
          String(r.payment_status || "").toUpperCase() === "PAID" &&
          String(r.status || "").toUpperCase() === "PENDING"
        ) {
          r.status = "COMPLETED";
        }
      }
    }
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getServiceBillById = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(
      `
      SELECT *,
          created_at,
          (SELECT username FROM adm_users WHERE id = created_by) AS created_by_name
         FROM pur_service_bills
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      LIMIT 1
      `,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Service bill not found");
    const row = rows[0];
    const isPaid = String(row.payment_status || "").toUpperCase() === "PAID";
    const isPending = String(row.status || "").toUpperCase() === "PENDING";
    if (isPaid && isPending) {
      await pool.query(
        "UPDATE pur_service_bills SET status = 'COMPLETED' WHERE id = ?",
        [id],
      );
      row.status = "COMPLETED";
    }
    const details = await query(
      `
      SELECT id, item_id, description, category, uom_id, qty, rate, amount,
          discount_percent, tax_code_id, tax_amount, line_total
         FROM pur_service_bill_details
         WHERE bill_id = :id
      ORDER BY id ASC
      `,
      { id },
    );
    res.json({ item: row, details });
  } catch (err) {
    next(err);
  }
};

export const getNextServiceBillNo = async (req, res, next) => {
  try {
    await ensureServiceBillTables();
    const nextNo = await nextSequentialNo("pur_service_bills", "bill_no", "SVB");
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
};

export const createServiceBill = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceBillTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    const supplierId = body.supplier_id || body.supplierId || null;
    const billNo =
      body.bill_no ||
      (await nextSequentialNo("pur_service_bills", "bill_no", "SVB"));
    const billDate = body.bill_date || new Date().toISOString().slice(0, 10);
    const dueDate = body.due_date || null;
    const serviceDate = body.service_date || null;
    const status = "POSTED";
    const sStatus = "POSTED";
    const clientName = body.client_name || body.clientName || null;
    const clientCompany = body.client_company || body.clientCompany || null;
    const clientAddress = body.client_address || body.clientAddress || null;
    const clientPhone = body.client_phone || body.clientPhone || null;
    const clientEmail = body.client_email || body.clientEmail || null;
    const paymentMethod = body.payment_method || body.paymentMethod || null;
    const paymentReference =
      body.payment_reference || body.paymentReference || null;
    const paymentTerms = body.payment_terms || body.paymentTerms || null;
    const notes = body.notes || null;
    const currencyId = body.currency_id ? Number(body.currency_id) : null;
    const exchangeRate = Number(body.exchange_rate) || 1;
    const freightCharges = Number(body.freight_charges) || 0;
    const otherCharges = Number(body.other_charges) || 0;
    const costCenterId = body.cost_center_id ? Number(body.cost_center_id) : null;
    const rows = Array.isArray(body.details)
      ? body.details
      : Array.isArray(body.rows)
        ? body.rows
        : [];

    let subtotal = 0;
    const normalized = [];
    for (const r of rows) {
      const desc = String(r.description ?? r.desc ?? "").trim();
      const category = r.category ?? null;
      const qty = Number(r.qty ?? 0);
      const rate = Number(r.rate ?? 0);
      if (!desc || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      const amount = Number.isFinite(Number(r.amount))
        ? Number(r.amount)
        : qty * rate;
      const itemId = r.item_id ? Number(r.item_id) : null;
      const uomId = r.uom_id ? Number(r.uom_id) : null;
      const discountPercent = Number(r.discount_percent) || 0;
      const taxCodeId = r.tax_code_id ? Number(r.tax_code_id) : null;
      const taxAmount = Number(r.tax_amount) || 0;
      const lineTotal = Number(r.line_total) || amount;
      subtotal += amount;
      normalized.push({ desc, category, qty, rate, amount, itemId, uomId, discountPercent, taxCodeId, taxAmount, lineTotal });
    }

    const subtotalFromBody = Number(body.subtotal) || subtotal;
    const discountAmount = Number(body.discount_amount) || 0;
    const taxAmount = Number(body.tax_amount) || 0;
    const totalAmount = Number(body.total_amount) || (subtotalFromBody - discountAmount + taxAmount + freightCharges + otherCharges);

    const createdBy = req.user?.sub ? Number(req.user.sub) : null;
    const paymentInput = String(body.payment_status || body.payment || "")
      .trim()
      .toUpperCase();
    const paymentStatus =
      paymentInput === "PAID"
        ? "PAID"
        : paymentInput === "UNPAID"
          ? "UNPAID"
          : sStatus === "PAID"
            ? "PAID"
            : "UNPAID";

    await conn.beginTransaction();
    const [hdr] = await conn.execute(
      `
      INSERT INTO pur_service_bills (
        company_id, branch_id, supplier_id, order_id, bill_no, bill_date, due_date, service_date, status, payment_status,
        client_name, client_company, client_address, client_phone, client_email,
        payment_method, payment_reference, payment_terms, notes,
        discount_percent, tax_percent, subtotal, discount_amount, tax_amount, total_amount,
        currency_id, exchange_rate, freight_charges, other_charges,
        created_by, cost_center_id
      ) VALUES (
        :companyId, :branchId, :supplierId, :orderId, :billNo, :billDate, :dueDate, :serviceDate, :status, :paymentStatus,
        :clientName, :clientCompany, :clientAddress, :clientPhone, :clientEmail,
        :paymentMethod, :paymentReference, :paymentTerms, :notes,
        :discountPercent, :taxPercent, :subtotal, :discountAmount, :taxAmount, :totalAmount,
        :currencyId, :exchangeRate, :freightCharges, :otherCharges,
        :createdBy, :costCenterId
      )
      `,
      {
        companyId,
        branchId, branchIdsStr,
        supplierId,
        orderId: body.order_id ? Number(body.order_id) : null,
        billNo,
        billDate,
        dueDate,
        serviceDate,
        status: sStatus,
        paymentStatus,
        clientName,
        clientCompany,
        clientAddress,
        clientPhone,
        clientEmail,
        paymentMethod,
        paymentReference,
        paymentTerms,
        notes,
        discountPercent: 0,
        taxPercent: 0,
        subtotal: subtotalFromBody,
        discountAmount,
        taxAmount,
        totalAmount,
        currencyId,
        exchangeRate,
        freightCharges,
        otherCharges,
        createdBy,
        costCenterId,
      },
    );
    const billId = hdr.insertId;
    for (const r of normalized) {
      await conn.execute(
        `
        INSERT INTO pur_service_bill_details (
          bill_id, item_id, description, category, uom_id, qty, rate, amount, discount_percent, tax_code_id, tax_amount, line_total
        ) VALUES (
          :billId, :itemId, :description, :category, :uomId, :qty, :rate, :amount, :discountPercent, :taxCodeId, :taxAmount, :lineTotal
        )
        `,
        {
          billId,
          itemId: r.itemId,
          description: r.desc,
          category: r.category,
          uomId: r.uomId,
          qty: r.qty,
          rate: r.rate,
          amount: r.amount,
          discountPercent: r.discountPercent,
          taxCodeId: r.taxCodeId,
          taxAmount: r.taxAmount,
          lineTotal: r.lineTotal,
        },
      );
    }
    const fiscalYearId = await resolveOpenFiscalYearId(conn, { companyId });
    const voucherTypeId = await ensurePurchaseVoucherTypeIdTx(conn, {
      companyId,
    });
    const voucherNo = await nextVoucherNoTx(conn, {
      companyId,
      voucherTypeId,
    });
    const voucherDate = billDate || toYmd(new Date());
    const serviceExpenseAccId = await resolveServiceExpenseAccountIdAuto(conn, {
      companyId,
    });
    const vatInputAccId =
      taxAmount > 0
        ? await resolveVatInputAccountIdAuto(conn, { companyId })
        : 0;
    const apAccId = await resolveApTradeAccountIdAuto(conn, {
      companyId,
      supplierId: toNumber(supplierId),
    });
    if (!serviceExpenseAccId || !apAccId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Expense or AP account not configured",
      );
    }
    const totalDebit =
      Math.round((subtotalFromBody - discountAmount) * 100) / 100 +
      (taxAmount > 0 ? Math.round(taxAmount * 100) / 100 : 0) +
      Math.round(freightCharges * 100) / 100 +
      Math.round(otherCharges * 100) / 100;
    const totalCredit = Math.round(totalAmount * 100) / 100;
    const [vIns] = await conn.execute(
      `INSERT INTO fin_vouchers
        (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, balanced_amount, status, created_by, approved_by, posted_by)
       VALUES
        (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, :currencyId, :exchangeRate, :totalDebit, :totalCredit, :ba, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
      {
        companyId,
        branchId, branchIdsStr,
        fiscalYearId,
        voucherTypeId,
        voucherNo,
        voucherDate,
        narration: `Purchase Voucher for Service Bill ${billNo}`,
        currencyId,
        exchangeRate,
        totalDebit,
        totalCredit,
        ba: totalDebit,
        createdBy,
        approvedBy: createdBy,
        postedBy: createdBy,
      },
    );
    const voucherId = Number(vIns?.insertId || 0) || 0;
    let lineNo = 1;
    const serviceDebit = Math.round((subtotalFromBody - discountAmount) * 100) / 100;
    await conn.execute(
      `INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
      {
        companyId,
        voucherId,
        lineNo: lineNo++,
        accountId: serviceExpenseAccId,
        description: `Service expense on ${billNo}`,
        debit: serviceDebit,
        referenceNo: billNo,
      },
    );
    if (taxAmount > 0 && vatInputAccId) {
      await conn.execute(
        `INSERT INTO fin_voucher_lines
          (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
         VALUES
          (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, 0, NULL, NULL, :referenceNo)`,
        {
          companyId,
          voucherId,
          lineNo: lineNo++,
          accountId: vatInputAccId,
          description: `VAT input on ${billNo}`,
          debit: Math.round(taxAmount * 100) / 100,
          referenceNo: billNo,
        },
      );
    }
    await conn.execute(
      `INSERT INTO fin_voucher_lines
        (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
       VALUES
        (:companyId, :voucherId, :lineNo, :accountId, :description, 0, :credit, NULL, NULL, :referenceNo)`,
      {
        companyId,
        voucherId,
        lineNo: lineNo++,
        accountId: apAccId,
        description: `AP for ${billNo}`,
        credit: Math.round(totalAmount * 100) / 100,
        referenceNo: billNo,
      },
    );
    await conn.commit();
    res.status(201).json({
      id: billId,
      bill_no: billNo,
      subtotal: subtotalFromBody,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

export const updateServiceBill = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await ensureServiceBillTables();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const supplierId = body.supplier_id || body.supplierId || null;
    const billNo = body.bill_no || null;
    const billDate = body.bill_date || null;
    const dueDate = body.due_date || null;
    const serviceDate = body.service_date || null;
    const status = String(body.status || "PENDING").toUpperCase();
    const sStatus = ["PENDING", "PAID", "OVERDUE", "COMPLETED", "CANCELLED", "REVERSED"].includes(status)
      ? status
      : "PENDING";
      
    if (sStatus === "CANCELLED") {
      const uRows = await query(
        `SELECT 1 FROM adm_exceptional_permissions WHERE user_id = :uid AND effect = 'ALLOW' AND is_active = 1 AND permission_code = 'SERVICE.BILL.CANCEL' LIMIT 1`,
        { uid: req.user?.id }
      );
      if (!uRows || uRows.length === 0) {
        throw httpError(403, "FORBIDDEN", "You do not have exceptional permission to cancel service bills");
      }
    }

    const clientName = body.client_name || body.clientName || null;
    const clientCompany = body.client_company || body.clientCompany || null;
    const clientAddress = body.client_address || body.clientAddress || null;
    const clientPhone = body.client_phone || body.clientPhone || null;
    const clientEmail = body.client_email || body.clientEmail || null;
    const paymentMethod = body.payment_method || body.paymentMethod || null;
    const paymentReference =
      body.payment_reference || body.paymentReference || null;
    const paymentTerms = body.payment_terms || body.paymentTerms || null;
    const notes = body.notes || null;
    const currencyId = body.currency_id ? Number(body.currency_id) : null;
    const exchangeRate = Number(body.exchange_rate) || 1;
    const freightCharges = Number(body.freight_charges) || 0;
    const otherCharges = Number(body.other_charges) || 0;
    const costCenterId = body.cost_center_id ? Number(body.cost_center_id) : null;
    const rows = Array.isArray(body.details)
      ? body.details
      : Array.isArray(body.rows)
        ? body.rows
        : [];
    let subtotal = 0;
    const normalized = [];
    for (const r of rows) {
      const desc = String(r.description ?? r.desc ?? "").trim();
      const category = r.category ?? null;
      const qty = Number(r.qty ?? 0);
      const rate = Number(r.rate ?? 0);
      if (!desc || !Number.isFinite(qty) || !Number.isFinite(rate)) continue;
      const amount = Number.isFinite(Number(r.amount))
        ? Number(r.amount)
        : qty * rate;
      const itemId = r.item_id ? Number(r.item_id) : null;
      const uomId = r.uom_id ? Number(r.uom_id) : null;
      const discountPercent = Number(r.discount_percent) || 0;
      const taxCodeId = r.tax_code_id ? Number(r.tax_code_id) : null;
      const taxAmount = Number(r.tax_amount) || 0;
      const lineTotal = Number(r.line_total) || amount;
      subtotal += amount;
      normalized.push({ desc, category, qty, rate, amount, itemId, uomId, discountPercent, taxCodeId, taxAmount, lineTotal });
    }
    const subtotalFromBody = Number(body.subtotal) || subtotal;
    const discountAmount = Number(body.discount_amount) || 0;
    const taxAmount = Number(body.tax_amount) || 0;
    const totalAmount = Number(body.total_amount) || (subtotalFromBody - discountAmount + taxAmount + freightCharges + otherCharges);
    const paymentInput = String(body.payment_status || body.payment || "")
      .trim()
      .toUpperCase();
    const paymentStatus =
      paymentInput === "PAID"
        ? "PAID"
        : paymentInput === "UNPAID"
          ? "UNPAID"
          : sStatus === "PAID"
            ? "PAID"
            : "UNPAID";
    await conn.beginTransaction();
    const [exists] = await conn.execute(
      `
      SELECT id, bill_no
      FROM pur_service_bills
      WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      LIMIT 1
      `,
      { id, companyId, branchId, branchIdsStr },
    );
    if (!(exists && exists.length)) {
      throw httpError(404, "NOT_FOUND", "Service bill not found");
    }
    await conn.execute(
      `
      UPDATE pur_service_bills
         SET ${billNo ? "bill_no = :billNo," : ""}
             bill_date = :billDate,
             due_date = :dueDate,
             service_date = :serviceDate,
             supplier_id = :supplierId,
             order_id = :orderId,
             status = :status,
             payment_status = :paymentStatus,
             client_name = :clientName,
             client_company = :clientCompany,
             client_address = :clientAddress,
             client_phone = :clientPhone,
             client_email = :clientEmail,
             payment_method = :paymentMethod,
             payment_reference = :paymentReference,
             payment_terms = :paymentTerms,
             notes = :notes,
             discount_percent = :discountPercent,
             tax_percent = :taxPercent,
             subtotal = :subtotal,
             discount_amount = :discountAmount,
             tax_amount = :taxAmount,
             total_amount = :totalAmount,
             currency_id = :currencyId,
             exchange_rate = :exchangeRate,
             freight_charges = :freightCharges,
             other_charges = :otherCharges,
             cost_center_id = :costCenterId
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
      `,
      {
        id,
        companyId,
        branchId, branchIdsStr,
        billNo,
        billDate,
        dueDate,
        serviceDate,
        supplierId,
        orderId: body.order_id ? Number(body.order_id) : null,
        status: sStatus,
        paymentStatus,
        clientName,
        clientCompany,
        clientAddress,
        clientPhone,
        clientEmail,
        paymentMethod,
        paymentReference,
        paymentTerms,
        notes,
        discountPercent: 0,
        taxPercent: 0,
        subtotal: subtotalFromBody,
        discountAmount,
        taxAmount,
        totalAmount,
        currencyId,
        exchangeRate,
        freightCharges,
        otherCharges,
        costCenterId,
      },
    );
    await conn.execute(
      "DELETE FROM pur_service_bill_details WHERE bill_id = :id",
      { id },
    );
    for (const r of normalized) {
      await conn.execute(
        `
        INSERT INTO pur_service_bill_details (
          bill_id, item_id, description, category, uom_id, qty, rate, amount, discount_percent, tax_code_id, tax_amount, line_total
        ) VALUES (
          :billId, :itemId, :description, :category, :uomId, :qty, :rate, :amount, :discountPercent, :taxCodeId, :taxAmount, :lineTotal
        )
        `,
        {
          billId: id,
          itemId: r.itemId,
          description: r.desc,
          category: r.category,
          uomId: r.uomId,
          qty: r.qty,
          rate: r.rate,
          amount: r.amount,
          discountPercent: r.discountPercent,
          taxCodeId: r.taxCodeId,
          taxAmount: r.taxAmount,
          lineTotal: r.lineTotal,
        },
      );
    }
    
    if (sStatus === "CANCELLED" || sStatus === "REVERSED") {
      const bNo = billNo || exists[0]?.bill_no;
      if (bNo) {
        const [vRows] = await conn.execute(
          `SELECT DISTINCT v.id AS voucher_id
             FROM fin_vouchers v
             JOIN fin_voucher_lines l ON l.voucher_id = v.id
            WHERE v.company_id = :companyId
              AND l.reference_no = :referenceNo`,
          { companyId, referenceNo: bNo }
        ).catch(() => [[]]);
        const voucherIds = vRows.map((r) => Number(r.voucher_id)).filter((n) => Number.isFinite(n) && n > 0);
        if (voucherIds.length > 0) {
          const inList = voucherIds.join(",");
          await conn.execute(`DELETE FROM fin_voucher_lines WHERE voucher_id IN (${inList})`).catch(() => null);
          await conn.execute(`DELETE FROM fin_vouchers WHERE id IN (${inList})`).catch(() => null);
        }
      }
    }

    await conn.commit();
    res.json({
      id,
      bill_no: billNo || exists[0]?.bill_no,
      subtotal: subtotalFromBody,
      discount_amount: discountAmount,
      tax_amount: taxAmount,
      total_amount: totalAmount,
    });
  } catch (err) {
    try {
      await conn.rollback();
    } catch {}
    next(err);
  } finally {
    conn.release();
  }
};

