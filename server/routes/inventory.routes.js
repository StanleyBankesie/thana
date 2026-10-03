/**
 * @fileoverview Inventory routes.
 * Defines API endpoints for managing inventory, including items, warehouses,
 * stock balances, GRNs, transfers, adjustments, and settings.
 */
import express from "express";
import { cacheListResponse } from "../middleware/cache.middleware.js";
import * as XLSX from "xlsx";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  getInactiveWorkflowBehavior,
  resolveWorkflowSelection,
} from "../utils/workflowResolution.js";
import {
  recordMovementTx,
  consumeStockFIFOTx,
  reserveStockTx,
  moveReservedStockTx,
  ensureStockBalancesWarehouseInfrastructure,
} from "../services/stock.service.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import { sendExternalNotification } from "../utils/externalNotification.js";
import { 
  inv_getStockBalances, 
  inv_getStockLedger, 
  inv_getWarehouseStockSummary, 
  inv_getStockOverviewStats,
  inv_listStockJournals,
  inv_getStockJournalById,
  inv_getNextStockJournalNo,
  inv_createStockJournal,
  linkWarehouseBranch,
} from "../controllers/inventory.controller.js";
import { verifiedTables } from "../utils/dbUtils.js";

const router = express.Router();

// ─── Inv Stock Overview & Balances ────────────────────────────────────────────
router.get("/stock", requireAuth, inv_getStockBalances);
router.get("/stock/overview", requireAuth, inv_getStockOverviewStats);
router.get("/stock/summary", requireAuth, inv_getWarehouseStockSummary);
router.get("/stock/ledger/:itemId", requireAuth, inv_getStockLedger);

// ─── Inv Stock Journals (Issue / Receipt) ─────────────────────────────────────
router.get("/stock-journal", requireAuth, inv_listStockJournals);
router.get("/stock-journal/next-no", requireAuth, inv_getNextStockJournalNo);
router.get("/stock-journal/:id", requireAuth, inv_getStockJournalById);
router.post("/stock-journal", requireAuth, inv_createStockJournal);

function toNumber(v, fb = null) {
  if (v === null || v === undefined || v === "") return fb;
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}
function toDateOnly(s) {
  if (!s) return null;
  if (typeof s !== "string") return null;
  return String(s).slice(0, 10) || null;
}

async function userHasExceptionalAllow(userId, permissionCode = null) {
  const params = { uid: userId };
  if (permissionCode) params.code = permissionCode;
  const rows = await query(
    `
    SELECT 1
         FROM adm_exceptional_permissions
         WHERE user_id = :uid
       AND effect = 'ALLOW'
       AND is_active = 1
       ${permissionCode ? "AND permission_code = :code" : ""}
     LIMIT 1
    `,
    params,
  ).catch(() => []);
  return rows.length > 0;
}

async function resolveTransferScopeTx(
  conn,
  {
    companyId,
    transferType,
    fromBranchId,
    toBranchId,
    fromWarehouseId,
    toWarehouseId,
  },
) {
  const normalizedType = String(transferType || "")
    .trim()
    .toUpperCase();
  let resolvedFromBranchId = fromBranchId || null;
  let resolvedToBranchId = toBranchId || null;

  if (normalizedType === "INTER_WAREHOUSE") {
    if (!fromWarehouseId || !toWarehouseId) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "From warehouse and to warehouse are required",
      );
    }
    const [warehouseRows] = await conn.execute(
      `
      SELECT id, company_id, branch_id
      FROM inv_warehouses
      WHERE company_id = :companyId
        AND id IN (:fromWarehouseId, :toWarehouseId)
      `,
      { companyId, fromWarehouseId, toWarehouseId },
    );
    const fromWarehouse = (warehouseRows || []).find(
      (row) => Number(row.id) === Number(fromWarehouseId),
    );
    const toWarehouse = (warehouseRows || []).find(
      (row) => Number(row.id) === Number(toWarehouseId),
    );
    if (!fromWarehouse || !toWarehouse) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid transfer warehouse");
    }
    resolvedFromBranchId = Number(fromWarehouse.branch_id) || null;
    resolvedToBranchId = Number(toWarehouse.branch_id) || null;
  }

  return {
    transferType: normalizedType || null,
    fromBranchId: resolvedFromBranchId,
    toBranchId: resolvedToBranchId,
    fromWarehouseId: fromWarehouseId || null,
    toWarehouseId: toWarehouseId || null,
  };
}

async function hasTable(tableName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
    `,
    { tableName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
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

async function hasTrigger(triggerName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.triggers
    WHERE trigger_schema = DATABASE()
      AND trigger_name = :triggerName
    `,
    { triggerName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

export async function ensureWarehousesTable() {
  if (verifiedTables.has("inv_warehouses")) return;
  if (!(await hasTable("inv_warehouses"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_warehouses (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1,
        warehouse_code VARCHAR(50) NOT NULL,
        warehouse_name VARCHAR(150) NOT NULL,
        location VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_warehouse_scope_code (company_id, branch_id, warehouse_code),
        KEY idx_warehouse_scope (company_id, branch_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }
  await query(`ALTER TABLE inv_warehouses ADD COLUMN location VARCHAR(255) NULL`).catch(() => {});
  await query(`ALTER TABLE inv_warehouses ADD COLUMN branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1`).catch(() => {});
  await query(`ALTER TABLE inv_warehouses ADD COLUMN created_by BIGINT UNSIGNED NULL`).catch(() => {});
  await query(`ALTER TABLE inv_warehouses ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`).catch(() => {});
  await query(`ALTER TABLE inv_warehouses ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`).catch(() => {});

  // Backfill existing rows that have NULL created_at or created_by
  await query(`UPDATE inv_warehouses SET created_at = NOW() WHERE created_at IS NULL OR CAST(created_at AS CHAR) LIKE '0000%'`).catch(() => {});
  await query(`UPDATE inv_warehouses SET created_by = 1 WHERE created_by IS NULL OR created_by = 0`).catch(() => {});

  verifiedTables.add("inv_warehouses");
}

async function ensureStockBalanceDetailsInfrastructure() {
  // View now reads from inv_stock_balances directly (no separate details table)
  await query(`
    CREATE OR REPLACE VIEW v_active_stock_details AS
    SELECT
      sb.id,
      sb.company_id,
      sb.branch_id,
      sb.warehouse_id,
      sb.item_id,
      sb.batch_no,
      sb.serial_no,
      sb.expiry_date,
      sb.qty,
      sb.reserved_qty,
      sb.entry_date,
      sb.source_type,
      sb.source_id,
      COALESCE(
        sb.created_by,
        grn.created_by,
        st.created_by,
        sa.created_by,
        su.created_by,
        mr.created_by,
        itr.created_by
      ) AS created_by,
      i.item_code,
      i.item_name,
      i.uom,
      w.warehouse_name,
      COALESCE(
        sb.created_at,
        grn.created_at,
        st.created_at,
        sa.created_at,
        su.created_at,
        mr.created_at,
        itr.created_at,
        sb.entry_date
      ) AS created_at,
      COALESCE(u.username, u.full_name, 'System') AS created_by_name
         FROM inv_stock_balances sb
    JOIN inv_items i ON i.id = sb.item_id
    LEFT JOIN inv_warehouses w ON w.id = sb.warehouse_id
    LEFT JOIN inv_goods_receipt_notes grn
      ON sb.source_type = 'GRN' AND grn.id = sb.source_id
    LEFT JOIN inv_stock_transfers st
      ON sb.source_type = 'STOCK_TRANSFER' AND st.id = sb.source_id
    LEFT JOIN inv_stock_adjustments sa
      ON sb.source_type = 'STOCK_ADJUSTMENT' AND sa.id = sb.source_id
    LEFT JOIN inv_stock_updations su
      ON sb.source_type = 'STOCK_UPDATION' AND su.id = sb.source_id
    LEFT JOIN inv_material_requisitions mr
      ON sb.source_type = 'MATERIAL_REQUISITION' AND mr.id = sb.source_id
    LEFT JOIN inv_issue_to_requirement itr
      ON sb.source_type = 'ISSUE_TO_REQUIREMENT' AND itr.id = sb.source_id
    LEFT JOIN adm_users u
      ON u.id = COALESCE(
        sb.created_by,
        grn.created_by,
        st.created_by,
        sa.created_by,
        su.created_by,
        mr.created_by,
        itr.created_by
      )
         WHERE (sb.qty > 0 OR sb.reserved_qty > 0)
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_ledger (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      transaction_type VARCHAR(50) NOT NULL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      qty_change DECIMAL(18,3) NOT NULL,
      batch_no VARCHAR(100) DEFAULT NULL,
      serial_no VARCHAR(100) DEFAULT NULL,
      expiry_date DATE DEFAULT NULL,
      source_ref VARCHAR(100) DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      KEY idx_ledger_scope (company_id, branch_id),
      KEY idx_ledger_item (item_id),
      KEY idx_ledger_date (transaction_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function ensureGRNTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_goods_receipt_notes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      grn_no VARCHAR(50) NOT NULL,
      grn_date DATE NOT NULL,
      grn_type ENUM('LOCAL','IMPORT') NOT NULL DEFAULT 'LOCAL',
      warehouse_id BIGINT UNSIGNED NULL,
      supplier_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      auto_create_bill TINYINT(1) NOT NULL DEFAULT 0,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_grn_no (company_id, branch_id, grn_no),
      KEY idx_grn_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  if (!(await hasColumn("inv_goods_receipt_notes", "auto_create_bill"))) {
    await query(
      "ALTER TABLE inv_goods_receipt_notes ADD COLUMN auto_create_bill TINYINT(1) NOT NULL DEFAULT 0 AFTER status",
    ).catch(() => {});
  }
  await query(`
    CREATE TABLE IF NOT EXISTS inv_goods_receipt_note_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      grn_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_ordered DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_received DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_accepted DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_rejected DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      KEY idx_grnd_grn (grn_id),
      KEY idx_grnd_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

async function nextPurchaseBillNo(conn, companyId, branchId, billType = "LOCAL") {
  const prefix = String(billType || "").toUpperCase() === "IMPORT" ? "PBI" : "PBL";
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const [rows] = await conn.execute(
        `
        SELECT bill_no
        FROM pur_bills
        WHERE company_id = :companyId
          AND branch_id = :branchId
          AND bill_no LIKE :pattern
        ORDER BY CAST(SUBSTRING(bill_no, 4) AS UNSIGNED) DESC
        LIMIT 1 FOR UPDATE
        `,
        { companyId, branchId, pattern: `${prefix}%` },
      );
      const prev = String(rows?.[0]?.bill_no || "");
      const m = prev.match(/(\d+)$/);
      const nextNum = m ? Number(m[1]) + 1 : 1;
      return `${prefix}${String(nextNum).padStart(6, "0")}`;
    } catch (err) {
      if (attempt === 3) throw err;
      await new Promise(resolve => setTimeout(resolve, 50 * attempt));
    }
  }
}

async function createPurchaseBillFromGrnTx(
  conn,
  { companyId, branchId, grnId, poId, supplierId, grnDate, grnType, userId },
) {
  if (!poId) return null;
  const [existingRows] = await conn.execute(
    `SELECT id, bill_no
       FROM pur_bills
      WHERE company_id = :companyId
        AND branch_id = :branchId
        AND grn_id = :grnId
      LIMIT 1`,
    { companyId, branchId, grnId },
  );
  if (existingRows?.length) {
    return { id: Number(existingRows[0].id), bill_no: existingRows[0].bill_no };
  }

  const [poRows] = await conn.execute(
    `SELECT currency_id, exchange_rate, payment_terms,
            COALESCE(total_amount, 0) AS total_amount,
            COALESCE(discount_amount, 0) AS discount_amount,
            COALESCE(tax_amount, 0) AS tax_amount,
            COALESCE(freight_amount, 0) AS freight_amount,
            COALESCE(other_charges, 0) AS other_charges
       FROM pur_orders
      WHERE company_id = :companyId
        AND branch_id = :branchId
        AND id = :poId
      LIMIT 1`,
    { companyId, branchId, poId },
  );
  const po = poRows?.[0] || {};
  const [grnDtlRows] = await conn.execute(
    `SELECT item_id,
            COALESCE(qty_accepted, qty_received, 0) AS qty,
            COALESCE(unit_price, 0) AS unit_price,
            COALESCE(line_amount, 0) AS line_amount
       FROM inv_goods_receipt_note_details
      WHERE grn_id = :grnId`,
    { grnId },
  );
  const details = Array.isArray(grnDtlRows) ? grnDtlRows : [];
  const totalAmount = details.reduce(
    (sum, d) =>
      sum +
      Number(
        Number(d.line_amount || 0) > 0
          ? d.line_amount
          : Number(d.qty || 0) * Number(d.unit_price || 0),
      ),
    0,
  );
  const discountAmount = Number(po.discount_amount || 0);
  const taxAmount = Number(po.tax_amount || 0);
  const freightCharges = Number(po.freight_amount || 0);
  const otherCharges = Number(po.other_charges || 0);
  const netAmount =
    Math.round(
      (Number(totalAmount) -
        Number(discountAmount) +
        Number(taxAmount) +
        Number(freightCharges) +
        Number(otherCharges)) *
        100,
    ) / 100;

  const billType =
    String(grnType || "").toUpperCase() === "IMPORT" ? "IMPORT" : "LOCAL";
  
  let billHdr;
  let billNo;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      billNo = await nextPurchaseBillNo(conn, companyId, branchId, billType);
      const [res] = await conn.execute(
        `INSERT INTO pur_bills
          (company_id, branch_id, bill_no, bill_date, supplier_id, po_id, grn_id, bill_type,
           due_date, currency_id, exchange_rate, payment_terms,
           total_amount, discount_amount, tax_amount, freight_charges, other_charges, net_amount,
           status, created_by)
         VALUES
          (:companyId, :branchId, :billNo, :billDate, :supplierId, :poId, :grnId, :billType,
           NULL, :currencyId, :exchangeRate, :paymentTerms,
           :totalAmount, :discountAmount, :taxAmount, :freightCharges, :otherCharges, :netAmount,
           'POSTED', :createdBy)`,
        {
          companyId,
          branchId,
          billNo,
          billDate: toDateOnly(grnDate),
          supplierId: supplierId || null,
          poId,
          grnId,
          billType,
          currencyId: Number(po.currency_id || 0) || null,
          exchangeRate: Number(po.exchange_rate || 1) || 1,
          paymentTerms: Number(po.payment_terms || 0) || null,
          totalAmount,
          discountAmount,
          taxAmount,
          freightCharges,
          otherCharges,
          netAmount,
          createdBy: userId || null,
        },
      );
      billHdr = res;
      break;
    } catch (err) {
      if (err.code === "ER_DUP_ENTRY" && attempt < 5) {
        continue; // Retry
      }
      throw err;
    }
  }
  const billId = Number(billHdr.insertId || 0);
  for (const d of details) {
    await conn.execute(
      `INSERT INTO pur_bill_details
        (bill_id, item_id, uom_id, qty, unit_price, discount_percent, tax_amount, line_total)
       VALUES
        (:billId, :itemId, NULL, :qty, :unitPrice, 0, 0, :lineTotal)`,
      {
        billId,
        itemId: Number(d.item_id || 0) || null,
        qty: Number(d.qty || 0),
        unitPrice: Number(d.unit_price || 0),
        lineTotal:
          Number(d.line_amount || 0) > 0
            ? Number(d.line_amount || 0)
            : Number(d.qty || 0) * Number(d.unit_price || 0),
      },
    );
  }
  return { id: billId, bill_no: billNo };
}

async function nextGRNNo(companyId, branchId, type = "LOCAL") {
  const prefix = type === "IMPORT" ? "GI-" : "GL-";
  const rows = await query(
    `
    SELECT grn_no,
          created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_notes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND grn_no LIKE :pattern
    ORDER BY CAST(SUBSTRING(grn_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId, pattern: `${prefix}%` },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].grn_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

async function nextMaterialRequisitionNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT requisition_no,
          created_at,
          u.username AS created_by_name
         FROM inv_material_requisitions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND requisition_no LIKE 'MR-%'
    ORDER BY CAST(SUBSTRING(requisition_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  ).catch(() => []);
  let nextNum = 1;
  if (rows && rows.length) {
    const prev = String(rows[0].requisition_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `MR-${String(nextNum).padStart(6, "0")}`;
}

async function ensureReturnToStoresInfrastructure() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_return_to_stores (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      rts_no VARCHAR(50) NOT NULL,
      rts_date DATE NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      department_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_rts_no (company_id, branch_id, rts_no),
      KEY idx_rts_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS inv_return_to_stores_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      rts_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_returned DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20),
      reason VARCHAR(255),
      \`condition\` VARCHAR(20) DEFAULT 'GOOD',
      batch_serial VARCHAR(100),
      location VARCHAR(100),
      remarks VARCHAR(255),
      KEY idx_rtsd_rts (rts_id),
      KEY idx_rtsd_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS qty_returned DECIMAL(18,3) NOT NULL DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS reason VARCHAR(255)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS \`condition\` VARCHAR(20) DEFAULT 'GOOD'
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS batch_serial VARCHAR(100)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS location VARCHAR(100)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS remarks VARCHAR(255)
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS remaining_qty DECIMAL(18,3) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores_details ADD COLUMN IF NOT EXISTS qty_issued DECIMAL(18,3) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS issue_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS requisition_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_return_to_stores ADD COLUMN IF NOT EXISTS return_type VARCHAR(50) DEFAULT 'EXCESS'
  `).catch(() => {});
  await ensureReturnToStoresStockInTrigger();
}

async function ensureReturnToStoresStockInTrigger() {
  if (!(await hasTrigger("tr_rts_status_au_stock_in"))) {
    await query(`
      CREATE TRIGGER tr_rts_status_au_stock_in
      AFTER UPDATE ON inv_return_to_stores
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id, created_at, created_by)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, COALESCE(d.qty_returned, 0),
                 d.batch_serial, NULL, NULL, NOW(), 'RETURN_TO_STORES', NEW.id,
                 d.created_at, d.created_by
          FROM inv_return_to_stores_details d
          WHERE d.rts_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
}

async function nextReturnNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT rts_no,
          created_at,
          u.username AS created_by_name
         FROM inv_return_to_stores
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND rts_no LIKE 'RTS-%'
    ORDER BY CAST(SUBSTRING(rts_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].rts_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `RTS-${String(nextNum).padStart(6, "0")}`;
}

async function ensureStockTransferTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfers (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      transfer_no VARCHAR(50) NOT NULL,
      transfer_date DATE NOT NULL,
      from_branch_id BIGINT UNSIGNED NULL,
      to_branch_id BIGINT UNSIGNED NULL,
      from_warehouse_id BIGINT UNSIGNED NULL,
      to_warehouse_id BIGINT UNSIGNED NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_trans_no (company_id, branch_id, transfer_no),
      KEY idx_trans_scope (company_id, branch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  // Ensure additional columns for tracking and mapping
  await query(`
    ALTER TABLE inv_stock_transfers 
    ADD COLUMN IF NOT EXISTS received_date DATETIME NULL AFTER status,
    ADD COLUMN IF NOT EXISTS received_by BIGINT UNSIGNED NULL AFTER received_date,
    ADD COLUMN IF NOT EXISTS transfer_type VARCHAR(30) NULL AFTER received_by,
    ADD COLUMN IF NOT EXISTS branch_id BIGINT UNSIGNED NOT NULL DEFAULT 1 AFTER company_id,
    ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL
  `).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_transfer_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      transfer_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL,
      uom VARCHAR(20),
      batch_no VARCHAR(100) NULL,
      accepted_qty DECIMAL(18,3) NULL,
      rejected_qty DECIMAL(18,3) NULL,
      received_qty DECIMAL(18,3) NULL,
      acceptance_remarks TEXT NULL,
      KEY idx_std_transfer (transfer_id),
      KEY idx_std_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await query(`
    ALTER TABLE inv_stock_transfer_details 
    ADD COLUMN IF NOT EXISTS uom VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) NULL,
    ADD COLUMN IF NOT EXISTS accepted_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS rejected_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS received_qty DECIMAL(18,3) NULL,
    ADD COLUMN IF NOT EXISTS acceptance_remarks TEXT NULL
  `).catch(() => {});
}

async function applyTransferReceiptMovementsTx(
  conn,
  { companyId, branchId, transferId, createdBy = null },
) {
  // Use received_qty if set, otherwise fall back to accepted_qty, then original qty
  const [rows] = await conn.execute(
    `
    SELECT
      t.transfer_no,
      t.from_warehouse_id,
      t.to_warehouse_id,
      COALESCE(fw.branch_id, t.from_branch_id, t.branch_id) AS from_branch_id,
      COALESCE(tw.branch_id, t.to_branch_id, t.branch_id)   AS to_branch_id,
      d.item_id,
      COALESCE(d.received_qty, d.accepted_qty, d.qty, 0) AS effective_qty
    FROM inv_stock_transfers t
    JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
    LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
    LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
    WHERE t.id = :transferId
      AND t.company_id = :companyId
    ORDER BY d.id ASC
    `,
    { companyId, transferId },
  );

  for (const row of rows || []) {
    const qtyToMove = Number(row.effective_qty || 0);
    const itemId = Number(row.item_id || 0);
    const fromWarehouseId = Number(row.from_warehouse_id || 0) || null;
    const toWarehouseId = Number(row.to_warehouse_id || 0) || null;
    const toBranchId = Number(row.to_branch_id || 0) || branchId || null;

    if (!qtyToMove || !itemId || !fromWarehouseId || !toWarehouseId) continue;

    // Use the stock service moveReservedStockTx which handles graceful fallback
    await moveReservedStockTx(conn, {
      companyId,
      branchId: toBranchId,
      fromWarehouseId,
      toWarehouseId,
      itemId,
      qtyToMove,
      sourceRef: row.transfer_no || String(transferId),
      createdBy,
    });
  }
}

// UOMs
async function ensureUomTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_uom (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      uom_code VARCHAR(20) NOT NULL,
      uom_name VARCHAR(120) NOT NULL,
      uom_type VARCHAR(20) NOT NULL DEFAULT 'COUNT',
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_uom_code (uom_code)
    )
  `).catch(() => {});

  // Add uom_type column if it doesn't exist
  await query(`
    ALTER TABLE inv_uom
    ADD COLUMN IF NOT EXISTS uom_type VARCHAR(20) NOT NULL DEFAULT 'COUNT'
  `).catch(() => {});

  // Ensure default UOMs exist
  const defaultUOMs = [
    { uom_code: "PCS", uom_name: "Pieces" },
    { uom_code: "KG", uom_name: "Kilogram" },
    { uom_code: "L", uom_name: "Liter" },
    { uom_code: "M", uom_name: "Meter" },
    { uom_code: "BOX", uom_name: "Box" },
    { uom_code: "BAG", uom_name: "Bag" },
    { uom_code: "ROLL", uom_name: "Roll" },
    { uom_code: "PACK", uom_name: "Pack" },
  ];

  for (const uom of defaultUOMs) {
    await query(
      `INSERT IGNORE INTO inv_uom (uom_code, uom_name, is_active) VALUES (:uom_code, :uom_name, 1)`,
      { uom_code: uom.uom_code, uom_name: uom.uom_name },
    ).catch(() => {});
  }
}

router.get("/uoms", requireAuth, async (req, res, next) => {
  try {
    await ensureUomTable();
    const rows = await query(`
        SELECT id, uom_code, uom_name, uom_type, is_active,
          created_at,
          u.username AS created_by_name
         FROM inv_uom
        LEFT JOIN adm_users u ON u.id = created_by
        ORDER BY uom_name ASC, uom_code ASC
        `);
    res.json({ items: rows || [] });
  } catch (e) {
    next(e);
  }
});

router.post("/uoms", requireAuth, async (req, res, next) => {
  try {
    await ensureUomTable();
    const body = req.body || {};
    const uomCode = String(body.uom_code || "").trim();
    const uomName = String(body.uom_name || "").trim();
    const uomType = String(body.uom_type || "COUNT").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

    if (!uomCode || !uomName) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "uom_code and uom_name are required",
      );
    }

    const ins = await query(
      `INSERT INTO inv_uom (uom_code, uom_name, uom_type, is_active) VALUES (:uomCode, :uomName, :uomType, :isActive)`,
      { uomCode, uomName, uomType, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (e) {
    next(e);
  }
});

router.put("/uoms/:id", requireAuth, async (req, res, next) => {
  try {
    await ensureUomTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }

    const body = req.body || {};
    const uomCode = String(body.uom_code || "").trim();
    const uomName = String(body.uom_name || "").trim();
    const uomType = String(body.uom_type || "COUNT").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

    if (!uomCode || !uomName) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "uom_code and uom_name are required",
      );
    }

    const upd = await query(
      `UPDATE inv_uom SET uom_code = :uomCode, uom_name = :uomName, uom_type = :uomType, is_active = :isActive WHERE id = :id`,
      { id, uomCode, uomName, uomType, isActive },
    );

    if (!upd.affectedRows) {
      throw httpError(404, "NOT_FOUND", "UOM not found");
    }
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

router.delete("/uoms/:id", requireAuth, async (req, res, next) => {
  try {
    await ensureUomTable();
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }

    const del = await query(`DELETE FROM inv_uom WHERE id = :id`, { id });

    if (!del.affectedRows) {
      throw httpError(404, "NOT_FOUND", "UOM not found");
    }
    res.json({ ok: true });
  } catch (e) {
    if (e.code === "ER_ROW_IS_REFERENCED_2") {
      return next(
        httpError(
          400,
          "CONSTRAINT_ERROR",
          "Cannot delete UOM because it is in use.",
        ),
      );
    }
    next(e);
  }
});

async function ensureItemTypesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_types (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      type_code VARCHAR(50) NOT NULL,
      type_name VARCHAR(120) NOT NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_type_code (company_id, type_code)
    )
  `).catch(() => {});

  // Insert defaults if empty, though application layer can add it.
  const check = await query("SELECT 1 FROM inv_item_types LIMIT 1").catch(
    () => [],
  );
  if (!check?.length) {
    // Insert some defaults so the frontend isn't completely empty initially
    await query(
      `INSERT IGNORE INTO inv_item_types (company_id, type_code, type_name) VALUES (1, 'INVENTORY', 'Inventory Item')`,
    ).catch(() => {});
    await query(
      `INSERT IGNORE INTO inv_item_types (company_id, type_code, type_name) VALUES (1, 'NON_INVENTORY', 'Non-Inventory Item')`,
    ).catch(() => {});
    await query(
      `INSERT IGNORE INTO inv_item_types (company_id, type_code, type_name) VALUES (1, 'SERVICE', 'Service')`,
    ).catch(() => {});
  }
}

router.get(
  "/item-types",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemTypesTable();
      const { companyId = null } = req.scope || {};
      const rows = await query(
        `
      SELECT id, type_code, type_name, is_active,
          created_at,
          u.username AS created_by_name
         FROM inv_item_types
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND is_active = 1
      ORDER BY type_name ASC, type_code ASC, id ASC
      `,
        { companyId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/item-types",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemTypesTable();
      const { companyId = null } = req.scope || {};
      const body = req.body || {};
      const typeCode = String(body.type_code || "").trim();
      const typeName = String(body.type_name || "").trim();
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!typeCode || !typeName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "type_code and type_name are required",
        );
      }

      const ins = await query(
        `INSERT INTO inv_item_types (company_id, type_code, type_name, is_active) VALUES (:companyId, :typeCode, :typeName, :isActive)`,
        { companyId, typeCode, typeName, isActive },
      );
      res.status(201).json({ id: ins.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/item-types/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemTypesTable();
      const { companyId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const body = req.body || {};
      const typeCode = String(body.type_code || "").trim();
      const typeName = String(body.type_name || "").trim();
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!typeCode || !typeName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "type_code and type_name are required",
        );
      }

      const upd = await query(
        `UPDATE inv_item_types SET type_code = :typeCode, type_name = :typeName, is_active = :isActive WHERE id = :id AND company_id = :companyId`,
        { id, companyId, typeCode, typeName, isActive },
      );

      if (!upd.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item type not found");
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/item-types/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemTypesTable();
      const { companyId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const del = await query(
        `DELETE FROM inv_item_types WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );

      if (!del.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item type not found");
      }
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete item type because it is in use.",
          ),
        );
      }
      next(e);
    }
  },
);

router.get(
  "/item-setup-lookups",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureUomTable();
      await ensureItemTypesTable();
      // Assuming other tables are ensured elsewhere, but we at least handle the basic ones.
      const { companyId = null } = req.scope || {};

      const uoms = await query(
        "SELECT id, uom_code, uom_name FROM inv_uom WHERE is_active = 1 ORDER BY uom_name ASC",
      ).catch(() => []);
      const itemTypes = await query(
        "SELECT id, type_code, type_name FROM inv_item_types WHERE company_id = :companyId AND is_active = 1",
        { companyId },
      ).catch(() => []);
      const categories = await query(
        "SELECT id, category_code, category_name FROM inv_item_categories WHERE company_id = :companyId AND is_active = 1",
        { companyId },
      ).catch(() => []);
      const itemGroups = await query(
        "SELECT id, group_code, group_name FROM inv_item_groups WHERE company_id = :companyId AND is_active = 1",
        { companyId },
      ).catch(() => []);

      // Fetch finance lookups
      const taxes = await query(
        "SELECT id, code, name, rate_percent FROM fin_tax_codes WHERE company_id = :companyId AND is_active = 1",
        { companyId },
      ).catch(() => []);
      const accounts = await query(
        `
      SELECT a.id, a.code, a.name, g.nature,
          a.created_at,
          u.username AS created_by_name
         FROM fin_accounts a 
      JOIN fin_account_groups g ON g.id = a.group_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.company_id = :companyId AND a.is_active = 1
    `,
        { companyId },
      ).catch(() => []);
      const currencies = await query(
        "SELECT id, code, name FROM fin_currencies WHERE is_active = 1",
      ).catch(() => []);

      res.json({
        uoms,
        itemTypes,
        categories,
        itemGroups,
        taxes,
        accounts,
        currencies,
      });
    } catch (err) {
      next(err);
    }
  },
);

async function ensureUnitConversionsTable() {
  if (!(await hasTable("inv_unit_conversions"))) {
    await query(`
      CREATE TABLE IF NOT EXISTS inv_unit_conversions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        from_uom VARCHAR(20) NOT NULL,
        to_uom VARCHAR(20) NOT NULL,
        conversion_factor DECIMAL(18,6) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_unit_conv (company_id, item_id, from_uom, to_uom),
        KEY idx_unit_conv_item (item_id),
        CONSTRAINT fk_unit_conv_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
  }
  await query(
    `ALTER TABLE inv_unit_conversions
      ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL`,
  ).catch(() => {});
}

router.get(
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureUnitConversionsTable();
      const { companyId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT c.id,
               c.item_id,
               i.item_code,
               i.item_name,
               c.from_uom,
               c.to_uom,
               c.conversion_factor,
               c.is_active,
          c.created_at,
          u.username AS created_by_name
         FROM inv_unit_conversions c
        JOIN inv_items i ON i.id = c.item_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
        ORDER BY i.item_name ASC, c.from_uom ASC, c.to_uom ASC, c.id ASC
        `,
        { companyId },
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

async function nextTransferNo(companyId) {
  const rows = await query(
    `
    SELECT transfer_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_transfers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND transfer_no LIKE 'TRN-%'
    ORDER BY CAST(SUBSTRING(transfer_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].transfer_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `TRN-${String(nextNum).padStart(6, "0")}`;
}

async function ensureMaterialRequisitionApprovalTrigger() {
  await ensureStockBalancesWarehouseInfrastructure();
  await ensureIssueToRequirementTables();
  try {
    await query(
      "ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100)",
    );
  } catch {}
  try {
    await query(
      "ALTER TABLE inv_material_requisition_details ADD COLUMN IF NOT EXISTS serial_no VARCHAR(100)",
    );
  } catch {}
  if (!(await hasTrigger("tr_mat_req_status_au_stock_out"))) {
    await query(`
      CREATE TRIGGER tr_mat_req_status_au_stock_out
      AFTER UPDATE ON inv_material_requisitions
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, -COALESCE(d.qty_requested, 0),
                 d.batch_no, d.serial_no, NULL, NOW(), 'MATERIAL_REQUISITION', NEW.id
         FROM inv_material_requisition_details d
         WHERE d.requisition_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
  if (!(await hasTrigger("tr_mat_req_status_au_stock_in"))) {
    await query(`
      CREATE TRIGGER tr_mat_req_status_au_stock_in
      AFTER UPDATE ON inv_material_requisitions
      FOR EACH ROW
      BEGIN
        DECLARE v_company_id BIGINT UNSIGNED;
        DECLARE v_branch_id BIGINT UNSIGNED;
        DECLARE v_warehouse_id BIGINT UNSIGNED;
        IF NEW.status = 'RETURNED' AND OLD.status = 'APPROVED' THEN
          SET v_company_id = NEW.company_id;
          SET v_branch_id = NEW.branch_id;
          SET v_warehouse_id = NEW.warehouse_id;
          INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty, batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
          SELECT v_company_id, v_branch_id, v_warehouse_id, d.item_id, COALESCE(d.qty_requested, 0),
                 d.batch_no, d.serial_no, NULL, NOW(), 'MATERIAL_REQUISITION', NEW.id
         FROM inv_material_requisition_details d
         WHERE d.requisition_id = NEW.id
          ON DUPLICATE KEY UPDATE
            qty = qty + VALUES(qty),
            batch_no = VALUES(batch_no),
            serial_no = VALUES(serial_no),
            expiry_date = VALUES(expiry_date),
            entry_date = VALUES(entry_date),
            source_type = VALUES(source_type),
            source_id = VALUES(source_id);
        END IF;
      END
    `);
  }
  try {
    await query(`DROP TRIGGER IF EXISTS tr_mat_req_status_au_issue_create`);
  } catch {}
  await query(`
    CREATE TRIGGER tr_mat_req_status_au_issue_create
    AFTER UPDATE ON inv_material_requisitions
    FOR EACH ROW
    BEGIN
      DECLARE v_seq BIGINT UNSIGNED;
      DECLARE v_issue_no VARCHAR(50);
      DECLARE v_issue_id BIGINT UNSIGNED;
      IF NEW.status = 'APPROVED' AND (OLD.status IS NULL OR OLD.status <> 'APPROVED') THEN
        SELECT MAX(CAST(SUBSTRING(issue_no, 5) AS UNSIGNED)) INTO v_seq
         FROM inv_issue_to_requirement
         WHERE company_id = NEW.company_id
           AND branch_id = NEW.branch_id
           AND issue_no LIKE 'ISS-%';
        SET v_seq = IFNULL(v_seq, 0) + 1;
        SET v_issue_no = CONCAT('ISS-', LPAD(v_seq, 6, '0'));
        INSERT INTO inv_issue_to_requirement
          (company_id, branch_id, issue_no, issue_date, warehouse_id, issued_to, status, remarks, created_by, created_at, updated_at, department_id, issue_type, requisition_id)
        VALUES
          (NEW.company_id, NEW.branch_id, v_issue_no, CURDATE(), NEW.warehouse_id, NEW.requested_by, 'POSTED', NEW.remarks, NEW.created_by, NEW.updated_at, NEW.updated_at, NEW.department_id, NEW.requisition_type, NEW.id);
        SET v_issue_id = LAST_INSERT_ID();
        INSERT INTO inv_issue_to_requirement_details
          (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
        SELECT 
          v_issue_id,
          d.item_id,
          COALESCE(d.qty_requested, 0) AS qty_issued,
          i.uom,
          d.batch_no,
          d.serial_no
        FROM inv_material_requisition_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.requisition_id = NEW.id;
      END IF;
    END
  `);
}

router.get(
  "/items",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const warehouseId = toNumber(req.query.warehouse_id) || null;
      // Ensure table and UOM column exists with proper defaults
      await ensureItemsTable();
      const sbWhere = warehouseId ? "WHERE warehouse_id = :warehouseId" : "";
      const rows = await query(
        `
        SELECT
          i.id,
          i.item_code,
          i.item_name,
          i.uom,
          i.item_type,
          it.type_name AS item_type_name,
          i.category_id,
          c.category_name,
          i.item_group_id,
          g.group_name,
          i.barcode,
          i.cost_price,
          i.selling_price,
          i.currency_id,
          cur.code AS currency_code,
          cur.name AS currency_name,
          i.vat_on_purchase_id,
          tpur.code AS vat_on_purchase_code,
          i.vat_on_sales_id,
          tsal.code AS vat_on_sales_code,
          i.purchase_account_id,
          apur.code AS purchase_account_code,
          apur.name AS purchase_account_name,
          i.sales_account_id,
          asal.code AS sales_account_code,
          asal.name AS sales_account_name,
          i.description,
          i.min_stock_level,
          i.max_stock_level,
          i.reorder_level,
          i.safety_stock,
          i.service_item,
          i.is_stockable,
          i.is_sellable,
          i.is_purchasable,
           i.is_active,
           COALESCE(sb.qty, 0) AS stock_level,
           i.created_at
          FROM inv_items i
         LEFT JOIN inv_item_types it
           ON it.company_id = i.company_id
          AND it.type_code = i.item_type
         LEFT JOIN inv_item_categories c ON c.id = i.category_id
         LEFT JOIN inv_item_groups g ON g.id = i.item_group_id
         LEFT JOIN fin_currencies cur ON cur.id = i.currency_id
         LEFT JOIN fin_tax_codes tpur ON tpur.id = i.vat_on_purchase_id
         LEFT JOIN fin_tax_codes tsal ON tsal.id = i.vat_on_sales_id
         LEFT JOIN fin_accounts apur ON apur.id = i.purchase_account_id
         LEFT JOIN fin_accounts asal ON asal.id = i.sales_account_id
         LEFT JOIN (
           SELECT company_id, item_id, SUM(qty) AS qty
           FROM inv_stock_balances
           ${sbWhere}
           GROUP BY company_id, item_id
         ) sb
           ON sb.company_id = i.company_id
          AND sb.item_id = i.id
          WHERE i.company_id = :companyId
          ${req.query.all !== '1' && req.query.all !== 'true' ? "AND i.is_active = 1" : ""}
         ORDER BY i.item_name ASC
         LIMIT 2000
        `,
        { companyId: companyId || null, warehouseId },
      );
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/items/next-code",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const rows = await query(
        `SELECT item_code FROM inv_items 
         WHERE company_id = :companyId AND item_code LIKE 'ITM-%' 
         ORDER BY id DESC LIMIT 100`,
        { companyId },
      );
      let maxNum = 0;
      (rows || []).forEach((r) => {
        const m = String(r.item_code || "").match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > maxNum) maxNum = n;
        }
      });
      const nextCode = `ITM-${String(maxNum + 1).padStart(6, "0")}`;
      res.json({ nextCode });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/warehouses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureWarehousesTable();
      const { companyId, branchId = null } = req.scope || {};
      const activeParam = String(req.query.active || "")
        .trim()
        .toLowerCase();
      const activeOnly = !["0", "false", "all"].includes(activeParam);
      const rows = await query(
        `
        SELECT 
          w.id, 
          w.warehouse_code, 
          w.warehouse_name, 
          w.location, 
          w.branch_id, 
          w.is_active,
          w.created_at,
          w.created_by,
          (SELECT COALESCE(u.username, u.full_name, 'Admin') FROM adm_users u WHERE u.id = w.created_by LIMIT 1) AS created_by_name
        FROM inv_warehouses w
        WHERE w.company_id = :companyId
          AND (:branchIdsStr = '' OR FIND_IN_SET(w.branch_id, :branchIdsStr))
          AND (:activeOnly = 0 OR w.is_active = 1)
        ORDER BY w.warehouse_name ASC
        `,
        { companyId, branchIdsStr: req.scope.branchIdsStr || '', activeOnly: activeOnly ? 1 : 0 },
      ).catch((err) => {
        console.error("[warehouses-list] Query failed:", err);
        return [];
      });
      res.json({ items: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/warehouses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureWarehousesTable();
      const { companyId, branchIdsStr } = req.scope;
      const id = toNumber(req.params.id, 0);
      const rows = await query(
        `SELECT 
           w.*,
           (SELECT COALESCE(u.username, u.full_name, 'Admin') FROM adm_users u WHERE u.id = w.created_by LIMIT 1) AS created_by_name
         FROM inv_warehouses w
         WHERE w.id = :id AND w.company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(w.branch_id, :branchIdsStr))`,
        { id, companyId, branchIdsStr: branchIdsStr || '' }
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Warehouse not found");
      res.json({ item: rows[0] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/warehouses",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureWarehousesTable();
      const { companyId } = req.scope || {};
      const body = req.body || {};
      const rawBranchId =
        body.branch_id ||
        req.headers["x-branch-id"] ||
        req.query.branchId ||
        req.scope?.branchId ||
        req.user?.branchIds?.[0] ||
        req.user?.branch_id ||
        1;
      const branch_id = toNumber(rawBranchId, 1);
      const userId = Number(
        body.created_by ||
        req.user?.id ||
        req.user?.sub ||
        req.scope?.userId ||
        1
      );

      const warehouse_code = String(body.warehouse_code || "").trim();
      const warehouse_name = String(body.warehouse_name || "").trim();
      if (!warehouse_code || !warehouse_name) {
        throw httpError(400, "VALIDATION_ERROR", "warehouse_code and warehouse_name are required");
      }

      const result = await query(
        `INSERT INTO inv_warehouses (
           company_id, branch_id, warehouse_code, warehouse_name, location, is_active, created_by, created_at
         ) VALUES (
           :companyId, :branch_id, :warehouse_code, :warehouse_name, :location, :is_active, :userId, NOW()
         )`,
        {
          companyId,
          branch_id,
          warehouse_code,
          warehouse_name,
          location: body.location || null,
          is_active: body.is_active === undefined ? 1 : Number(Boolean(body.is_active)),
          userId,
        }
      );
      res.json({ item: { id: result.insertId } });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/warehouses/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureWarehousesTable();
      const { companyId = null } = req.scope || {};
      const id = toNumber(req.params.id, 0);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid warehouse id");
      const body = req.body || {};
      const rawBranchId = body.branch_id || req.headers["x-branch-id"];
      const branch_id = rawBranchId ? toNumber(rawBranchId, null) : null;

      const warehouse_code = String(body.warehouse_code || "").trim();
      const warehouse_name = String(body.warehouse_name || "").trim();
      if (!warehouse_code || !warehouse_name) {
        throw httpError(400, "VALIDATION_ERROR", "warehouse_code and warehouse_name are required");
      }

      await query(
        `UPDATE inv_warehouses SET
           branch_id = COALESCE(:branch_id, branch_id),
           warehouse_code = :warehouse_code,
           warehouse_name = :warehouse_name,
           location = :location,
           is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          branch_id,
          warehouse_code,
          warehouse_name,
          location: body.location || null,
          is_active: body.is_active === undefined ? 1 : Number(Boolean(body.is_active)),
        }
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/warehouses/:id/link-branch",
  requireAuth,
  requireCompanyScope,
  linkWarehouseBranch,
);

router.get(
  "/items/:id/batches",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const itemId = req.params.id;
      const rows = await query(
        `
        SELECT id, batch_no, qty, expiry_date, cost,
          created_at,
          u.username AS created_by_name
         FROM inv_item_batches
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND item_id = :itemId AND qty > 0
        ORDER BY expiry_date ASC, id ASC
        `,
        { companyId, itemId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock/available",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const warehouseId = toNumber(req.query.warehouse_id);
      const itemId = toNumber(req.query.item_id);

      if (!warehouseId || !itemId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "warehouse_id and item_id are required",
        );
      }

      const rows = await query(
        `
        SELECT COALESCE(SUM(qty), 0) AS qty
         FROM inv_stock_balances
         WHERE company_id = :companyId
           AND warehouse_id = :warehouseId
           AND item_id = :itemId
        `,
        { companyId, warehouseId, itemId },
      ).catch(() => []);

      let qty = rows && rows.length ? Number(rows[0].qty || 0) : 0;
      if (qty === 0) {
        const itemRows = await query(
          `SELECT stock_qty FROM inv_items WHERE id = :itemId AND company_id = :companyId LIMIT 1`,
          { itemId, companyId },
        ).catch(() => []);
        if (itemRows && itemRows.length && Number(itemRows[0].stock_qty) > 0) {
          qty = Number(itemRows[0].stock_qty);
        }
      }

      res.json({ qty });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.VIEW"),
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId, branchId = null } = req.scope || {};
      const statusFilter =
        String(req.query?.status || "")
          .trim()
          .toUpperCase() || null;
      // Ensure soft-delete columns exist
      if (!(await hasColumn("inv_material_requisitions", "is_active"))) {
        await query(
          "ALTER TABLE inv_material_requisitions ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
        ).catch(() => {});
      }
      if (!(await hasColumn("inv_material_requisitions", "deleted_at"))) {
        await query(
          "ALTER TABLE inv_material_requisitions ADD COLUMN deleted_at DATETIME NULL",
        ).catch(() => {});
      }
      let where = `
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
          AND COALESCE(r.is_active,'Y') = 'Y'
          AND NOT EXISTS (
            SELECT 1 FROM inv_issue_to_requirement i
            WHERE i.requisition_id = r.id
              AND i.company_id = :companyId AND i.branch_id = :branchId
          )
      `;
      const params = { companyId, branchId };
      if (statusFilter) {
        where += ` AND r.status = :status`;
        params.status = statusFilter;
      }
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const limit = Math.max(1, parseInt(req.query.limit || "50", 10));
      const offset = (page - 1) * limit;

      let countSql = `SELECT COUNT(*) AS total FROM inv_material_requisitions r ${where}`;
      const countRes = await query(countSql, params);
      const total = Number(countRes[0]?.total || 0);

      params.limit = limit;
      params.offset = offset;

      const rows = await query(
        `
        SELECT r.id,
               r.requisition_no,
               r.requisition_date,
               r.requisition_type,
               r.priority,
               r.requested_by,
               CASE WHEN iw.has_inactive_pending = 1 THEN 'APPROVED' ELSE r.status END AS status,
               r.warehouse_id,
               r.department_id,
               w.warehouse_name,
               dep.name AS department_name,
               COUNT(d.id) AS item_count,
               fu.username AS forwarded_to_username,
          r.created_at,
          cu.username AS created_by_name
         FROM inv_material_requisitions r
        LEFT JOIN inv_material_requisition_details d ON d.requisition_id = r.id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments dep ON dep.id = r.department_id
        LEFT JOIN (
          SELECT t.document_id, t.assigned_to_user_id
          FROM adm_document_workflows t
          JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
          JOIN (
            SELECT document_id, MAX(id) AS max_id
            FROM adm_document_workflows
            WHERE status = 'PENDING'
              AND (document_type = 'MATERIAL_REQUISITION' OR document_type = 'Material Requisition')
            GROUP BY document_id
          ) m ON m.max_id = t.id
        ) x ON x.document_id = r.id
        LEFT JOIN (
          SELECT t.document_id, 1 AS has_inactive_pending
          FROM adm_document_workflows t
          JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 0
          WHERE t.company_id = :companyId
            AND t.status = 'PENDING'
            AND (t.document_type = 'MATERIAL_REQUISITION' OR t.document_type = 'Material Requisition')
          GROUP BY t.document_id
        ) iw ON iw.document_id = r.id
        LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
        LEFT JOIN adm_users cu ON cu.id = r.created_by
        ${where}
        GROUP BY r.id
        ORDER BY r.requisition_date DESC, r.id DESC LIMIT :limit OFFSET :offset
        `,
        params,
      );
      res.json({ 
        items: rows,
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (err) {
      next(err);
    }
  },
);


// ─── Fast Moving Items Report ────────────────────────────────────────────────
router.get(
  "/reports/fast-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query?.from || null;
      const to = req.query?.to || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "r.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))"
      ];
      if (from) { where.push("DATE(r.issue_date) >= :from"); params.from = from; }
      if (to) { where.push("DATE(r.issue_date) <= :to"); params.to = to; }
      const rows = await query(
        `SELECT 
           d.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(d.qty_issued) AS issued_qty, 
           SUM(d.qty_issued * i.cost_price) AS turnover 
         FROM inv_issue_to_requirement r 
         JOIN inv_issue_to_requirement_details d ON d.issue_id = r.id 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE ${where.join(" AND ")} 
         GROUP BY d.item_id, i.item_code, i.item_name 
         HAVING issued_qty > 0 
         ORDER BY turnover DESC, issued_qty DESC 
         LIMIT 100`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Slow Moving Items Report ────────────────────────────────────────────────
router.get(
  "/reports/slow-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const from = req.query?.from || null;
      const to = req.query?.to || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "r.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))"
      ];
      if (from) { where.push("DATE(r.issue_date) >= :from"); params.from = from; }
      if (to) { where.push("DATE(r.issue_date) <= :to"); params.to = to; }
      const rows = await query(
        `SELECT 
           d.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(d.qty_issued) AS issued_qty, 
           SUM(d.qty_issued * i.cost_price) AS turnover 
         FROM inv_issue_to_requirement r 
         JOIN inv_issue_to_requirement_details d ON d.issue_id = r.id 
         JOIN inv_items i ON i.id = d.item_id 
         WHERE ${where.join(" AND ")} 
         GROUP BY d.item_id, i.item_code, i.item_name 
         HAVING issued_qty > 0 
         ORDER BY turnover ASC, issued_qty ASC 
         LIMIT 100`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Non Moving Items Report ─────────────────────────────────────────────────
router.get(
  "/reports/non-moving",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const asOf = req.query?.asOf || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "b.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(b.branch_id, :branchIdsStr))",
        "b.qty > 0"
      ];
      
      const rows = await query(
        `SELECT 
           b.item_id, 
           i.item_code, 
           i.item_name, 
           SUM(b.qty) AS available_qty,
           DATEDIFF(IFNULL(:asOf, CURDATE()), MAX(t.transaction_date)) AS days_since_last
         FROM inv_stock_balances b 
         JOIN inv_items i ON i.id = b.item_id 
         LEFT JOIN v_inv_stock_ledger_computed t ON t.item_id = b.item_id AND t.company_id = b.company_id
         WHERE ${where.join(" AND ")} 
         GROUP BY b.item_id, i.item_code, i.item_name 
         HAVING days_since_last IS NULL OR days_since_last > 90
         ORDER BY days_since_last DESC, available_qty DESC 
         LIMIT 100`,
        { ...params, asOf }
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Aging Analysis Report ─────────────────────────────────────────────
router.get(
  "/reports/stock-aging-analysis",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const asOf = req.query?.asOf || null;
      const params = { companyId, branchIdsStr, asOf };
      const where = [
        "b.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(b.branch_id, :branchIdsStr))",
        "b.qty > 0"
      ];
      
      const rows = await query(
        `SELECT 
           b.item_id, 
           i.item_code, 
           i.item_name,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) <= 30 THEN b.qty ELSE 0 END) AS bucket_0_30,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) BETWEEN 31 AND 60 THEN b.qty ELSE 0 END) AS bucket_31_60,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) BETWEEN 61 AND 90 THEN b.qty ELSE 0 END) AS bucket_61_90,
           SUM(CASE WHEN DATEDIFF(IFNULL(:asOf, CURDATE()), IFNULL((SELECT MAX(transaction_date) FROM v_inv_stock_ledger_computed t WHERE t.item_id = b.item_id AND t.company_id = b.company_id AND type='GRN'), b.created_at)) > 90 THEN b.qty ELSE 0 END) AS bucket_90_plus
         FROM inv_stock_balances b 
         JOIN inv_items i ON i.id = b.item_id 
         WHERE ${where.join(" AND ")} 
         GROUP BY b.item_id, i.item_code, i.item_name`,
        params
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Balances Report ────────────────────────────────────────────────────
router.get(
  "/stock-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const warehouseId = toNumber(req.query?.warehouseId);
      const q = String(req.query?.q || "").trim();
      const params = { companyId, branchId };
      let whereItem = "i.company_id = :companyId";
      if (q) {
        whereItem +=
          " AND (i.item_code LIKE :q OR i.item_name LIKE :q OR i.uom LIKE :q)";
        params.q = `%${q}%`;
      }
      const stockWhere = [
        "sb.company_id = :companyId",
        "sb.branch_id = :branchId",
      ];
      if (warehouseId) {
        stockWhere.push("sb.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(SUM(sb.qty), 0) + COALESCE(SUM(sb.reserved_qty), 0) AS total_qty,
          COALESCE(SUM(sb.reserved_qty), 0) AS reserved_qty,
          COALESCE(SUM(sb.qty), 0) AS available_qty,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN inv_stock_balances sb
          ON sb.item_id = i.id
         AND ${stockWhere.join(" AND ")}
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE ${whereItem}
        GROUP BY i.id, i.item_code, i.item_name
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Value Report ───────────────────────────────────────────────────────
router.get(
  "/stock-value",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const warehouseId = toNumber(req.query?.warehouseId);
      const itemGroupId = toNumber(req.query?.itemGroupId);
      const itemId = toNumber(req.query?.itemId);
      const q = String(req.query?.q || "").trim();
      const params = { companyId, branchId };
      let whereItem = "i.company_id = :companyId";
      
      if (q) {
        whereItem +=
          " AND (i.item_code LIKE :q OR i.item_name LIKE :q OR i.uom LIKE :q)";
        params.q = `%${q}%`;
      }
      if (itemGroupId) {
        whereItem += " AND i.item_group_id = :itemGroupId";
        params.itemGroupId = itemGroupId;
      }
      if (itemId) {
        whereItem += " AND i.id = :itemId";
        params.itemId = itemId;
      }

      const stockWhere = [
        "sb.company_id = :companyId",
        "sb.branch_id = :branchId",
      ];
      if (warehouseId) {
        stockWhere.push("sb.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          i.uom,
          ig.group_name AS item_group,
          COALESCE(SUM(sb.qty), 0) AS qty,
          i.cost_price,
          (COALESCE(SUM(sb.qty), 0) * i.cost_price) AS value
         FROM inv_items i
        LEFT JOIN inv_stock_balances sb
          ON sb.item_id = i.id
         AND ${stockWhere.join(" AND ")}
        LEFT JOIN inv_item_groups ig ON ig.id = i.item_group_id
         WHERE ${whereItem}
        GROUP BY i.id, i.item_code, i.item_name, i.uom, ig.group_name, i.cost_price
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-balances/bulk-upload",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockBalancesWarehouseInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const rows = Array.isArray(body.rows)
        ? body.rows
        : Array.isArray(body.data)
          ? body.data
          : [];
      const warehouseId =
        Number(body.warehouseId || 0) > 0 ? Number(body.warehouseId) : null;

      if (!warehouseId) {
        throw httpError(400, "VALIDATION_ERROR", "Warehouse ID is required for bulk stock upload");
      }

      if (!rows.length) {
        throw httpError(400, "VALIDATION_ERROR", "No rows provided");
      }

      await conn.beginTransaction();

      let updated = 0;
      let failed = 0;

      for (const r of rows) {
        const itemCode = String(
          r.item_code || r.itemCode || r.ITEM_CODE || "",
        ).trim();
        const qty = Number(r.qty ?? r.NEW_QTY ?? r.new_qty ?? r.QTY ?? 0);

        if (!itemCode || !Number.isFinite(qty)) {
          failed += 1;
          continue;
        }

        const [itemRows] = await conn.execute(
          `SELECT id
             FROM inv_items
            WHERE company_id = :companyId
              AND item_code = :itemCode
            LIMIT 1`,
          { companyId, itemCode },
        );
        const itemId = Number(itemRows?.[0]?.id || 0) || null;
        if (!itemId) {
          failed += 1;
          continue;
        }

        await conn.execute(
          `DELETE FROM inv_stock_balances
            WHERE company_id = :companyId
              AND branch_id = :branchId
              AND item_id = :itemId
              AND warehouse_id <=> :warehouseId`,
          { companyId, branchId, itemId, warehouseId },
        );

        if (qty > 0) {
          await conn.execute(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)`,
            { companyId, branchId, warehouseId, itemId, qty },
          );
        }

        updated += 1;
      }

      await conn.commit();
      res.json({ updated, failed });
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

// ─── Inventory Reports (minimal endpoints) ────────────────────────────────────
router.get(
  "/reports/health-monitor",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const warehouseId = toNumber(req.query?.warehouseId);
      const params = { companyId, branchId };
      const stockWhere = [
        "sb.company_id = :companyId",
        "sb.branch_id = :branchId",
      ];
      if (warehouseId) {
        stockWhere.push("sb.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(SUM(sb.qty), 0) AS available_qty,
          COALESCE(i.reorder_level, 0) AS reorder_level,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN inv_stock_balances sb
          ON sb.item_id = i.id
         AND ${stockWhere.join(" AND ")}
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
        GROUP BY i.id, i.item_code, i.item_name, i.reorder_level
        ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);
      const items =
        (rows || []).map((r) => {
          const avail = Number(r.available_qty || 0);
          const reorder = Number(r.reorder_level || 0);
          let status = "OK";
          if (avail <= 0) status = "CRITICAL";
          else if (avail <= reorder) status = "LOW";
          return {
            ...r,
            days_of_cover: 0,
            status,
          };
        }) || [];
      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/periodical-stock-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const fromDate = req.query?.from && req.query.from !== 'null' ? `${req.query.from} 00:00:00` : '1900-01-01 00:00:00';
      const toDate = req.query?.to && req.query.to !== 'null' ? `${req.query.to} 23:59:59` : '2999-12-31 23:59:59';
      const warehouseId = req.query?.warehouseId ? Number(req.query.warehouseId) : null;
      const q = req.query?.q ? String(req.query.q).trim() : "";
      
      const params = { companyId, branchId, branchIdsStr, fromDate, toDate };
      let lWhere = "l.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(l.branch_id, :branchIdsStr))";
      if (warehouseId) {
        lWhere += " AND l.warehouse_id = :warehouseId";
        params.warehouseId = warehouseId;
      }

      let iWhere = "i.company_id = :companyId";
      if (q) {
        iWhere += " AND (i.item_code LIKE :q OR i.item_name LIKE :q)";
        params.q = `%${q}%`;
      }

      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          COALESCE(SUM(CASE WHEN l.transaction_date < :fromDate OR l.transaction_reason = 'Opening Balance' THEN l.qty_change ELSE 0 END), 0) AS opening_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date >= :fromDate AND l.transaction_date <= :toDate AND l.qty_change > 0 AND (l.transaction_reason IS NULL OR l.transaction_reason != 'Opening Balance') THEN l.qty_change ELSE 0 END), 0) AS receipts_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date >= :fromDate AND l.transaction_date <= :toDate AND l.qty_change < 0 THEN ABS(l.qty_change) ELSE 0 END), 0) AS issues_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date <= :toDate OR l.transaction_reason = 'Opening Balance' THEN l.qty_change ELSE 0 END), 0) AS closing_qty
        FROM inv_items i
        LEFT JOIN v_inv_stock_ledger_computed l ON l.item_id = i.id AND ${lWhere}
        WHERE ${iWhere}
        GROUP BY i.id, i.item_code, i.item_name
        HAVING opening_qty != 0 OR receipts_qty != 0 OR issues_qty != 0 OR closing_qty != 0
        ORDER BY i.item_name ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/periodical-stock-statement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const warehouseId = toNumber(req.query?.warehouseId);
      const itemGroupId = toNumber(req.query?.itemGroupId);
      const q = String(req.query?.q || "").trim();
      const fromDate = req.query?.from && req.query.from !== 'null' ? `${req.query.from} 00:00:00` : '1900-01-01 00:00:00';
      const toDate = req.query?.to && req.query.to !== 'null' ? `${req.query.to} 23:59:59` : '2999-12-31 23:59:59';
      
      const params = { companyId, branchId, branchIdsStr, fromDate, toDate };
      
      let iWhere = "i.company_id = :companyId";
      if (itemGroupId) {
        iWhere += " AND i.item_group_id = :itemGroupId";
        params.itemGroupId = itemGroupId;
      }
      if (q) {
        iWhere += " AND (i.item_code LIKE :q OR i.item_name LIKE :q)";
        params.q = `%${q}%`;
      }
      
      let lWhere = "l.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(l.branch_id, :branchIdsStr))";
      if (warehouseId) {
        lWhere += " AND l.warehouse_id = :warehouseId";
        params.warehouseId = warehouseId;
      }

      const rows = await query(
        `
        SELECT 
          i.id AS item_id,
          i.item_code,
          i.item_name,
          i.cost_price,
          COALESCE(SUM(CASE WHEN l.transaction_date < :fromDate OR l.transaction_reason = 'Opening Balance' THEN l.qty_change ELSE 0 END), 0) AS opening_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date >= :fromDate AND l.transaction_date <= :toDate AND l.qty_change > 0 AND (l.transaction_reason IS NULL OR l.transaction_reason != 'Opening Balance') THEN l.qty_change ELSE 0 END), 0) AS receipts_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date >= :fromDate AND l.transaction_date <= :toDate AND l.qty_change < 0 THEN ABS(l.qty_change) ELSE 0 END), 0) AS issues_qty,
          COALESCE(SUM(CASE WHEN l.transaction_date <= :toDate OR l.transaction_reason = 'Opening Balance' THEN l.qty_change ELSE 0 END), 0) AS closing_qty
        FROM inv_items i
        LEFT JOIN v_inv_stock_ledger_computed l ON l.item_id = i.id AND ${lWhere}
        WHERE ${iWhere}
        GROUP BY i.id, i.item_code, i.item_name, i.cost_price
        HAVING opening_qty != 0 OR receipts_qty != 0 OR issues_qty != 0 OR closing_qty != 0
        ORDER BY i.item_name ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/issue-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId = null } = req.scope || {};
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const departmentId = toNumber(req.query?.departmentId);
      const params = { companyId, branchId };
      const where = ["v.company_id = :companyId", "v.branch_id = :branchId"];
      if (from) {
        where.push("v.issue_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("v.issue_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("v.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      if (departmentId) {
        where.push("v.department_id = :departmentId");
        params.departmentId = departmentId;
      }
      const rows = await query(
        `
        SELECT 
          v.issue_id,
          v.issue_no,
          v.issue_date,
          v.issue_type,
          v.warehouse_id,
          v.department_id,
          v.item_id,
          v.qty_issued,
          v.uom,
          v.returned_qty,
          v.remaining_qty,
          i.item_code,
          i.item_name,
          d.name AS department_name,
          v.created_at,
          u.username AS created_by_name
         FROM v_inv_issue_register v
        LEFT JOIN inv_items i ON i.id = v.item_id
        LEFT JOIN adm_departments d ON d.id = v.department_id
         WHERE ${where.join(" AND ")}
        ORDER BY v.issue_date DESC, v.issue_id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Transfer Register Report ────────────────────────────────────────────
router.get(
  "/reports/stock-transfer-register",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchIdsStr = '' } = req.scope || {};
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const params = { companyId, branchIdsStr };
      const where = [
        "t.company_id = :companyId",
        "(:branchIdsStr = '' OR FIND_IN_SET(t.branch_id, :branchIdsStr))"
      ];
      if (from) { where.push("DATE(t.transfer_date) >= :from"); params.from = from; }
      if (to)   { where.push("DATE(t.transfer_date) <= :to");   params.to   = to;   }
      const rows = await query(
        `SELECT
           t.id,
           t.transfer_no,
           DATE(t.transfer_date) AS transfer_date,
           fw.warehouse_name AS from_warehouse_name,
           tw.warehouse_name AS to_warehouse_name,
           d.item_id,
           i.item_name,
           i.item_code,
           d.qty,
           d.uom,
           t.status,
           t.remarks
         FROM inv_stock_transfers t
         LEFT JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
         LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
         LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
         LEFT JOIN inv_items i ON i.id = d.item_id
         WHERE ${where.join(" AND ")}
         ORDER BY t.transfer_date DESC, t.id DESC`,
        params
      ).catch(() => []);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/reports/material-returns",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      const { companyId, branchId = null } = req.scope || {};
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const departmentId = toNumber(req.query?.departmentId);
      const params = { companyId, branchId };
      const where = ["v.company_id = :companyId", "v.branch_id = :branchId"];
      if (from) {
        where.push("v.rts_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("v.rts_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("v.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      if (departmentId) {
        where.push("v.department_id = :departmentId");
        params.departmentId = departmentId;
      }
      const rows = await query(
        `
        SELECT 
          v.rts_id,
          v.rts_no,
          v.rts_date,
          v.status,
          v.warehouse_id,
          v.department_id,
          v.item_id,
          v.qty,
          v.uom,
          i.item_code,
          i.item_name,
          d.name AS department_name,
          w.warehouse_name,
          v.created_at,
          u.username AS created_by_name
         FROM v_inv_material_returns v
        LEFT JOIN inv_items i ON i.id = v.item_id
        LEFT JOIN adm_departments d ON d.id = v.department_id
        LEFT JOIN inv_warehouses w ON w.id = v.warehouse_id
         WHERE ${where.join(" AND ")}
        ORDER BY v.rts_date DESC, v.rts_id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);
router.get(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.VIEW"),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `
        SELECT r.*,
          r.created_at,
          u.username AS created_by_name
         FROM inv_material_requisitions r
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE r.id = :id AND r.company_id = :companyId AND r.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!rows.length)
        throw httpError(404, "NOT_FOUND", "Material requisition not found");
      const details = await query(
        `
        SELECT d.id,
               d.item_id,
               i.item_code,
               i.item_name,
               i.uom,
               d.qty_requested,
               d.qty_issued,
          d.created_at,
          u.username AS created_by_name
         FROM inv_material_requisition_details d
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.requisition_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: rows[0], details });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Admin: Rebuild Reporting Objects ────────────────────────────────────────
router.post(
  "/admin/rebuild-reporting",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      await ensureMaterialRequisitionApprovalTrigger();
      res.json({ ok: true, message: "Reporting views and triggers rebuilt" });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Stock Adjustments Report ────────────────────────────────────────────────
router.get(
  "/reports/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const from = toDateOnly(req.query?.from) || null;
      const to = toDateOnly(req.query?.to) || null;
      const warehouseId = toNumber(req.query?.warehouseId);
      const params = { companyId, branchId };
      const where = ["a.company_id = :companyId", "a.branch_id = :branchId"];
      if (from) {
        where.push("a.adjustment_date >= :from");
        params.from = from;
      }
      if (to) {
        where.push("a.adjustment_date <= :to");
        params.to = to;
      }
      if (warehouseId) {
        where.push("a.warehouse_id = :warehouseId");
        params.warehouseId = warehouseId;
      }
      const rows = await query(
        `
        SELECT
          a.id AS adjustment_id,
          a.adjustment_no,
          a.adjustment_date,
          a.status,
          a.remarks AS reason,
          a.warehouse_id,
          w.warehouse_name,
          d.item_id,
          d.qty,
          d.uom,
          d.batch_no,
          d.unit_price,
          i.item_code,
          i.item_name,
          a.created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustments a
        JOIN inv_stock_adjustment_details d ON d.adjustment_id = a.id
        LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE ${where.join(" AND ")}
        ORDER BY a.adjustment_date DESC, a.id DESC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);
router.post(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const requisitionNo =
        body.requisition_no && String(body.requisition_no).trim()
          ? String(body.requisition_no).trim()
          : await nextMaterialRequisitionNo(companyId, branchId);
      const requisitionDate = body.requisition_date;
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const requisitionType = body.requisition_type || "INTERNAL";
      const priority = body.priority || "MEDIUM";
      const requestedBy = body.requested_by || null;
      const remarks = body.remarks || null;
      const status = body.status || "DRAFT";
      const createdBy = req.user?.sub ? Number(req.user.sub) : null;
      const details = Array.isArray(body.details) ? body.details : [];

      if (!requisitionDate) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "requisition_date is required",
        );
      }

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_material_requisitions
          (company_id, branch_id, requisition_no, requisition_date, warehouse_id, department_id, requisition_type, priority, requested_by, remarks, status, created_by)
        VALUES
          (:companyId, :branchId, :requisitionNo, :requisitionDate, :warehouseId, :departmentId, :requisitionType, :priority, :requestedBy, :remarks, :status, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          requisitionNo: requisitionNo || null,
          requisitionDate: toDateOnly(requisitionDate) || null,
          warehouseId: toNumber(warehouseId) || null,
          departmentId: toNumber(departmentId) || null,
          requisitionType:
            (requisitionType ? String(requisitionType).trim() : null) ||
            "INTERNAL",
          priority: (priority ? String(priority).trim() : null) || "MEDIUM",
          requestedBy: requestedBy ? String(requestedBy).trim() || null : null,
          remarks: remarks ? String(remarks).trim() || null : null,
          status: (status ? String(status).trim() : null) || "DRAFT",
          createdBy: createdBy || null,
        },
      );
      const requisitionId = hdr.insertId;

      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        const batchNo = d.batch_no ? String(d.batch_no).trim() : null;
        const serialNo = d.serial_no ? String(d.serial_no).trim() : null;
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, batch_no, serial_no)
          VALUES (:requisitionId, :itemId, :qtyRequested, :qtyIssued, :batchNo, :serialNo)
          `,
          {
            requisitionId: requisitionId || null,
            itemId: itemId || null,
            qtyRequested: qtyRequested || 0,
            qtyIssued: qtyIssued || 0,
            batchNo: batchNo || null,
            serialNo: serialNo || null,
          },
        );
      }

      await conn.commit();
      res
        .status(201)
        .json({ id: requisitionId, requisition_no: requisitionNo });
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

router.put(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const body = req.body || {};
      const requisitionDate = body.requisition_date;
      const warehouseId = toNumber(body.warehouse_id);
      const departmentId = toNumber(body.department_id);
      const requisitionType = body.requisition_type || "INTERNAL";
      const priority = body.priority || "MEDIUM";
      const requestedBy = body.requested_by || null;
      const remarks = body.remarks || null;
      const status = body.status || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();

      const [upd] = await conn.execute(
        `
        UPDATE inv_material_requisitions
        SET requisition_date = :requisitionDate,
            warehouse_id = :warehouseId,
            department_id = :departmentId,
            requisition_type = :requisitionType,
            priority = :priority,
            requested_by = :requestedBy,
            remarks = :remarks,
            status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          requisitionDate: toDateOnly(requisitionDate) || null,
          warehouseId: toNumber(warehouseId) || null,
          departmentId: toNumber(departmentId) || null,
          requisitionType:
            (requisitionType ? String(requisitionType).trim() : null) ||
            "INTERNAL",
          priority: (priority ? String(priority).trim() : null) || "MEDIUM",
          requestedBy: requestedBy ? String(requestedBy).trim() || null : null,
          remarks: remarks ? String(remarks).trim() || null : null,
          status: (status ? String(status).trim() : null) || "DRAFT",
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Material requisition not found");

      await conn.execute(
        `DELETE FROM inv_material_requisition_details WHERE requisition_id = :id`,
        { id: id || null },
      );
      for (const d of details) {
        const itemId = toNumber(d.item_id);
        const qtyRequested = Number(d.qty_requested);
        const qtyIssued = Number(d.qty_issued || 0);
        const batchNo = d.batch_no ? String(d.batch_no).trim() : null;
        const serialNo = d.serial_no ? String(d.serial_no).trim() : null;
        if (!itemId || !Number.isFinite(qtyRequested)) continue;
        await conn.execute(
          `
          INSERT INTO inv_material_requisition_details (requisition_id, item_id, qty_requested, qty_issued, batch_no, serial_no)
          VALUES (:id, :itemId, :qtyRequested, :qtyIssued, :batchNo, :serialNo)
          `,
          {
            id: id || null,
            itemId: itemId || null,
            qtyRequested: qtyRequested || 0,
            qtyIssued: qtyIssued || 0,
            batchNo: batchNo || null,
            serialNo: serialNo || null,
          },
        );
      }

      // Soft delete on cancel
      if (status === "CANCELLED") {
        try {
          if (!(await hasColumn("inv_material_requisitions", "is_active"))) {
            await conn.execute(
              "ALTER TABLE inv_material_requisitions ADD COLUMN is_active ENUM('Y','N') NOT NULL DEFAULT 'Y'",
            );
          }
          if (!(await hasColumn("inv_material_requisitions", "deleted_at"))) {
            await conn.execute(
              "ALTER TABLE inv_material_requisitions ADD COLUMN deleted_at DATETIME NULL",
            );
          }
          await conn.execute(
            "UPDATE inv_material_requisitions SET is_active = 'N', deleted_at = NOW() WHERE id = :id",
            { id },
          );
        } catch {}
      }
      await conn.commit();
      res.json({ ok: true });
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
  "/material-requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.MATERIAL_REQUISITION.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureMaterialRequisitionApprovalTrigger();
      const { companyId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/material-requisitions";
      const { activeWorkflow: activeWf } = await resolveWorkflowSelection({
        companyId,
        workflowIdOverride,
        docRouteBase,
        typeSynonyms: ["MATERIAL_REQUISITION", "Material Requisition"],
        amount,
      });
      if (!activeWf) {
        await query(
          `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver_user_id configured",
        );
      }
      const allowedUsers = await query(
        `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );
      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      const dwRes = await query(
        `
          INSERT INTO adm_document_workflows
            (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
          VALUES
            (:companyId, :workflowId, :documentId, 'MATERIAL_REQUISITION', :amount, :stepOrder, 'PENDING', :assignedTo)
          `,
        {
          companyId: companyId || null,
          workflowId: activeWf?.id || null,
          documentId: id || null,
          amount: amount === null ? null : Number(amount) || null,
          stepOrder: first?.step_order || null,
          assignedTo: assignedToUserId || null,
        },
      );
      const instanceId = dwRes.insertId;
      await query(
        `
          INSERT INTO adm_workflow_tasks
            (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
          VALUES
            (:companyId, :workflowId, :dwId, :documentId, 'MATERIAL_REQUISITION', :stepOrder, :assignedTo, 'PENDING')
          `,
        {
          companyId: companyId || null,
          workflowId: activeWf?.id || null,
          dwId: instanceId || null,
          documentId: id || null,
          stepOrder: first?.step_order || null,
          assignedTo: assignedToUserId || null,
        },
      );
      await query(
        `
          INSERT INTO adm_workflow_logs
            (document_workflow_id, step_order, action, actor_user_id, comments)
          VALUES
            (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
          `,
        {
          dwId: instanceId || null,
          stepOrder: first?.step_order || null,
          actor: req.user?.sub || null,
          comments: req.body?.comments || "",
        },
      );
      await query(
        `UPDATE inv_material_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId`,
        { id: id || null, companyId: companyId || null },
      );
      const refRows = await query(
        `SELECT requisition_no,
          created_at,
          u.username AS created_by_name
         FROM inv_material_requisitions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id: id || null, companyId: companyId || null },
      );
      const docNo = refRows.length ? refRows[0].requisition_no : null;
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
           VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId: companyId || null,
          userId: assignedToUserId || null,
          title: "Approval Required",
          message: docNo
            ? `Material Requisition ${docNo} requires your approval`
            : `Material Requisition #${id} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      );
      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
      return;
      await query(
        `UPDATE inv_material_requisitions SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId`,
        { id: id || null, companyId: companyId || null },
      );
      res.json({ status: "SUBMITTED" });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/grn/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureGRNTables();
      const { companyId, branchId = null } = req.scope || {};
      const { type } = req.query;
      const nextNo = await nextGRNNo(companyId, branchId, type || "LOCAL");
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-to-stores",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `SELECT r.id,
               r.rts_no,
               r.rts_date,
               r.warehouse_id,
               r.department_id,
               CASE WHEN iw.has_inactive_pending = 1 THEN 'APPROVED' ELSE r.status END AS status,
               r.return_type,
               w.warehouse_name,
               d.name AS department_name,
               (SELECT COUNT(*) FROM inv_return_to_stores_details WHERE rts_id = r.id) as item_count,
               dw.assigned_to_user_id,
               fu.username as forwarded_to_username
        FROM inv_return_to_stores r
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments d ON d.id = r.department_id
        LEFT JOIN adm_document_workflows dw 
          ON dw.document_id = r.id 
          AND dw.document_type = 'RETURN_TO_STORES'
          AND dw.status = 'PENDING'
          AND EXISTS (
            SELECT 1
            FROM adm_workflows w
            WHERE w.id = dw.workflow_id
              AND w.is_active = 1
          )
        LEFT JOIN (
          SELECT t.document_id, 1 AS has_inactive_pending
          FROM adm_document_workflows t
          JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 0
          WHERE t.company_id = :companyId
            AND t.status = 'PENDING'
            AND t.document_type = 'RETURN_TO_STORES'
          GROUP BY t.document_id
        ) iw ON iw.document_id = r.id
        LEFT JOIN adm_users fu ON fu.id = dw.assigned_to_user_id
        LEFT JOIN adm_users cu ON cu.id = r.created_by
        WHERE r.company_id = :companyId AND r.branch_id = :branchId
        ORDER BY r.rts_date DESC, r.id DESC`,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/return-to-stores/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const nextNo = await nextReturnNo(companyId, branchId);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/stock-transfers/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const { companyId = null } = req.scope || {};
      const nextNo = await nextTransferNo(companyId);
      res.json({ next_no: nextNo });
    } catch (err) {
      next(err);
    }
  },
);

// Item groups and categories (lookups for UI)
async function ensureItemGroupTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_groups (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      group_code VARCHAR(50) NOT NULL,
      group_name VARCHAR(120) NOT NULL,
      parent_group_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_group_code (company_id, branch_id, group_code)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_categories (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      category_code VARCHAR(50) NOT NULL,
      category_name VARCHAR(120) NOT NULL,
      parent_category_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_cat_code (company_id, branch_id, category_code)
    )
  `).catch(() => {});
}

async function ensureItemBatchTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_item_batches (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      batch_no VARCHAR(50) NOT NULL,
      expiry_date DATE NULL,
      cost DECIMAL(18,4) NOT NULL DEFAULT 0,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      qty_reserved DECIMAL(18,3) NOT NULL DEFAULT 0,
      source_type ENUM('GRN','DIRECT_PURCHASE','ADJUSTMENT','SALE') NOT NULL,
      source_id BIGINT UNSIGNED NULL,
      source_date DATE NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_company_batch (company_id, branch_id, item_id, batch_no),
      KEY idx_item (item_id),
      KEY idx_exp (expiry_date)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_batch_movements (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      batch_id BIGINT UNSIGNED NOT NULL,
      movement_type ENUM('IN','OUT') NOT NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      ref_type VARCHAR(40) NULL,
      ref_id BIGINT UNSIGNED NULL,
      ref_date DATE NULL,
      remarks VARCHAR(255) NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_batch (batch_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});
}

// ─── Reporting Views ──────────────────────────────────────────────────────────
async function ensureReportingViews() {
  await query(`DROP VIEW IF EXISTS v_inv_stock_ledger_computed`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_stock_ledger_computed AS
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_accepted, 0) AS qty_change, h.grn_date AS transaction_date, 'GRN' AS type, NULL AS transaction_reason
    FROM inv_goods_receipt_notes h JOIN inv_goods_receipt_note_details d ON d.grn_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty, 0), h.updation_date, 'UPDATE', h.reason AS transaction_reason
    FROM inv_stock_updations h JOIN inv_stock_updation_details d ON d.updation_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.adjusted_stock - d.current_stock, 0), h.adjustment_date, 'ADJUST', NULL AS transaction_reason
    FROM inv_stock_adjustments h JOIN inv_stock_adjustment_details d ON d.adjustment_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_returned, 0), h.rts_date, 'RTS', NULL AS transaction_reason
    FROM inv_return_to_stores h JOIN inv_return_to_stores_details d ON d.rts_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, COALESCE(d.qty_returned, 0), h.return_date, 'SR', NULL AS transaction_reason
    FROM sal_returns h JOIN sal_return_details d ON d.return_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.warehouse_id, d.item_id, -COALESCE(d.qty_issued, 0), h.issue_date, 'ISSUE', NULL AS transaction_reason
    FROM inv_issue_to_requirement h JOIN inv_issue_to_requirement_details d ON d.issue_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, COALESCE(i.warehouse_id, h.branch_id), d.item_id, -COALESCE(d.quantity, 0), h.delivery_date, 'DELIVERY', NULL AS transaction_reason
    FROM sal_deliveries h 
    JOIN sal_delivery_details d ON d.delivery_id = h.id 
    LEFT JOIN sal_invoices i ON i.id = h.invoice_id 
    WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.branch_id, h.from_warehouse_id, d.item_id, -COALESCE(d.qty, 0), h.transfer_date, 'TF_OUT', NULL AS transaction_reason
    FROM inv_stock_transfers h JOIN inv_stock_transfer_details d ON d.transfer_id = h.id WHERE h.status != 'cancelled'
    UNION ALL
    SELECT h.company_id, h.to_branch_id, h.to_warehouse_id, d.item_id, COALESCE(d.received_qty, 0), h.received_date, 'TF_IN', NULL AS transaction_reason
    FROM inv_stock_transfers h JOIN inv_stock_transfer_details d ON d.transfer_id = h.id WHERE h.status IN ('received', 'completed')
    UNION ALL
    SELECT company_id, branch_id, warehouse_id, item_id, qty_change, transaction_date, transaction_type AS type, NULL AS transaction_reason
    FROM inv_stock_ledger WHERE transaction_type NOT IN ('GRN', 'STOCK_UPDATION', 'STOCK_ADJUSTMENT', 'ISSUE_TO_REQUIREMENT', 'STOCK_TRANSFER_OUT', 'STOCK_TRANSFER_IN')
  `).catch((e) => { console.error('Error creating v_inv_stock_ledger_computed', e) });

  await query(`DROP VIEW IF EXISTS v_inv_stock_summary`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_stock_summary AS
    SELECT 
      sb.company_id,
      sb.branch_id,
      sb.warehouse_id,
      sb.item_id,
      COALESCE(sb.qty, 0) AS opening_qty,
      COALESCE(sb.qty, 0) AS closing_qty,
          sb.created_at,
          u.username AS created_by_name
         FROM inv_stock_balances sb
        LEFT JOIN adm_users u ON u.id = sb.created_by
        `).catch(() => {});
  await query(`DROP VIEW IF EXISTS v_inv_issue_register`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_issue_register AS
    SELECT 
      i.company_id,
      i.branch_id,
      i.id AS issue_id,
      i.issue_no,
      i.issue_date,
      i.issue_type,
      i.warehouse_id,
      i.department_id,
      d.item_id,
      d.qty_issued,
      d.uom,
      COALESCE((
        SELECT SUM(rd.qty_returned)
         FROM inv_return_to_stores r
        JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
         WHERE r.company_id = i.company_id
          AND r.branch_id = i.branch_id
          AND rd.item_id = d.item_id
          AND (r.department_id <=> i.department_id)
          AND (r.warehouse_id <=> i.warehouse_id)
          AND r.rts_date >= i.issue_date
      ), 0) AS returned_qty,
      COALESCE(d.qty_issued, 0) - COALESCE((
        SELECT SUM(rd.qty_returned)
        FROM inv_return_to_stores r
        JOIN inv_return_to_stores_details rd ON rd.rts_id = r.id
        WHERE r.company_id = i.company_id
          AND r.branch_id = i.branch_id
          AND rd.item_id = d.item_id
          AND (r.department_id <=> i.department_id)
          AND (r.warehouse_id <=> i.warehouse_id)
          AND r.rts_date >= i.issue_date
      ), 0) AS remaining_qty,
      i.created_by,
      i.created_at,
      u.username AS created_by_name
    FROM inv_issue_to_requirement i
    JOIN inv_issue_to_requirement_details d ON d.issue_id = i.id
    LEFT JOIN adm_users u ON u.id = i.created_by
  `).catch(() => {});
  await query(`DROP VIEW IF EXISTS v_inv_material_returns`).catch(() => {});
  await query(`
    CREATE VIEW v_inv_material_returns AS
    SELECT
      r.company_id,
      r.branch_id,
      r.id AS rts_id,
      r.rts_no,
      r.rts_date,
      r.status,
      r.warehouse_id,
      r.department_id,
      d.item_id,
      d.qty_returned AS qty,
      d.uom,
      r.created_at,
      r.created_by,
      u.username AS created_by_name
     FROM inv_return_to_stores r
    JOIN inv_return_to_stores_details d ON d.rts_id = r.id
    LEFT JOIN adm_users u ON u.id = r.created_by
        `).catch(() => {});
}

async function upsertStockBalanceTx(
  conn,
  { companyId, branchId, warehouseId, itemId, deltaQty },
) {
  const [rows] = await conn.execute(
    `
    SELECT qty FROM inv_stock_balances 
     WHERE company_id = :companyId AND branch_id = :branchId
       AND warehouse_id = :warehouseId AND item_id = :itemId
     LIMIT 1
    `,
    {
      companyId: companyId || null,
      branchId: branchId || null,
      warehouseId: warehouseId || null,
      itemId: itemId || null,
    },
  );
  if (Array.isArray(rows) && rows.length) {
    await conn.execute(
      `
      UPDATE inv_stock_balances 
         SET qty = qty + :delta, updated_at = NOW()
       WHERE company_id = :companyId AND branch_id = :branchId
         AND warehouse_id = :warehouseId AND item_id = :itemId
      `,
      {
        delta: deltaQty || 0,
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: warehouseId || null,
        itemId: itemId || null,
      },
    );
  } else {
    await conn.execute(
      `
      INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
      VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
      `,
      {
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: warehouseId || null,
        itemId: itemId || null,
        qty: Math.max(0, deltaQty || 0),
      },
    );
  }
}

async function nextAdjustmentNo(companyId) {
  const rows = await query(
    `
    SELECT adjustment_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustments
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND adjustment_no LIKE 'ADJ-%'
    ORDER BY adjustment_no DESC
    LIMIT 1
    `,
    { companyId },
  ).catch(() => []);
  if (rows && rows.length) {
    const m = String(rows[0].adjustment_no || "").match(/^ADJ-(\d{6})$/);
    if (m) {
      const n = Number(m[1]) + 1;
      return `ADJ-${String(n).padStart(6, "0")}`;
    }
  }
  return "ADJ-000001";
}

export async function allocateFromBatchesTx(
  conn,
  {
    companyId,
    branchId,
    warehouseId,
    itemId,
    qty,
    refType,
    refId,
    refDate,
    preferredBatchId,
  },
) {
  let remaining = Number(qty || 0);
  if (!(remaining > 0)) return [];

  // If a preferred batch is specified, try to deduct from it first
  if (preferredBatchId) {
    const [prefBatches] = await conn.execute(
      `SELECT id, qty, cost FROM inv_item_batches WHERE id = :id AND qty > 0`,
      { id: preferredBatchId },
    );
    if (prefBatches && prefBatches.length > 0) {
      const b = prefBatches[0];
      const take = Math.min(Number(b.qty), remaining);
      await conn.execute(
        `UPDATE inv_item_batches SET qty = qty - :take WHERE id = :id`,
        { take, id: b.id },
      );
      await conn.execute(
        `
        INSERT INTO inv_batch_movements
          (company_id, branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, ref_date, remarks)
        VALUES
          (:companyId, :branchId, :itemId, :batchId, 'OUT', :qty, :refType, :refId, :refDate, 'Manual select')
        `,
        {
          companyId,
          branchId,
          itemId,
          batchId: b.id,
          qty: take,
          refType,
          refId,
          refDate,
        },
      );
      remaining -= take;
    }
  }

  if (remaining <= 0) return [];

  const [batches] = await conn.execute(
    `
    SELECT id, qty, cost FROM inv_item_batches
     WHERE company_id = :companyId AND branch_id = :branchId AND item_id = :itemId AND qty > 0
     ORDER BY COALESCE(expiry_date, '9999-12-31') ASC, COALESCE(source_date, '9999-12-31') ASC, id ASC
    `,
    {
      companyId: companyId || null,
      branchId: branchId || null,
      itemId: itemId || null,
    },
  );
  const allocations = [];
  for (const b of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(b.qty), remaining);
    if (take <= 0) continue;
    await conn.execute(
      `UPDATE inv_item_batches SET qty = qty - :take WHERE id = :id`,
      { take: take || 0, id: b?.id || null },
    );
    await conn.execute(
      `
      INSERT INTO inv_batch_movements
        (company_id, branch_id, item_id, batch_id, movement_type, qty, ref_type, ref_id, ref_date, remarks)
      VALUES
        (:companyId, :branchId, :itemId, :batchId, 'OUT', :qty, :refType, :refId, :refDate, 'FIFO consume')
      `,
      {
        companyId: companyId || null,
        branchId: branchId || null,
        itemId: itemId || null,
        batchId: b?.id || null,
        qty: take || 0,
        refType: refType || null,
        refId: refId || null,
        refDate: refDate || null,
      },
    );
    allocations.push({ batch_id: b.id, qty: take, unit_cost: b.cost });
    remaining -= take;
  }
  if (remaining > 0) {
    console.warn(
      `[BATCH_ALLOCATION] Could not fully satisfy allocation for item ${itemId}. Remaining: ${remaining}`,
    );
  }
  await upsertStockBalanceTx(conn, {
    companyId: companyId || null,
    branchId: branchId || null,
    warehouseId: warehouseId || null,
    itemId: itemId || null,
    deltaQty: -(qty || 0),
  });
  return allocations;
}

router.get(
  "/stock-adjustments/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const nextNo = await nextAdjustmentNo(companyId);
      res.json({ next_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-adjustments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name,
          a.created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustments a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Adjustment not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustment_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.adjustment_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-adjustments/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [adj] = await query(
        `
        SELECT id, adjustment_no, status,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustments
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!adj) throw httpError(404, "NOT_FOUND", "Adjustment not found");

      const existing = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_document_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND document_id = :id
          AND document_type IN ('STOCK_ADJUSTMENT', 'Stock Adjustment')
          AND status = 'PENDING'
        ORDER BY id DESC
        LIMIT 1
        `,
        { companyId, id },
      ).catch(() => []);
      if (existing.length) {
        return res.json({
          instanceId: existing[0].id,
          status: "PENDING_APPROVAL",
        });
      }

      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/stock-adjustments";

      const { activeWorkflow: activeWf } =
        await resolveWorkflowSelection({
          companyId,
          workflowIdOverride,
          docRouteBase,
          typeSynonyms: ["STOCK_ADJUSTMENT", "Stock Adjustment"],
          amount,
        });

      if (!activeWf) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );
        return res.json({ status: "APPROVED" });
      }
      const first = steps[0];

      const allowedUsers = await query(
        `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      ).catch(() => []);
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );

      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = toNumber(first.approver_user_id) || null;
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (!assignedToUserId && allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      if (!assignedToUserId) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver configured",
        );
      }

      const dwRes = await query(
        `
        INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
        VALUES
          (:companyId, :workflowId, :documentId, 'STOCK_ADJUSTMENT', :amount, :stepOrder, 'PENDING', :assignedTo)
        `,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          amount: amount === null ? null : Number(amount) || null,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `
        INSERT INTO adm_workflow_tasks
          (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
        VALUES
          (:companyId, :workflowId, :dwId, :documentId, 'STOCK_ADJUSTMENT', :stepOrder, :assignedTo, 'PENDING')
        `,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      ).catch(() => {});

      await query(
        `
        INSERT INTO adm_workflow_logs
          (document_workflow_id, step_order, action, actor_user_id, comments)
        VALUES
          (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)
        `,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user?.sub || null,
          comments: req.body?.comments || "",
        },
      ).catch(() => {});

      await query(
        `UPDATE inv_stock_adjustments
         SET status = 'PENDING_APPROVAL'
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId: assignedToUserId,
          title: "Approval Required",
          message: adj.adjustment_no
            ? `Stock Adjustment ${adj.adjustment_no} requires your approval`
            : `Stock Adjustment #${id} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      ).catch(() => {});

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const {
        adjustment_no,
        adjustment_date,
        warehouse_id,
        adjustment_type,
        reference_doc,
        reason,
        status,
        details,
      } = req.body || {};
      const adjNo = adjustment_no || (await nextAdjustmentNo(companyId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_adjustments
          (company_id, branch_id, warehouse_id, adjustment_no, adjustment_date, adjustment_type, reference_doc, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :adjNo, :adjDate, :adjustmentType, :referenceDoc, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          adjNo,
          adjDate: toDateOnly(adjustment_date || new Date().toISOString().split("T")[0]),
          adjustmentType: adjustment_type ? String(adjustment_type) : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks: reason ? String(reason) : null,
        },
      );
      const adjId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          const itemId = toNumber(r.item_id);
          const qty = Number(r.qty || 0);
          const unitCost = Number(r.unit_cost || 0);
          const uom = String(r.uom || "PCS");
          const currentStock = Number(r.current_stock || 0);
          const adjustedStock = Number(r.adjusted_stock || 0);
          await conn.execute(
            `
            INSERT INTO inv_stock_adjustment_details
              (adjustment_id, item_id, current_stock, adjusted_stock, qty, uom, unit_cost, unit_price, line_total, remarks)
            VALUES
              (:adjId, :itemId, :currentStock, :adjustedStock, :qty, :uom, :unitCost, :unitPrice, :lineTotal, :remarks)
            `,
            {
              adjId,
              itemId,
              currentStock,
              adjustedStock,
              qty,
              uom,
              unitCost,
              unitPrice: unitCost,
              lineTotal: unitCost * Math.abs(qty),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();

      // auto-approve when no active workflow (same pattern as stock updation)
      if ((status || "DRAFT") === "DRAFT") {
        try {
          const [wfRows] = await query(
            `SELECT COUNT(*) AS cnt FROM adm_workflows
             WHERE company_id = :companyId
               AND (document_route = '/inventory/stock-adjustments'
                    OR document_type IN ('STOCK_ADJUSTMENT','Stock Adjustment'))
               AND is_active = 1`,
            { companyId },
          );
          if (!wfRows?.cnt) {
            // approve
            await query(
              `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
              { id: adjId },
            );

            // move stock for each detail line
            if (Array.isArray(details) && details.length) {
              const adjConn = await pool.getConnection();
              try {
                await adjConn.beginTransaction();
                for (const r of details) {
                  const itemId = toNumber(r.item_id);
                  const qty = Number(r.qty || 0);
                  if (!itemId || !qty) continue;
                  await recordMovementTx(adjConn, {
                    companyId,
                    branchId,
                    warehouseId: toNumber(warehouse_id) || null,
                    itemId,
                    transactionType: "STOCK_ADJUSTMENT",
                    qtyChange: qty,
                    sourceRef: adjId,
                    createdBy: req.user?.sub || null,
                  });
                }
                await adjConn.commit();
              } catch (movErr) {
                await adjConn.rollback().catch(() => {});
              } finally {
                adjConn.release();
              }
            }
          }
        } catch {}
      }

      res.json({ id: adjId, adjustment_no: adjNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

// ─── Stock Updation Routes ────────────────────────────────────────────────────

router.get(
  "/stock-updation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT a.id, a.updation_no, a.updation_date, a.status,
               w.warehouse_name,
               COUNT(d.id) AS item_count,
               fu.username AS forwarded_to_username,
               (SELECT COUNT(*) FROM adm_workflows WHERE company_id = :companyId2 AND (document_route = '/inventory/stock-updation' OR document_type = 'STOCK_UPDATION') AND is_active = 1) AS has_workflow,
          a.created_at,
          cu.username AS created_by_name
         FROM inv_stock_updations a
          LEFT JOIN inv_stock_updation_details d ON d.updation_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
              WHERE status = 'PENDING'
                AND document_type = 'STOCK_UPDATION'
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
          LEFT JOIN adm_users cu ON cu.id = a.created_by
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.updation_date DESC, a.id DESC
        `,
        { companyId, branchId, companyId2: companyId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-updation/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const nextNo = await nextUpdationNo(companyId, branchId);
      res.json({ next_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-updation/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name,
          a.created_at,
          u.username AS created_by_name
         FROM inv_stock_updations a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Updation not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_stock_updation_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.updation_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-updation",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId = null } = req.scope || {};
      const {
        updation_no,
        updation_date,
        warehouse_id,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};
      const upNo = updation_no || (await nextUpdationNo(companyId, branchId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_updations
          (company_id, branch_id, warehouse_id, updation_no, updation_date, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :upNo, :upDate, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          upNo,
          upDate: toDateOnly(updation_date || new Date().toISOString().split("T")[0]),
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks: remarks || reason ? String(remarks || reason) : null,
        },
      );
      const upId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_updation_details
              (updation_id, item_id, qty, uom, batch_no, unit_cost, current_stock, remarks)
            VALUES
              (:upId, :itemId, :qty, :uom, :batchNo, :unitCost, :currentStock, :remarks)
            `,
            {
              upId,
              itemId: toNumber(r.item_id),
              qty: Number(r.qty || 0),
              uom: String(r.uom || "PCS"),
              batchNo: r.batch_no || null,
              unitCost: Number(r.unit_cost || 0),
              currentStock: Number(r.current_stock || 0),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ id: upId, updation_no: upNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-updation/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const { updation_date, warehouse_id, reason, details, remarks } =
        req.body || {};

      await conn.beginTransaction();
      await conn.execute(
        `
        UPDATE inv_stock_updations
        SET updation_date = :upDate,
            warehouse_id = :warehouseId,
            reason = :reason,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          upDate: toDateOnly(updation_date || new Date().toISOString().split("T")[0]),
          warehouseId: toNumber(warehouse_id) || null,
          reason: reason ? String(reason) : null,
          remarks: remarks || null,
        },
      );

      if (Array.isArray(details)) {
        await conn.execute(
          `DELETE FROM inv_stock_updation_details WHERE updation_id = :id`,
          { id },
        );
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_updation_details
              (updation_id, item_id, qty, uom, batch_no, unit_cost, current_stock, remarks)
            VALUES
              (:upId, :itemId, :qty, :uom, :batchNo, :unitCost, :currentStock, :remarks)
            `,
            {
              upId: id,
              itemId: toNumber(r.item_id),
              qty: Number(r.qty || 0),
              uom: String(r.uom || "PCS"),
              batchNo: r.batch_no || null,
              unitCost: Number(r.unit_cost || 0),
              currentStock: Number(r.current_stock || 0),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ success: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

async function autoApproveUpdation(id, companyId, createdBy) {
  const [upHdr] = await query(
    `SELECT id, warehouse_id, branch_id FROM inv_stock_updations WHERE id = :id AND company_id = :companyId LIMIT 1`,
    { id, companyId },
  );
  if (!upHdr) return;
  if (!upHdr.warehouse_id) {
    await query(
      `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    return;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    const [details] = await conn.execute(
      `SELECT item_id, qty, batch_no FROM inv_stock_updation_details WHERE updation_id = :id`,
      { id },
    );
    for (const d of details) {
      const itemId = Number(d.item_id);
      const qtyChange = Number(d.qty || 0);
      if (itemId && Number.isFinite(qtyChange) && qtyChange !== 0) {
        await recordMovementTx(conn, {
          companyId,
          branchId: upHdr.branch_id,
          warehouseId: upHdr.warehouse_id,
          itemId,
          transactionType: "STOCK_UPDATION",
          qtyChange,
          batchNo: d.batch_no || null,
          sourceRef: id,
          createdBy: createdBy || null,
        });
      }
    }
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

router.post(
  "/stock-updation/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockUpdationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [upd] = await query(
        `SELECT id, updation_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!upd) throw httpError(404, "NOT_FOUND", "Updation not found");

      const existing = await query(
        `SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_document_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
          AND document_id = :id
          AND document_type = 'STOCK_UPDATION'
          AND status = 'PENDING'
        ORDER BY id DESC
        LIMIT 1`,
        { companyId, id },
      ).catch(() => []);
      if (existing.length) {
        return res.json({
          instanceId: existing[0].id,
          status: "PENDING_APPROVAL",
        });
      }

      const docRouteBase = "/inventory/stock-updation";

      const { activeWorkflow: activeWf } =
        await resolveWorkflowSelection({
          companyId,
          docRouteBase,
          typeSynonyms: ["STOCK_UPDATION", "Stock Updation"],
        });

      if (!activeWf) {
        await autoApproveUpdation(id, companyId, req.user?.sub);
        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await autoApproveUpdation(id, companyId, req.user?.sub);
        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];

      const allowedUsers = await query(
        `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      ).catch(() => []);
      const allowedSet = new Set(
        allowedUsers.map((r) => Number(r.approver_user_id)),
      );

      const targetUserIdRaw = req.body?.target_user_id;
      let assignedToUserId = toNumber(first.approver_user_id) || null;
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (!assignedToUserId && allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      if (!assignedToUserId) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Workflow step 1 has no approver configured",
        );
      }

      const dwRes = await query(
        `INSERT INTO adm_document_workflows
          (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
         VALUES
          (:companyId, :workflowId, :documentId, 'STOCK_UPDATION', :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `INSERT INTO adm_workflow_tasks
          (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
         VALUES
          (:companyId, :workflowId, :dwId, :documentId, 'STOCK_UPDATION', :stepOrder, :assignedTo, 'PENDING')`,
        {
          companyId,
          workflowId: activeWf.id,
          dwId: instanceId,
          documentId: id,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      ).catch(() => {});

      await query(
        `INSERT INTO adm_workflow_logs
          (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES
          (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)`,
        {
          dwId: instanceId,
          stepOrder: first.step_order,
          actor: req.user?.sub || null,
          comments: req.body?.comments || "",
        },
      ).catch(() => {});

      await query(
        `UPDATE inv_stock_updations SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId,
          userId: assignedToUserId,
          title: "Approval Required",
          message: upd.updation_no
            ? `Stock Updation ${upd.updation_no} requires your approval`
            : `Stock Updation #${id} requires your approval`,
          link: `/administration/workflows/approvals/${instanceId}`,
        },
      ).catch(() => {});

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Stock Verification Routes ────────────────────────────────────────────────

router.get(
  "/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT a.id, a.verification_no, a.verification_date, a.verification_type, a.status,
               w.warehouse_name,
               COUNT(d.id) AS item_count,
               u.username AS forwarded_to_username,
          a.created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications a
          LEFT JOIN inv_stock_verification_details d ON d.verification_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE company_id = :companyId
                AND status = 'PENDING'
                AND (document_type = 'STOCK_VERIFICATION')
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.verification_date DESC, a.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-verification/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const nextNo = await nextVerificationNo(companyId, branchId);
      res.json({ verification_no: nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/stock-verification/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT a.*, w.warehouse_name,
          a.created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications a
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.id = :id AND a.company_id = :companyId AND a.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Verification not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_stock_verification_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.verification_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId = null } = req.scope || {};
      const {
        verification_no,
        verification_date,
        start_date,
        end_date,
        warehouse_id,
        verification_type,
        reference_doc,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};
      const verNo =
        verification_no || (await nextVerificationNo(companyId, branchId));
      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_stock_verifications
          (company_id, branch_id, warehouse_id, verification_no, verification_date, start_date, end_date, verification_type, reference_doc, reason, status, remarks)
        VALUES
          (:companyId, :branchId, :warehouseId, :verNo, :verDate, :startDate, :endDate, :verificationType, :referenceDoc, :reason, :status, :remarks)
        `,
        {
          companyId,
          branchId,
          warehouseId: toNumber(warehouse_id) || null,
          verNo,
          verDate: toDateOnly(verification_date || new Date().toISOString().split("T")[0]),
          startDate: toDateOnly(start_date) || null,
          endDate: toDateOnly(end_date) || null,
          verificationType: verification_type
            ? String(verification_type)
            : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks:
            remarks != null
              ? String(remarks)
              : reason != null
                ? String(reason)
                : null,
        },
      );
      const verId = hdr.insertId;
      if (Array.isArray(details) && details.length) {
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_verification_details
              (verification_id, item_id, system_qty, reserve_qty, counted_qty, verified_qty, variance_qty, uom, remarks)
            VALUES
              (:verId, :itemId, :systemQty, :reserveQty, :countedQty, :verifiedQty, :varianceQty, :uom, :remarks)
            `,
            {
              verId,
              itemId: toNumber(r.item_id),
              systemQty: Number(r.system_qty || 0),
              reserveQty: Number(r.reserve_qty || 0),
              countedQty: Number(r.verified_qty || r.counted_qty || 0),
              verifiedQty: Number(r.verified_qty || r.counted_qty || 0),
              varianceQty:
                r.variance_qty != null
                  ? Number(r.variance_qty || 0)
                  : Number(r.verified_qty || r.counted_qty || 0) - Number(r.system_qty || 0),
              uom: String(r.uom || "PCS"),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();

      // auto-approve when no active workflow
      if ((status || "DRAFT") === "DRAFT") {
        try {
          const [wfRows] = await query(
            `SELECT COUNT(*) AS cnt FROM adm_workflows
             WHERE company_id = :companyId
               AND (document_route = '/inventory/stock-verification'
                    OR document_type IN ('STOCK_VERIFICATION','Stock Verification'))
               AND is_active = 1`,
            { companyId },
          );
          if (!wfRows?.cnt) {
            await query(
              `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id`,
              { id: verId },
            );

            // move stock based on variance
            if (Array.isArray(details) && details.length) {
              const mvConn = await pool.getConnection();
              try {
                await mvConn.beginTransaction();
                for (const r of details) {
                  const qty = Number(r.variance_qty != null
                    ? Number(r.variance_qty || 0)
                    : Number(r.verified_qty || r.counted_qty || 0) - Number(r.system_qty || 0));
                  const itemId = toNumber(r.item_id);
                  if (!itemId || !qty) continue;
                  await recordMovementTx(mvConn, {
                    companyId,
                    branchId,
                    warehouseId: toNumber(warehouse_id) || null,
                    itemId,
                    transactionType: "STOCK_VERIFICATION",
                    qtyChange: qty,
                    sourceRef: verId,
                    createdBy: req.user?.sub || null,
                  });
                }
                await mvConn.commit();
              } catch (mvErr) {
                await mvConn.rollback().catch(() => {});
              } finally {
                mvConn.release();
              }
            }
          }
        } catch {}
      }

      res.json({ id: verId, verification_no: verNo });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.put(
  "/stock-verification/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const {
        verification_date,
        start_date,
        end_date,
        warehouse_id,
        verification_type,
        reference_doc,
        reason,
        status,
        details,
        remarks,
      } = req.body || {};

      await conn.beginTransaction();
      await conn.execute(
        `
        UPDATE inv_stock_verifications
        SET verification_date = :verDate,
            start_date = :startDate,
            end_date = :endDate,
            warehouse_id = :warehouseId,
            verification_type = :verificationType,
            reference_doc = :referenceDoc,
            reason = :reason,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id,
          companyId,
          branchId,
          verDate: toDateOnly(verification_date || new Date().toISOString().split("T")[0]),
          startDate: toDateOnly(start_date) || null,
          endDate: toDateOnly(end_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          verificationType: verification_type
            ? String(verification_type)
            : null,
          referenceDoc: reference_doc ? String(reference_doc) : null,
          reason: reason ? String(reason) : null,
          status: status || "DRAFT",
          remarks:
            remarks != null
              ? String(remarks)
              : reason != null
                ? String(reason)
                : null,
        },
      );

      if (Array.isArray(details)) {
        await conn.execute(
          `DELETE FROM inv_stock_verification_details WHERE verification_id = :id`,
          { id },
        );
        for (const r of details) {
          await conn.execute(
            `
            INSERT INTO inv_stock_verification_details
              (verification_id, item_id, system_qty, reserve_qty, counted_qty, verified_qty, variance_qty, uom, remarks)
            VALUES
              (:verId, :itemId, :systemQty, :reserveQty, :countedQty, :verifiedQty, :varianceQty, :uom, :remarks)
            `,
            {
              verId: id,
              itemId: toNumber(r.item_id),
              systemQty: Number(r.system_qty || 0),
              reserveQty: Number(r.reserve_qty || 0),
              countedQty: Number(r.verified_qty || r.counted_qty || 0),
              verifiedQty: Number(r.verified_qty || r.counted_qty || 0),
              varianceQty:
                r.variance_qty != null
                  ? Number(r.variance_qty || 0)
                  : Number(r.verified_qty || r.counted_qty || 0) - Number(r.system_qty || 0),
              uom: String(r.uom || "PCS"),
              remarks: r.remarks ? String(r.remarks) : null,
            },
          );
        }
      }
      await conn.commit();
      res.json({ success: true });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/stock-verification/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockVerificationTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [ver] = await query(
        `SELECT id, verification_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!ver) throw httpError(404, "NOT_FOUND", "Verification not found");

      const docType = "STOCK_VERIFICATION";
      const docRouteBase = "/inventory/stock-verification";

      const wfByRoute = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (document_route = :docRouteBase OR document_type = :docType) AND is_active = 1 ORDER BY id ASC`,
        { companyId, docRouteBase, docType },
      ).catch(() => []);

      let activeWf = wfByRoute[0] || null;

      if (!activeWf) {
        await query(
          `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );

        // move stock based on variance (same pattern as stock adjustment)
        try {
          const [verHdr] = await query(
            `SELECT warehouse_id, branch_id FROM inv_stock_verifications WHERE id = :id LIMIT 1`,
            { id },
          );
          const [details] = await query(
            `SELECT item_id, variance_qty FROM inv_stock_verification_details WHERE verification_id = :id`,
            { id },
          );
          if (details?.length && verHdr) {
            const mvConn = await pool.getConnection();
            try {
              await mvConn.beginTransaction();
              for (const d of details) {
                const qty = Number(d.variance_qty || 0);
                if (!d.item_id || !qty) continue;
                await recordMovementTx(mvConn, {
                  companyId,
                  branchId: verHdr.branch_id || branchId,
                  warehouseId: verHdr.warehouse_id || null,
                  itemId: d.item_id,
                  transactionType: "STOCK_VERIFICATION",
                  qtyChange: qty,
                  sourceRef: id,
                  createdBy: req.user?.sub || null,
                });
              }
              await mvConn.commit();
            } catch (mvErr) {
              await mvConn.rollback().catch(() => {});
            } finally {
              mvConn.release();
            }
          }
        } catch {}

        return res.json({ status: "APPROVED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id`,
          { id },
        );

        // move stock based on variance
        try {
          const [verHdr2] = await query(
            `SELECT warehouse_id, branch_id FROM inv_stock_verifications WHERE id = :id LIMIT 1`,
            { id },
          );
          const [details2] = await query(
            `SELECT item_id, variance_qty FROM inv_stock_verification_details WHERE verification_id = :id`,
            { id },
          );
          if (details2?.length && verHdr2) {
            const mvConn2 = await pool.getConnection();
            try {
              await mvConn2.beginTransaction();
              for (const d of details2) {
                const qty = Number(d.variance_qty || 0);
                if (!d.item_id || !qty) continue;
                await recordMovementTx(mvConn2, {
                  companyId,
                  branchId: verHdr2.branch_id || branchId,
                  warehouseId: verHdr2.warehouse_id || null,
                  itemId: d.item_id,
                  transactionType: "STOCK_VERIFICATION",
                  qtyChange: qty,
                  sourceRef: id,
                  createdBy: req.user?.sub || null,
                });
              }
              await mvConn2.commit();
            } catch (mvErr2) {
              await mvConn2.rollback().catch(() => {});
            } finally {
              mvConn2.release();
            }
          }
        } catch {}

        return res.json({ status: "APPROVED" });
      }

      const first = steps[0];
      const assignedToUserId =
        toNumber(req.body?.target_user_id) || toNumber(first.approver_user_id);

      const dwRes = await query(
        `INSERT INTO adm_document_workflows (company_id, workflow_id, document_id, document_type, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :workflowId, :documentId, :docType, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          workflowId: activeWf.id,
          documentId: id,
          docType,
          stepOrder: first.step_order,
          assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `UPDATE inv_stock_verifications SET status = 'PENDING_APPROVAL' WHERE id = :id`,
        { id },
      );

      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

// Batches list and allocation
router.get(
  "/batches",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockBalanceDetailsInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const { item_id, batch_no, expiry_from, expiry_to } = req.query || {};
      const whereParts = [
        "b.company_id = :companyId",
        "b.branch_id = :branchId",
      ];
      const params = { companyId, branchId };
      if (item_id) {
        whereParts.push("b.item_id = :itemId");
        params.itemId = Number(item_id);
      }
      if (batch_no) {
        whereParts.push("b.batch_no LIKE :batch");
        params.batch = `%${batch_no}%`;
      }
      if (expiry_from) {
        whereParts.push("b.expiry_date >= :expFrom");
        params.expFrom = expiry_from;
      }
      if (expiry_to) {
        whereParts.push("b.expiry_date <= :expTo");
        params.expTo = expiry_to;
      }
      const rows = await query(
        `
        SELECT
          b.*,
          COALESCE(b.created_by_name, 'System') AS created_by_name,
          COALESCE(b.created_at, b.entry_date) AS created_at
         FROM v_active_stock_details b
         WHERE ${whereParts.join(" AND ")}
         ORDER BY COALESCE(b.expiry_date,'9999-12-31') ASC, b.id ASC
        `,
        params,
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/batches/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const { batch_no, serial_no, expiry_date, qty } = req.body || {};

      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid batch ID");

      await query(
        `UPDATE inv_stock_balances
         SET batch_no = COALESCE(:batch_no, batch_no),
             serial_no = COALESCE(:serial_no, serial_no),
             expiry_date = :expiry_date,
             qty = COALESCE(:qty, qty)
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          batch_no: batch_no || null,
          serial_no: serial_no || null,
          expiry_date: expiry_date ? expiry_date.split("T")[0] : null,
          qty: qty !== undefined && qty !== "" ? Number(qty) : null,
        }
      );

      res.json({ success: true, message: "Batch details updated successfully" });
    } catch (e) {
      next(e);
    }
  }
);

router.get(
  "/batch-options",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const itemId = toNumber(req.query.item_id);
      const warehouseId = toNumber(req.query.warehouse_id);
      if (!itemId || !warehouseId) return res.json({ items: [] });

      const rows = await query(
        `
        SELECT batch_no,
               COALESCE(SUM(qty), 0) AS qty,
               COALESCE(SUM(reserved_qty), 0) AS reserved_qty,
               MIN(expiry_date) AS expiry_date,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_balances
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
           AND item_id = :itemId
           AND warehouse_id = :warehouseId
           AND batch_no IS NOT NULL
           AND batch_no <> ''
         GROUP BY batch_no
         ORDER BY COALESCE(MIN(expiry_date), '9999-12-31') ASC, batch_no ASC
        `,
        { companyId, itemId, warehouseId },
      );

      const items =
        (rows || []).map((r) => {
          const qty = Number(r.qty || 0);
          const reserved = Number(r.reserved_qty || 0);
          const available = qty - reserved;
          return {
            batch_no: r.batch_no,
            expiry_date: r.expiry_date || null,
            qty,
            reserved_qty: reserved,
            available_qty: available,
            available_qty_clamped: Math.max(0, available),
          };
        }) || [];

      res.json({ items });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/batches/allocate-out",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureItemBatchTables();
      const { companyId, branchId = null } = req.scope || {};
      const { item_id, qty, ref_type, ref_id, ref_date, warehouse_id } =
        req.body || {};
      if (!item_id || !qty)
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_id and qty are required",
        );
      await conn.beginTransaction();
      const allocations = await allocateFromBatchesTx(conn, {
        companyId: companyId || null,
        branchId: branchId || null,
        warehouseId: toNumber(warehouse_id) || null,
        itemId: Number(item_id) || null,
        qty: Number(qty) || 0,
        refType: ref_type ? String(ref_type).trim() || null : null,
        refId: toNumber(ref_id) || null,
        refDate: toDateOnly(ref_date || new Date().toISOString().split("T")[0]) || null,
      });
      await conn.commit();
      res.json({ allocations });
    } catch (e) {
      try {
        await conn.rollback();
      } catch {}
      next(e);
    } finally {
      conn.release();
    }
  },
);
router.get(
  "/item-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT g.id, g.group_code, g.group_name, g.parent_group_id,
               CASE WHEN g.is_active = 1 THEN 1 ELSE 0 END AS is_active,
               p.group_name AS parent_group_name,
          g.created_at,
          u.username AS created_by_name
         FROM inv_item_groups g
          LEFT JOIN inv_item_groups p ON p.id = g.parent_group_id
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.company_id = :companyId AND g.branch_id = :branchId
         ORDER BY g.group_name ASC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  ["/categories", "/item-categories"],
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT g.id, g.group_code, g.group_name, g.group_name AS category_name, g.parent_group_id,
               CASE WHEN g.is_active = 1 THEN 1 ELSE 0 END AS is_active,
               p.group_name AS parent_group_name,
          g.created_at,
          u.username AS created_by_name
         FROM inv_item_groups g
          LEFT JOIN inv_item_groups p ON p.id = g.parent_group_id
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.company_id = :companyId AND g.branch_id = :branchId
         ORDER BY g.group_name ASC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/item-groups",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const groupCode = String(body.group_code || "").trim();
      const groupName = String(body.group_name || "").trim();
      const parentGroupId = body.parent_group_id
        ? Number(body.parent_group_id)
        : null;
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!groupCode || !groupName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "group_code and group_name are required",
        );
      }

      const ins = await query(
        `INSERT INTO inv_item_groups (company_id, branch_id, group_code, group_name, parent_group_id, is_active) VALUES (:companyId, :branchId, :groupCode, :groupName, :parentGroupId, :isActive)`,
        { companyId, branchId, groupCode, groupName, parentGroupId, isActive },
      );
      res.status(201).json({ id: ins.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/item-groups/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const body = req.body || {};
      const groupCode = String(body.group_code || "").trim();
      const groupName = String(body.group_name || "").trim();
      const parentGroupId = body.parent_group_id
        ? Number(body.parent_group_id)
        : null;
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!groupCode || !groupName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "group_code and group_name are required",
        );
      }

      const upd = await query(
        `UPDATE inv_item_groups SET group_code = :groupCode, group_name = :groupName, parent_group_id = :parentGroupId, is_active = :isActive WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          groupCode,
          groupName,
          parentGroupId,
          isActive,
        },
      );

      if (!upd.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item group not found");
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/item-groups/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const del = await query(
        `DELETE FROM inv_item_groups WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      if (!del.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item group not found");
      }
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete item group because it is in use.",
          ),
        );
      }
      next(e);
    }
  },
);

// ─── Expiry monitor: runs periodically to push notifications ──────────────────
let __batchExpiryMonitorStarted = false;
async function runBatchExpiryMonitorOnce() {
  try {
    const soon = await query(`
      SELECT b.*, i.item_name,
          b.created_at,
          u.username AS created_by_name
         FROM inv_item_batches b
        LEFT JOIN inv_items i ON i.id = b.item_id
        LEFT JOIN adm_users u ON u.id = b.created_by
         WHERE b.qty > 0
         AND b.expiry_date IS NOT NULL
         AND b.expiry_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 90 DAY)
      `);
    if (!soon || !soon.length) return;
    const users = await query(`
      SELECT id, email, username, full_name,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE is_active = 1
      `).catch(() => []);
    for (const row of soon) {
      const message = `Batch ${row.batch_no} of ${row.item_name} expires on ${row.expiry_date} • Qty: ${row.qty}`;
      if (users && users.length) {
        for (const u of users) {
          await query(
            `
            INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
            VALUES (:companyId, :userId, :title, :message, :link, 0)
            `,
            {
              companyId: row.company_id,
              userId: u.id,
              title: "Batch Expiry Reminder",
              message,
              link: "/inventory/batches",
            },
          ).catch(() => {});
          try {
            if (
              isMailerConfigured() &&
              u.email &&
              /\S+@\S+\.\S+/.test(u.email)
            ) {
              await sendMail({
                to: u.email,
                subject: "Batch Expiry Reminder",
                text: message,
                html: `<p>${message}</p>`,
              });
            }
          } catch {}
        }
      } else {
        await query(
          `
          INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
          VALUES (:companyId, NULL, :title, :message, :link, 0)
          `,
          {
            companyId: row.company_id,
            title: "Batch Expiry Reminder",
            message,
            link: "/inventory/batches",
          },
        ).catch(() => {});
      }
    }
  } catch {}
}
function startBatchExpiryMonitor() {
  if (__batchExpiryMonitorStarted) return;
  __batchExpiryMonitorStarted = true;
  setInterval(runBatchExpiryMonitorOnce, 6 * 60 * 60 * 1000); // every 6 hours
  // kick off one run soon after startup
  setTimeout(runBatchExpiryMonitorOnce, 30 * 1000);
}
startBatchExpiryMonitor();

router.get(
  "/item-categories",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT c.id, c.category_code, c.category_name, c.parent_category_id,
               CASE WHEN c.is_active = 1 THEN 1 ELSE 0 END AS is_active,
               p.category_name AS parent_category_name,
          c.created_at,
          u.username AS created_by_name
         FROM inv_item_categories c
          LEFT JOIN inv_item_categories p ON p.id = c.parent_category_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId AND c.branch_id = :branchId
         ORDER BY c.category_name ASC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/item-categories",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const categoryCode = String(body.category_code || "").trim();
      const categoryName = String(body.category_name || "").trim();
      const parentCategoryId = body.parent_category_id
        ? Number(body.parent_category_id)
        : null;
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!categoryCode || !categoryName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "category_code and category_name are required",
        );
      }

      const ins = await query(
        `INSERT INTO inv_item_categories (company_id, branch_id, category_code, category_name, parent_category_id, is_active) VALUES (:companyId, :branchId, :categoryCode, :categoryName, :parentCategoryId, :isActive)`,
        {
          companyId,
          branchId,
          categoryCode,
          categoryName,
          parentCategoryId,
          isActive,
        },
      );
      res.status(201).json({ id: ins.insertId });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/item-categories/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const body = req.body || {};
      const categoryCode = String(body.category_code || "").trim();
      const categoryName = String(body.category_name || "").trim();
      const parentCategoryId = body.parent_category_id
        ? Number(body.parent_category_id)
        : null;
      const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;

      if (!categoryCode || !categoryName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "category_code and category_name are required",
        );
      }

      const upd = await query(
        `UPDATE inv_item_categories SET category_code = :categoryCode, category_name = :categoryName, parent_category_id = :parentCategoryId, is_active = :isActive WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        {
          id,
          companyId,
          branchId,
          categoryCode,
          categoryName,
          parentCategoryId,
          isActive,
        },
      );

      if (!upd.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item category not found");
      }
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/item-categories/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureItemGroupTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      const del = await query(
        `DELETE FROM inv_item_categories WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      if (!del.affectedRows) {
        throw httpError(404, "NOT_FOUND", "Item category not found");
      }
      res.json({ ok: true });
    } catch (e) {
      if (e.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete item category because it is in use.",
          ),
        );
      }
      next(e);
    }
  },
);

// Stock adjustments (shared by multiple screens)
async function ensureStockAdjustmentTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustments (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      adjustment_no VARCHAR(50) NOT NULL,
      adjustment_date DATE NOT NULL,
      adjustment_type VARCHAR(30) NULL,
      reference_doc VARCHAR(100) NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_adj_no (company_id, branch_id, adjustment_no)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_adjustment_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      adjustment_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      current_stock DECIMAL(18,3) DEFAULT 0,
      adjusted_stock DECIMAL(18,3) DEFAULT 0,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_no VARCHAR(100),
      unit_cost DECIMAL(18,4) DEFAULT 0,
      unit_price DECIMAL(18,4) DEFAULT 0,
      line_total DECIMAL(18,4) DEFAULT 0,
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_adj (adjustment_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});

  if (!(await hasColumn("inv_stock_adjustments", "warehouse_id"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN warehouse_id BIGINT UNSIGNED NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "adjustment_type"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN adjustment_type VARCHAR(30) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "reference_doc"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN reference_doc VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "reason"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN reason TEXT NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustments", "remarks"))) {
    await query(
      `ALTER TABLE inv_stock_adjustments ADD COLUMN remarks TEXT`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "current_stock"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN current_stock DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "adjusted_stock"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN adjusted_stock DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "uom"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN uom VARCHAR(20) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "remarks"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN remarks VARCHAR(255) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "batch_no"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN batch_no VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "unit_cost"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN unit_cost DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "unit_price"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN unit_price DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_adjustment_details", "line_total"))) {
    await query(
      `ALTER TABLE inv_stock_adjustment_details ADD COLUMN line_total DECIMAL(18,4) NULL`,
    ).catch(() => {});
  }
}

async function ensureStockUpdationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_updations (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      updation_no VARCHAR(50) NOT NULL,
      updation_date DATE NOT NULL,
      reason TEXT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_upd_no (company_id, branch_id, updation_no)
    )
  `).catch(() => {});
  try { await query("ALTER TABLE inv_stock_updations MODIFY COLUMN warehouse_id BIGINT UNSIGNED NULL"); } catch {}

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_updation_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      updation_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_no VARCHAR(100),
      unit_cost DECIMAL(18,4) DEFAULT 0,
      current_stock DECIMAL(18,3) DEFAULT 0,
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_upd (updation_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});
  try { await query("ALTER TABLE inv_stock_updation_details ADD COLUMN current_stock DECIMAL(18,3) DEFAULT 0 AFTER unit_cost"); } catch {}
}

async function nextUpdationNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT updation_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND updation_no LIKE 'UPD-%'
    ORDER BY CAST(SUBSTRING(updation_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].updation_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `UPD-${String(nextNum).padStart(6, "0")}`;
}

async function ensureStockVerificationTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_verifications (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      verification_no VARCHAR(50) NOT NULL,
      verification_date DATE NOT NULL,
      start_date DATE NULL,
      end_date DATE NULL,
      verification_type VARCHAR(30) NULL,
      reference_doc VARCHAR(100) NULL,
      reason TEXT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks TEXT,
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_ver_no (company_id, branch_id, verification_no),
      KEY idx_ver_wh (warehouse_id)
    )
  `).catch(() => {});
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_verification_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      verification_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      system_qty DECIMAL(18,3) DEFAULT 0,
      reserve_qty DECIMAL(18,3) DEFAULT 0,
      counted_qty DECIMAL(18,3) DEFAULT 0,
      variance_qty DECIMAL(18,3) DEFAULT 0,
      uom VARCHAR(20) DEFAULT 'PCS',
      remarks VARCHAR(255) DEFAULT NULL,
      KEY idx_ver (verification_id),
      KEY idx_item (item_id)
    )
  `).catch(() => {});
  try { await query("ALTER TABLE inv_stock_verification_details ADD COLUMN reserve_qty DECIMAL(18,3) DEFAULT 0 AFTER system_qty"); } catch {}
  try { await query("ALTER TABLE inv_stock_verification_details ADD COLUMN verified_qty DECIMAL(18,3) NULL AFTER counted_qty"); } catch {}

  if (!(await hasColumn("inv_stock_verifications", "start_date"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN start_date DATE NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "end_date"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN end_date DATE NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "verification_type"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN verification_type VARCHAR(30) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "reference_doc"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN reference_doc VARCHAR(100) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verifications", "status"))) {
    await query(
      `ALTER TABLE inv_stock_verifications ADD COLUMN status VARCHAR(30) NOT NULL DEFAULT 'DRAFT'`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "system_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN system_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "counted_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN counted_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "variance_qty"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN variance_qty DECIMAL(18,3) NULL`,
    ).catch(() => {});
  }
  if (!(await hasColumn("inv_stock_verification_details", "uom"))) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN uom VARCHAR(20) NULL`,
    ).catch(() => {});
  }
}

async function nextVerificationNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT verification_no,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND verification_no LIKE 'SV-%'
    ORDER BY CAST(SUBSTRING(verification_no, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].verification_no || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `SV-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const limit = Math.max(1, parseInt(req.query.limit || "50", 10));
      const offset = (page - 1) * limit;

      const countSql = `SELECT COUNT(*) AS total FROM inv_stock_adjustments a WHERE a.company_id = :companyId AND a.branch_id = :branchId`;
      const countRes = await query(countSql, { companyId, branchId });
      const total = Number(countRes[0]?.total || 0);

      const rows = await query(
        `
        SELECT a.id, a.adjustment_no, a.adjustment_date, a.status,
               MAX(a.adjustment_type) AS adjustment_type,
               MAX(w.warehouse_name) AS warehouse_name,
               COUNT(d.id) AS item_count,
               (SELECT COUNT(*) FROM adm_workflows WHERE company_id = :companyId2 AND (document_route = '/inventory/stock-adjustments' OR document_type IN ('STOCK_ADJUSTMENT','Stock Adjustment')) AND is_active = 1) AS has_workflow,
               fu.username AS forwarded_to_username,
          a.created_at,
          cu.username AS created_by_name
         FROM inv_stock_adjustments a
          LEFT JOIN inv_stock_adjustment_details d ON d.adjustment_id = a.id
          LEFT JOIN inv_warehouses w ON w.id = a.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
            FROM adm_document_workflows t
            JOIN (
              SELECT document_id, MAX(id) AS max_id
              FROM adm_document_workflows
               WHERE company_id = :companyId3
                 AND status = 'PENDING'
                 AND (document_type IN ('STOCK_ADJUSTMENT','Stock Adjustment'))
              GROUP BY document_id
            ) m ON m.max_id = t.id
          ) x ON x.document_id = a.id
          LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
          LEFT JOIN adm_users cu ON cu.id = a.created_by
         WHERE a.company_id = :companyId AND a.branch_id = :branchId
         GROUP BY a.id
         ORDER BY a.adjustment_date DESC, a.id DESC LIMIT :limit OFFSET :offset
        `,
         { companyId, branchId, companyId2: companyId, companyId3: companyId, limit, offset },
       );
       res.json({ 
         items: rows || [],
         pagination: {
           page,
           pageSize: limit,
           total,
           totalPages: Math.ceil(total / limit)
         }
       });
     } catch (e) {
       next(e);
     }
   },
);

// Stock transfers list
router.get(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const { companyId, branchId = null } = req.scope || {};
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const limit = Math.max(1, parseInt(req.query.limit || "50", 10));
      const offset = (page - 1) * limit;

      const countSql = `SELECT COUNT(*) AS total FROM inv_stock_transfers t WHERE t.company_id = :companyId AND t.branch_id = :branchId`;
      const countRes = await query(countSql, { companyId, branchId });
      const total = Number(countRes[0]?.total || 0);

      const rows = await query(
        `
        SELECT t.id, t.transfer_no, t.transfer_date, t.status,
               t.from_branch_id, t.to_branch_id,
               t.from_warehouse_id, t.to_warehouse_id,
               fb.name AS from_branch,
               tb.name AS to_branch,
               fw.warehouse_name AS from_warehouse,
               tw.warehouse_name AS to_warehouse,
               COUNT(d.id) AS item_count,
          t.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfers t
          LEFT JOIN inv_stock_transfer_details d ON d.transfer_id = t.id
          LEFT JOIN adm_branches fb ON fb.id = t.from_branch_id
          LEFT JOIN adm_branches tb ON tb.id = t.to_branch_id
          LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
          LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.company_id = :companyId AND t.branch_id = :branchId
         GROUP BY t.id
         ORDER BY t.transfer_date DESC, t.id DESC LIMIT :limit OFFSET :offset
        `,
        { companyId, branchId, limit, offset },
      );
      res.json({ 
        items: rows || [],
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      next(e);
    }
  },
);

// Get available stock for a specific item and warehouse
router.get(
  "/stock/balance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const itemId = toNumber(req.query.item_id);
      const warehouseId = toNumber(req.query.warehouse_id);
      const batchNo = req.query.batch_no ? String(req.query.batch_no) : null;

      if (!itemId || !warehouseId) {
        return res.json({
          available: 0,
          available_clamped: 0,
          qty: 0,
          reserved: 0,
        });
      }

      const rows = await query(
        `
        SELECT COALESCE(SUM(qty), 0) AS qty,
               COALESCE(SUM(reserved_qty), 0) AS reserved_qty,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_balances
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
           AND item_id = :itemId
           AND warehouse_id = :warehouseId
           AND (:batchNo IS NULL OR batch_no = :batchNo)
        `,
        { companyId, itemId, warehouseId, batchNo },
      );

      if (!rows || rows.length === 0) {
        return res.json({
          available: 0,
          available_clamped: 0,
          qty: 0,
          reserved: 0,
        });
      }

      const qty = Number(rows[0].qty || 0);
      const reserved = Number(rows[0].reserved_qty || 0);
      const available = qty - reserved;
      res.json({
        qty,
        reserved,
        available,
        available_clamped: Math.max(0, available),
      });
    } catch (e) {
      next(e);
    }
  },
);

// ─── GRN alias endpoints for Inventory module UI ──────────────────────────────
router.get(
  "/grn/po-summary",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT pt.po_id, pt.total_ordered, COALESCE(gt.total_accepted,0) AS total_accepted
         FROM (
           SELECT pod.po_id, SUM(pod.qty) AS total_ordered
             FROM pur_order_details pod
            WHERE pod.po_id IN (
              SELECT id FROM pur_orders
               WHERE company_id = :companyId AND branch_id = :branchId
            )
            GROUP BY pod.po_id
         ) pt
         LEFT JOIN (
           SELECT g.po_id, SUM(d.qty_accepted) AS total_accepted
             FROM inv_goods_receipt_note_details d
             JOIN inv_goods_receipt_notes g ON g.id = d.grn_id
            WHERE g.company_id = :companyId
              AND g.branch_id = :branchId
              AND g.po_id IS NOT NULL
              AND g.status NOT IN ('DRAFT')
            GROUP BY g.po_id
         ) gt ON gt.po_id = pt.po_id
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  cacheListResponse(30),
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const grnType = String(req.query?.grn_type || "").toUpperCase() || null;
      let where = "WHERE g.company_id = :companyId AND g.branch_id = :branchId";
      const params = { companyId, branchId };
      if (grnType) {
        where += " AND g.grn_type = :grnType";
        params.grnType = grnType;
      }
      const page = Math.max(1, parseInt(req.query.page || "1", 10));
      const limit = Math.max(1, parseInt(req.query.limit || "50", 10));
      const offset = (page - 1) * limit;

      let countSql = `SELECT COUNT(*) AS total FROM inv_goods_receipt_notes g ${where}`;
      const countRes = await query(countSql, params);
      const total = Number(countRes[0]?.total || 0);

      params.limit = limit;
      params.offset = offset;

      const rows = await query(
        `
        SELECT g.id, g.grn_no, g.grn_date, g.grn_type, g.status,
               s.supplier_name, w.warehouse_name,
               u_appr.username AS forwarded_to_username,
               u_creator.username AS created_by_name,
               g.created_at
         FROM inv_goods_receipt_notes g
          LEFT JOIN pur_suppliers s ON s.id = g.supplier_id
          LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
          LEFT JOIN (
            SELECT t.document_id, t.assigned_to_user_id
              FROM adm_document_workflows t
              JOIN (
                SELECT document_id, MAX(id) AS max_id
                  FROM adm_document_workflows
                  WHERE company_id = :companyId
                    AND status = 'PENDING'
                    AND (document_type IN ('GRN','GOODS_RECEIPT','GOODS_RECEIPT_NOTE'))
                  GROUP BY document_id
              ) m ON m.max_id = t.id
          ) x ON x.document_id = g.id
          LEFT JOIN adm_users u_appr ON u_appr.id = x.assigned_to_user_id
          LEFT JOIN adm_users u_creator ON u_creator.id = g.created_by
         ${where}
         ORDER BY g.grn_date DESC, g.id DESC LIMIT :limit OFFSET :offset
        `,
        params,
      );
      res.json({ 
        items: rows || [],
        pagination: {
          page,
          pageSize: limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT g.*, s.supplier_name, w.warehouse_name,
          g.created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_notes g
          LEFT JOIN pur_suppliers s ON s.id = g.supplier_id
          LEFT JOIN inv_warehouses w ON w.id = g.warehouse_id
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.id = :id AND g.company_id = :companyId AND g.branch_id = :branchId
         LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "GRN not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_note_details d
          LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.grn_id = :id
         ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: { ...hdr, details: details || [] } });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/grn",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub);

      const payload = req.body;
      const grn_type = String(payload.grn_type || "LOCAL").toUpperCase();
      const autoCreateBill = Boolean(payload.auto_create_bill);
      let grn_no = payload.grn_no;

      await conn.beginTransaction();

      if (!grn_no) {
        grn_no = await nextGRNNo(companyId, branchId, grn_type);
      }

      const status = "DRAFT";

      const [hdrRes] = await conn.execute(
        `INSERT INTO inv_goods_receipt_notes (
          company_id, branch_id, grn_no, grn_date, grn_type, status,
          auto_create_bill,
          supplier_id, warehouse_id, po_id, port_clearance_id,
          invoice_no, invoice_date, invoice_amount, invoice_due_date,
          delivery_number, delivery_date, bill_of_lading, customs_entry_no,
          shipping_company, port_of_entry, remarks, created_by
        ) VALUES (
          :companyId, :branchId, :grn_no, :grn_date, :grn_type, :status,
          :auto_create_bill,
          :supplier_id, :warehouse_id, :po_id, :port_clearance_id,
          :invoice_no, :invoice_date, :invoice_amount, :invoice_due_date,
          :delivery_number, :delivery_date, :bill_of_lading, :customs_entry_no,
          :shipping_company, :port_of_entry, :remarks, :userId
        )`,
        {
          companyId,
          branchId,
          grn_no,
          grn_date: payload.grn_date || null,
          grn_type,
          status,
          auto_create_bill: autoCreateBill ? 1 : 0,
          supplier_id: payload.supplier_id || null,
          warehouse_id: payload.warehouse_id || null,
          po_id: payload.po_id || null,
          port_clearance_id: payload.port_clearance_id || null,
          invoice_no: payload.invoice_no || null,
          invoice_date: payload.invoice_date || null,
          invoice_amount: payload.invoice_amount || null,
          invoice_due_date: payload.invoice_due_date || null,
          delivery_number: payload.delivery_number || null,
          delivery_date: payload.delivery_date || null,
          bill_of_lading: payload.bill_of_lading || null,
          customs_entry_no: payload.customs_entry_no || null,
          shipping_company: payload.shipping_company || null,
          port_of_entry: payload.port_of_entry || null,
          remarks: payload.remarks || null,
          userId,
        },
      );

      const grnId = hdrRes.insertId;

      const details = Array.isArray(payload.details) ? payload.details : [];
      for (const d of details) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details (
            grn_id, item_id, qty_ordered, qty_received, qty_accepted,
            input_qty, input_uom, uom, unit_price, line_amount,
            batch_serial, mfg_date, expiry_date, inspection_status, remarks, created_by
          ) VALUES (
            :grn_id, :item_id, :qty_ordered, :qty_received, :qty_accepted,
            :input_qty, :input_uom, :uom, :unit_price, :line_amount,
            :batch_serial, :mfg_date, :expiry_date, :inspection_status, :remarks, :userId
          )`,
          {
            grn_id: grnId,
            item_id: d.item_id || null,
            qty_ordered: d.qty_ordered || null,
            qty_received: d.qty_received || null,
            qty_accepted: d.qty_accepted || null,
            input_qty: d.input_qty || null,
            input_uom: d.input_uom || null,
            uom: d.uom || null,
            unit_price: d.unit_price || null,
            line_amount: d.line_amount || null,
            batch_serial: d.batch_serial || null,
            mfg_date: d.mfg_date || null,
            expiry_date: d.expiry_date || null,
            inspection_status: d.inspection_status || "PENDING",
            remarks: d.remarks || null,
            userId,
          },
        );
      }

      let autoBill = null;
      if (autoCreateBill && payload.po_id) {
        autoBill = await createPurchaseBillFromGrnTx(conn, {
          companyId,
          branchId,
          grnId,
          poId: Number(payload.po_id || 0) || null,
          supplierId: Number(payload.supplier_id || 0) || null,
          grnDate: payload.grn_date || null,
          grnType: grn_type,
          userId,
        });
      }

      await conn.commit();
      res.status(201).json({
        id: grnId,
        grn_no,
        bill_id: autoBill?.id || null,
        bill_no: autoBill?.bill_no || null,
      });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.put(
  "/grn/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      const userId = toNumber(req.scope?.userId ?? req.user?.sub);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const payload = req.body;

      const [curr] = await conn.execute(
        `SELECT status FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!curr.length) throw httpError(404, "NOT_FOUND", "GRN not found");
      if (curr[0].status !== "DRAFT") {
        throw httpError(400, "BAD_REQUEST", "Can only edit DRAFT GRNs");
      }

      await conn.beginTransaction();

      await conn.execute(
        `UPDATE inv_goods_receipt_notes SET
          supplier_id = :supplier_id,
          warehouse_id = :warehouse_id,
          po_id = :po_id,
          port_clearance_id = :port_clearance_id,
          invoice_no = :invoice_no,
          invoice_date = :invoice_date,
          invoice_amount = :invoice_amount,
          invoice_due_date = :invoice_due_date,
          delivery_number = :delivery_number,
          delivery_date = :delivery_date,
          bill_of_lading = :bill_of_lading,
          customs_entry_no = :customs_entry_no,
          shipping_company = :shipping_company,
          port_of_entry = :port_of_entry,
          remarks = :remarks
          , auto_create_bill = :auto_create_bill
        WHERE id = :id`,
        {
          id,
          supplier_id: payload.supplier_id || null,
          warehouse_id: payload.warehouse_id || null,
          po_id: payload.po_id || null,
          port_clearance_id: payload.port_clearance_id || null,
          invoice_no: payload.invoice_no || null,
          invoice_date: payload.invoice_date || null,
          invoice_amount: payload.invoice_amount || null,
          invoice_due_date: payload.invoice_due_date || null,
          delivery_number: payload.delivery_number || null,
          delivery_date: payload.delivery_date || null,
          bill_of_lading: payload.bill_of_lading || null,
          customs_entry_no: payload.customs_entry_no || null,
          shipping_company: payload.shipping_company || null,
          port_of_entry: payload.port_of_entry || null,
          remarks: payload.remarks || null,
          auto_create_bill: payload.auto_create_bill ? 1 : 0,
        },
      );

      await conn.execute(
        `DELETE FROM inv_goods_receipt_note_details WHERE grn_id = :id`,
        { id },
      );

      const details = Array.isArray(payload.details) ? payload.details : [];
      for (const d of details) {
        await conn.execute(
          `INSERT INTO inv_goods_receipt_note_details (
            grn_id, item_id, qty_ordered, qty_received, qty_accepted,
            input_qty, input_uom, uom, unit_price, line_amount,
            batch_serial, mfg_date, expiry_date, inspection_status, remarks, created_by
          ) VALUES (
            :grn_id, :item_id, :qty_ordered, :qty_received, :qty_accepted,
            :input_qty, :input_uom, :uom, :unit_price, :line_amount,
            :batch_serial, :mfg_date, :expiry_date, :inspection_status, :remarks, :userId
          )`,
          {
            grn_id: id,
            item_id: d.item_id || null,
            qty_ordered: d.qty_ordered || null,
            qty_received: d.qty_received || null,
            qty_accepted: d.qty_accepted || null,
            input_qty: d.input_qty || null,
            input_uom: d.input_uom || null,
            uom: d.uom || null,
            unit_price: d.unit_price || null,
            line_amount: d.line_amount || null,
            batch_serial: d.batch_serial || null,
            mfg_date: d.mfg_date || null,
            expiry_date: d.expiry_date || null,
            inspection_status: d.inspection_status || "PENDING",
            remarks: d.remarks || null,
            userId,
          },
        );
      }

      let autoBill = null;
      if (payload.auto_create_bill && payload.po_id) {
        const [hdrRows] = await conn.execute(
          `SELECT grn_date, grn_type, supplier_id
             FROM inv_goods_receipt_notes
            WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
            LIMIT 1`,
          { id, companyId, branchId },
        );
        const hdr = hdrRows?.[0] || {};
        autoBill = await createPurchaseBillFromGrnTx(conn, {
          companyId,
          branchId,
          grnId: id,
          poId: Number(payload.po_id || 0) || null,
          supplierId:
            Number(hdr.supplier_id || payload.supplier_id || 0) || null,
          grnDate: hdr.grn_date || payload.grn_date || null,
          grnType: hdr.grn_type || payload.grn_type || "LOCAL",
          userId,
        });
      }

      await conn.commit();
      res.json({
        id,
        bill_id: autoBill?.id || null,
        bill_no: autoBill?.bill_no || null,
      });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.post(
  "/grn/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      const userId = toNumber(req.scope?.userId ?? req.user?.sub);
      const { amount, workflow_id, target_user_id } = req.body;

      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [curr] = await conn.execute(
        `SELECT status, grn_no FROM inv_goods_receipt_notes WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      if (!curr.length) throw httpError(404, "NOT_FOUND", "GRN not found");
      if (curr[0].status !== "DRAFT") {
        throw httpError(400, "BAD_REQUEST", "Can only submit DRAFT GRNs");
      }

      await conn.beginTransaction();

      let finalStatus = "APPROVED"; // By default auto-approve if no workflow
      if (workflow_id) {
        const [steps] = await conn.execute(
          `SELECT step_order, approver_user_id
             FROM adm_workflow_steps
            WHERE workflow_id = :workflowId
            ORDER BY step_order ASC
            LIMIT 1`,
          { workflowId: workflow_id },
        );
        if (!steps.length) {
          throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
        }

        const firstStep = steps[0];
        const [allowedUsers] = await conn.execute(
          `SELECT approver_user_id
             FROM adm_workflow_step_approvers
            WHERE workflow_id = :workflowId AND step_order = :stepOrder`,
          { workflowId: workflow_id, stepOrder: firstStep.step_order },
        );
        const allowedSet = new Set(
          allowedUsers.map((r) => Number(r.approver_user_id)),
        );
        let assignedToUserId = toNumber(firstStep.approver_user_id);
        if (target_user_id != null && allowedSet.has(Number(target_user_id))) {
          assignedToUserId = Number(target_user_id);
        } else if (allowedUsers.length > 0) {
          assignedToUserId = Number(allowedUsers[0].approver_user_id);
        }
        if (!assignedToUserId) {
          throw httpError(
            400,
            "BAD_REQUEST",
            "Workflow step 1 has no approver configured",
          );
        }

        const [wfRes] = await conn.execute(
          `INSERT INTO adm_document_workflows (
            company_id, workflow_id, document_type, document_id, amount, current_step_order, status, assigned_to_user_id
          ) VALUES (
            :companyId, :workflowId, 'GRN', :documentId, :amount, :stepOrder, 'PENDING', :assignedTo
          )`,
          {
            companyId,
            workflowId: workflow_id,
            documentId: id,
            amount: amount == null ? null : Number(amount),
            stepOrder: firstStep.step_order,
            assignedTo: assignedToUserId,
          },
        );

        await conn.execute(
          `INSERT INTO adm_workflow_tasks (
            company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action
          ) VALUES (
            :companyId, :workflowId, :dwId, :documentId, 'GRN', :stepOrder, :assignedTo, 'PENDING'
          )`,
          {
            companyId,
            workflowId: workflow_id,
            dwId: wfRes.insertId,
            documentId: id,
            stepOrder: firstStep.step_order,
            assignedTo: assignedToUserId,
          },
        );

        await conn.execute(
          `INSERT INTO adm_workflow_logs (
            document_workflow_id, step_order, action, actor_user_id, comments
          ) VALUES (
            :dwId, :stepOrder, 'SUBMIT', :userId, ''
          )`,
          { dwId: wfRes.insertId, stepOrder: firstStep.step_order, userId },
        );

        finalStatus = "PENDING_APPROVAL";
      }

      await conn.execute(
        `UPDATE inv_goods_receipt_notes SET status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { status: finalStatus, id, companyId, branchId },
      );

      await conn.commit();
      res.json({ id, status: finalStatus });
    } catch (err) {
      if (conn) await conn.rollback();
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.post(
  "/grn/:id/cancel-accounting",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      await query(
        `UPDATE inv_goods_receipt_notes SET status = 'CANCELLED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Issue to Requirement Area ────────────────────────────────────────────────
async function ensureIssueToRequirementTables() {
  // Tables should already exist, but ensure they do for safety
  await query(`
    CREATE TABLE IF NOT EXISTS inv_issue_to_requirement (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      issue_no VARCHAR(50) NOT NULL,
      issue_date DATE NOT NULL,
      warehouse_id BIGINT UNSIGNED DEFAULT NULL,
      issued_to VARCHAR(255) DEFAULT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      remarks VARCHAR(500) DEFAULT NULL,
      created_by BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      department_id BIGINT UNSIGNED DEFAULT NULL,
      issue_type VARCHAR(50) DEFAULT 'GENERAL',
      requisition_id BIGINT UNSIGNED DEFAULT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_issue_scope_no (company_id, branch_id, issue_no),
      KEY idx_issue_scope (company_id, branch_id),
      KEY fk_issue_warehouse (warehouse_id),
      KEY fk_issue_created_by (created_by),
      CONSTRAINT fk_issue_company FOREIGN KEY (company_id) REFERENCES adm_companies (id),
      CONSTRAINT fk_issue_branch FOREIGN KEY (branch_id) REFERENCES adm_branches (id),
      CONSTRAINT fk_issue_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses (id),
      CONSTRAINT fk_issue_created_by FOREIGN KEY (created_by) REFERENCES adm_users (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});

  await query(`ALTER TABLE inv_issue_to_requirement ADD COLUMN IF NOT EXISTS requisition_source VARCHAR(20) DEFAULT 'inventory' AFTER requisition_id`).catch(() => {});

  await query(`
    CREATE TABLE IF NOT EXISTS inv_issue_to_requirement_details (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      issue_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      qty_issued DECIMAL(18,3) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      uom VARCHAR(20) DEFAULT 'PCS',
      batch_number VARCHAR(100) DEFAULT NULL,
      serial_number VARCHAR(100) DEFAULT NULL,
      PRIMARY KEY (id),
      KEY idx_issued_issue (issue_id),
      KEY fk_issued_item (item_id),
      CONSTRAINT fk_issued_issue FOREIGN KEY (issue_id) REFERENCES inv_issue_to_requirement (id) ON DELETE CASCADE,
      CONSTRAINT fk_issued_item FOREIGN KEY (item_id) REFERENCES inv_items (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `).catch(() => {});
}

async function nextIssueNo(companyId, branchId) {
  const rows = await query(
    `
    SELECT issue_no
         FROM inv_issue_to_requirement
         WHERE company_id = :companyId
      AND branch_id = :branchId
      AND issue_no LIKE 'ISS-%'
    ORDER BY CAST(SUBSTRING(issue_no, 5) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].issue_no || "");
    const numPart = prev.slice(4);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `ISS-${String(nextNum).padStart(6, "0")}`;
}

// GET list of issues
router.get(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.issued_to,
               i.department_id, i.status, i.remarks, i.issue_type,
               i.requisition_id, i.created_by, i.created_at, i.updated_at,
               w.warehouse_name, d.name AS department_name,
               COALESCE(u.username, ru.username) AS created_by_name
         FROM inv_issue_to_requirement i
        LEFT JOIN inv_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN adm_departments d ON d.id = i.department_id
        LEFT JOIN inv_material_requisitions r ON r.id = i.requisition_id
        LEFT JOIN adm_users u ON u.id = i.created_by
        LEFT JOIN adm_users ru ON ru.id = r.created_by
         WHERE i.company_id = :companyId AND i.branch_id = :branchId
        ORDER BY i.issue_date DESC, i.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// GET single issue
router.get(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReportingViews();
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [hdr] = await query(
        `
        SELECT i.*, w.warehouse_name, d.name AS department_name, u.username AS created_by_username,
          i.created_at,
          COALESCE(u.username, ru.username) AS created_by_name
         FROM inv_issue_to_requirement i
        LEFT JOIN inv_warehouses w ON w.id = i.warehouse_id
        LEFT JOIN adm_departments d ON d.id = i.department_id
        LEFT JOIN inv_material_requisitions r ON r.id = i.requisition_id
        LEFT JOIN adm_users u ON u.id = i.created_by
        LEFT JOIN adm_users ru ON ru.id = r.created_by
         WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Issue not found");

      const details = await query(
        `
        SELECT 
          d.*, 
          iv.item_code, 
          iv.item_name, 
          iv.uom as item_uom,
          v.returned_qty,
          v.remaining_qty
         FROM inv_issue_to_requirement_details d
        LEFT JOIN inv_items iv ON iv.id = d.item_id
        LEFT JOIN v_inv_issue_register v 
          ON v.issue_id = :id AND v.item_id = d.item_id
         WHERE d.issue_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

// POST create new issue
router.post(
  "/issue-to-requirement",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId, userId } = req.scope;
      const {
        issue_date,
        warehouse_id,
        issued_to,
        department_id,
        issue_type,
        requisition_id,
        requisition_source,
        status,
        remarks,
        details = [],
      } = req.body;

      // Validate required fields
      if (!issue_date)
        throw httpError(400, "VALIDATION_ERROR", "issue_date is required");
      if (!Array.isArray(details))
        throw httpError(400, "VALIDATION_ERROR", "details must be an array");

      // Generate issue number
      const issueNo = await nextIssueNo(companyId, branchId);

      // Insert header
      const result = await query(
        `
        INSERT INTO inv_issue_to_requirement
        (company_id, branch_id, issue_no, issue_date, warehouse_id, issued_to,
         department_id, issue_type, requisition_id, requisition_source, status, remarks, created_by)
        VALUES (:companyId, :branchId, :issueNo, :issueDate, :warehouseId, :issuedTo,
                :departmentId, :issueType, :requisitionId, :requisitionSource, :status, :remarks, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          issueNo: issueNo || null,
          issueDate: toDateOnly(issue_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          issuedTo: issued_to ? String(issued_to).trim() || null : null,
          departmentId: toNumber(department_id) || null,
          issueType:
            (issue_type ? String(issue_type).trim() : null) || "GENERAL",
          requisitionId: toNumber(requisition_id) || null,
          requisitionSource: (requisition_source ? String(requisition_source).trim() : null) || "inventory",
          status: (status ? String(status).trim() : null) || "DRAFT",
          remarks: remarks ? String(remarks).trim() || null : null,
          createdBy: userId || null,
        },
      );

      const issueId = result.insertId;

      // Insert details
      for (const line of details) {
        if (line.item_id && Number(line.qty_issued || 0) > 0) {
          await query(
            `
            INSERT INTO inv_issue_to_requirement_details
            (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
            VALUES (:issueId, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
            `,
            {
              issueId: issueId || null,
              itemId: toNumber(line.item_id) || null,
              qtyIssued: Number(line.qty_issued || 0) || 0,
              uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
              batchNumber: line.batch_number
                ? String(line.batch_number).trim() || null
                : null,
              serialNumber: line.serial_number
                ? String(line.serial_number).trim() || null
                : null,
            },
          );
        }
      }

      res.status(201).json({ id: issueId, issue_no: issueNo });
    } catch (e) {
      next(e);
    }
  },
);

// PUT update issue
router.put(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const {
        issue_date,
        warehouse_id,
        issued_to,
        department_id,
        issue_type,
        requisition_id,
        requisition_source,
        status,
        remarks,
        details = [],
      } = req.body;

      // Check if issue exists
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_issue_to_requirement
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");

      // Update header
      await query(
        `
        UPDATE inv_issue_to_requirement
        SET issue_date = :issueDate, warehouse_id = :warehouseId, issued_to = :issuedTo,
            department_id = :departmentId, issue_type = :issueType,
            requisition_id = :requisitionId, requisition_source = :requisitionSource, status = :status, remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          issueDate: toDateOnly(issue_date) || null,
          warehouseId: toNumber(warehouse_id) || null,
          issuedTo: issued_to ? String(issued_to).trim() || null : null,
          departmentId: toNumber(department_id) || null,
          issueType:
            (issue_type ? String(issue_type).trim() : null) || "GENERAL",
          requisitionId: toNumber(requisition_id) || null,
          requisitionSource: (requisition_source ? String(requisition_source).trim() : null) || "inventory",
          status: (status ? String(status).trim() : null) || "DRAFT",
          remarks: remarks ? String(remarks).trim() || null : null,
        },
      );

      // Delete existing details
      await query(
        `DELETE FROM inv_issue_to_requirement_details WHERE issue_id = :id`,
        { id: id || null },
      );

      // Insert new details
      for (const line of details) {
        if (line.item_id && Number(line.qty_issued || 0) > 0) {
          await query(
            `
            INSERT INTO inv_issue_to_requirement_details
            (issue_id, item_id, qty_issued, uom, batch_number, serial_number)
            VALUES (:issueId, :itemId, :qtyIssued, :uom, :batchNumber, :serialNumber)
            `,
            {
              issueId: id || null,
              itemId: toNumber(line.item_id) || null,
              qtyIssued: Number(line.qty_issued || 0) || 0,
              uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
              batchNumber: line.batch_number
                ? String(line.batch_number).trim() || null
                : null,
              serialNumber: line.serial_number
                ? String(line.serial_number).trim() || null
                : null,
            },
          );
        }
      }

      res.json({ id, ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// DELETE issue
router.delete(
  "/issue-to-requirement/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      // Check if issue exists
      const [existing] = await query(
        `
        SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_issue_to_requirement
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        LIMIT 1
        `,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");

      // Delete details first (cascade delete should handle this, but explicit is safer)
      await query(
        `DELETE FROM inv_issue_to_requirement_details WHERE issue_id = :id`,
        { id },
      );

      // Delete header
      await query(
        `
        DELETE FROM inv_issue_to_requirement
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId },
      );

      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

// PUT status-only update for issue-to-requirement (Post / Revert)
router.put(
  "/issue-to-requirement/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const { status } = req.body;
      if (!status) throw httpError(400, "VALIDATION_ERROR", "status is required");

      // Fetch existing issue header
      const [existing] = await query(
        `SELECT i.*, w.branch_id AS warehouse_branch_id
           FROM inv_issue_to_requirement i
           LEFT JOIN inv_warehouses w ON w.id = i.warehouse_id
          WHERE i.id = :id AND i.company_id = :companyId AND i.branch_id = :branchId
          LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");

      const currentStatus = String(existing.status || "").toUpperCase();
      const newStatus = String(status).trim().toUpperCase();

      // Guard: only allow DRAFT -> POSTED
      if (newStatus === "POSTED" && currentStatus !== "DRAFT") {
        throw httpError(400, "VALIDATION_ERROR", `Cannot post an issue that is already ${existing.status}`);
      }

      await conn.beginTransaction();

      if (newStatus === "POSTED") {
        // Fetch details to consume stock
        const details = await query(
          `SELECT item_id, qty_issued, batch_number
             FROM inv_issue_to_requirement_details
            WHERE issue_id = :id`,
          { id },
        );

        const warehouseId = toNumber(existing.warehouse_id) || null;
        const issueType = String(existing.issue_type || "").toUpperCase();
        const isReserveType = ["PRODUCTION", "MAINTENANCE", "PROJECT"].includes(issueType);

        for (const line of details) {
          const itemId = toNumber(line.item_id);
          const qty = Number(line.qty_issued || 0);
          if (!itemId || qty <= 0 || !warehouseId) continue;

          if (isReserveType) {
            await conn.execute(
              `UPDATE inv_stock_balances
                  SET qty = qty - :qty,
                      reserved_qty = COALESCE(reserved_qty, 0) + :qty
                WHERE company_id = :companyId AND branch_id = :branchId
                  AND warehouse_id = :warehouseId AND item_id = :itemId
                LIMIT 1`,
              { companyId, branchId, warehouseId, itemId, qty },
            );
          } else {
            await consumeStockFIFOTx(conn, {
              companyId,
              branchId,
              warehouseId,
              itemId,
              transactionType: "ISSUE_TO_REQUIREMENT",
              qtyToConsume: qty,
              sourceRef: existing.issue_no,
              createdBy: userId,
            });
          }
        }
      }

      // Update the status
      await conn.execute(
        `UPDATE inv_issue_to_requirement
            SET status = :status, updated_at = CURRENT_TIMESTAMP
          WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { status: newStatus, id, companyId, branchId },
      );

      await conn.commit();
      res.json({ ok: true, status: newStatus });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

// POST cancel issue-to-requirement
router.post(
  "/issue-to-requirement/:id/cancel",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureIssueToRequirementTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [existing] = await query(
        `SELECT id, status FROM inv_issue_to_requirement
          WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
          LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!existing) throw httpError(404, "NOT_FOUND", "Issue not found");
      if (String(existing.status).toUpperCase() === "CANCELLED") {
        throw httpError(400, "VALIDATION_ERROR", "Issue is already cancelled");
      }

      await query(
        `UPDATE inv_issue_to_requirement
            SET status = 'CANCELLED', updated_at = CURRENT_TIMESTAMP
          WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Return to Stores endpoints
router.get(
  "/return-to-stores/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT r.*, w.warehouse_name, d.name AS department_name,
          r.created_at,
          u.username AS created_by_name
         FROM inv_return_to_stores r
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN adm_departments d ON d.id = r.department_id
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE r.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Return not found");
      const details = await query(
        `
        SELECT d.id, d.rts_id, d.item_id, d.qty_returned, d.uom, d.reason, d.\`condition\`, d.batch_serial, d.location, d.remarks, i.item_code, i.item_name
        FROM inv_return_to_stores_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        WHERE d.rts_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/return-to-stores",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const createdBy = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const body = req.body || {};
      const rtsNo = body.rts_no || (await nextReturnNo(companyId, branchId));
      const rtsDate = toDateOnly(body.rts_date || new Date().toISOString().split("T")[0]) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const departmentId = toNumber(body.department_id) || null;
      const issueId = toNumber(body.issue_id) || null;
      const requisitionId = toNumber(body.requisition_id) || null;
      const returnType = body.return_type || "EXCESS";
      const remarks = body.remarks || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `
        INSERT INTO inv_return_to_stores
        (company_id, branch_id, rts_no, rts_date, warehouse_id, department_id, status, issue_id, requisition_id, return_type, remarks)
        VALUES (:companyId, :branchId, :rtsNo, :rtsDate, :warehouseId, :departmentId, :status, :issueId, :requisitionId, :returnType, :remarks)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          rtsNo: rtsNo || null,
          rtsDate: rtsDate || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          status: status || "DRAFT",
          issueId: issueId || null,
          requisitionId: requisitionId || null,
          returnType: returnType || "EXCESS",
          remarks: remarks || null,
        },
      );
      const rtsId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || line.qty_returned || 0);
        const remainingQty = Number(line.remaining_qty || 0);
        const qtyIssued = Number(line.qty_issued || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details
          (rts_id, item_id, qty_returned, uom, remaining_qty, qty_issued, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:rtsId, :itemId, :qty, :uom, :remainingQty, :qtyIssued, :reason, :condition, :batchSerial, :location, :lineRemarks)
          `,
          {
            rtsId: rtsId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            remainingQty: remainingQty || null,
            qtyIssued: qtyIssued || null,
            reason: line.reason || null,
            condition: line.condition || "GOOD",
            batchSerial: line.batch_serial || null,
            location: line.location || null,
            lineRemarks: line.remarks || null,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: rtsId, rts_no: rtsNo });
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

router.put(
  "/return-to-stores/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const rtsDate = toDateOnly(body.rts_date) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const departmentId = toNumber(body.department_id) || null;
      const issueId = toNumber(body.issue_id) || null;
      const requisitionId = toNumber(body.requisition_id) || null;
      const returnType = body.return_type || "EXCESS";
      const remarks = body.remarks || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_return_to_stores
        SET rts_date = :rtsDate, warehouse_id = :warehouseId, department_id = :departmentId, status = :status, issue_id = :issueId, requisition_id = :requisitionId, return_type = :returnType, remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          rtsDate: rtsDate || null,
          warehouseId: warehouseId || null,
          departmentId: departmentId || null,
          status: status || "DRAFT",
          issueId: issueId || null,
          requisitionId: requisitionId || null,
          returnType: returnType || "EXCESS",
          remarks: remarks || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Return not found");

      await conn.execute(
        `DELETE FROM inv_return_to_stores_details WHERE rts_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || line.qty_returned || 0);
        const remainingQty = Number(line.remaining_qty || 0);
        const qtyIssued = Number(line.qty_issued || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        await conn.execute(
          `
          INSERT INTO inv_return_to_stores_details
          (rts_id, item_id, qty_returned, uom, remaining_qty, qty_issued, reason, \`condition\`, batch_serial, location, remarks)
          VALUES (:rtsId, :itemId, :qty, :uom, :remainingQty, :qtyIssued, :reason, :condition, :batchSerial, :location, :lineRemarks)
          `,
          {
            rtsId: id || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            remainingQty: remainingQty || null,
            qtyIssued: qtyIssued || null,
            reason: line.reason || null,
            condition: line.condition || "GOOD",
            batchSerial: line.batch_serial || null,
            location: line.location || null,
            lineRemarks: line.remarks || null,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
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
  "/return-to-stores/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/inventory/return-to-stores";

      const { activeWorkflow: activeWf, inactiveWorkflow } =
        await resolveWorkflowSelection({
          companyId,
          workflowIdOverride,
          docRouteBase,
          typeSynonyms: ["RETURN_TO_STORES", "Return to Stores"],
          amount: 0,
        });

      if (!activeWf) {
        const behavior = getInactiveWorkflowBehavior(inactiveWorkflow);
        if (behavior && behavior.toUpperCase() === "AUTO_APPROVE") {
          await query(
            `UPDATE inv_return_to_stores SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
            { id, companyId, branchId },
          );
          return res.json({ status: "APPROVED" });
        }
        await query(
          `UPDATE inv_return_to_stores SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        return res.json({ status: "SUBMITTED" });
      }

      const steps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );

      if (!steps.length) {
        await query(
          `UPDATE inv_return_to_stores SET status = 'SUBMITTED' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
          { id, companyId, branchId },
        );
        return res.json({ status: "SUBMITTED" });
      }

      const first = steps[0];
      const targetUserId =
        toNumber(req.body?.target_user_id) || first.approver_user_id;

      await query(
        `INSERT INTO adm_document_workflows 
         (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :wfId, :docId, 'RETURN_TO_STORES', 0, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId,
          wfId: activeWf.id,
          docId: id,
          stepOrder: first.step_order,
          assignedTo: targetUserId,
        },
      );

      const workflowInstanceId = (
        await query("SELECT LAST_INSERT_ID() AS id")
      )[0].id;

      await query(
        `INSERT INTO adm_workflow_tasks 
         (document_workflow_id, step_order, assigned_to_user_id, status, action)
         VALUES (:dwId, :stepOrder, :assignedTo, 'PENDING', 'PENDING')`,
        {
          dwId: workflowInstanceId,
          stepOrder: first.step_order,
          assignedTo: targetUserId,
        },
      );

      await query(
        `UPDATE inv_return_to_stores SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, companyId, branchId },
      );

      res.json({ status: "PENDING_APPROVAL" });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/return-to-stores/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReturnToStoresInfrastructure();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      const { status } = req.body;
      if (!id || !status)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id or status");

      await query(
        `UPDATE inv_return_to_stores SET status = :status WHERE id = :id AND company_id = :companyId AND branch_id = :branchId`,
        { id, status, companyId, branchId },
      );

      res.json({ success: true, status });
    } catch (err) {
      next(err);
    }
  },
);

// Stock Transfer endpoints
router.get(
  "/stock-transfers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockTransferTables();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT t.*, fb.name AS from_branch, tb.name AS to_branch,
               fw.warehouse_name AS from_warehouse, tw.warehouse_name AS to_warehouse,
          t.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfers t
        LEFT JOIN adm_branches fb ON fb.id = t.from_branch_id
        LEFT JOIN adm_branches tb ON tb.id = t.to_branch_id
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.id = :id
        LIMIT 1
        `,
        { id: id || null },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Transfer not found");
      const details = await query(
        `
        SELECT d.id, d.transfer_id, d.item_id, d.qty, d.uom, d.batch_no AS batch_number, i.item_code, i.item_name,
          d.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfer_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.transfer_id = :id
        ORDER BY d.id
        `,
        { id: id || null },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/stock-transfers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTransferTables();
      await ensureStockBalancesWarehouseInfrastructure();
      await ensureStockBalanceDetailsInfrastructure();

      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const transferNo = body.transfer_no || (await nextTransferNo(companyId));
      const transferDate = toDateOnly(body.transfer_date || new Date().toISOString().split("T")[0]) || null;
      const fromBranchId = toNumber(body.from_branch_id) || null;
      const toBranchId = toNumber(body.to_branch_id) || null;
      const fromWarehouseId = toNumber(body.from_warehouse_id) || null;
      const toWarehouseId = toNumber(body.to_warehouse_id) || null;
      const rawTransferType = body.transfer_type
        ? String(body.transfer_type).trim()
        : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const transferScope = await resolveTransferScopeTx(conn, {
        companyId,
        transferType: rawTransferType,
        fromBranchId,
        toBranchId,
        fromWarehouseId,
        toWarehouseId,
      });
      const [result] = await conn.execute(
        `
        INSERT INTO inv_stock_transfers
        (company_id, branch_id, transfer_no, transfer_date, from_branch_id, to_branch_id, from_warehouse_id, to_warehouse_id, transfer_type, status, created_by)
        VALUES (:companyId, :branchId, :transferNo, :transferDate, :fromBranchId, :toBranchId, :fromWarehouseId, :toWarehouseId, :transferType, :status, :createdBy)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          transferNo: transferNo || null,
          transferDate: transferDate || null,
          fromBranchId: transferScope.fromBranchId,
          toBranchId: transferScope.toBranchId,
          fromWarehouseId: transferScope.fromWarehouseId,
          toWarehouseId: transferScope.toWarehouseId,
          transferType: transferScope.transferType,
          status,
          createdBy,
        },
      );
      const transferId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId || qty <= 0) continue;

        if (
          ["IN_TRANSIT", "IN TRANSIT"].includes(String(status).toUpperCase())
        ) {
          await reserveStockTx(conn, {
            companyId,
            branchId,
            warehouseId: transferScope.fromWarehouseId,
            itemId,
            qtyToReserve: qty,
            sourceRef: transferNo,
            createdBy: req.user?.sub || null,
          });
        }

        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        const batchNo = line.batch_number
          ? String(line.batch_number).trim() || null
          : null;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details
          (transfer_id, item_id, qty, uom, batch_no)
          VALUES (:transferId, :itemId, :qty, :uom, :batchNo)
          `,
          {
            transferId: transferId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            batchNo,
          },
        );
      }

      await conn.commit();
      res.status(201).json({ id: transferId, transfer_no: transferNo });
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

router.put(
  "/stock-transfers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockTransferTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const transferDate = toDateOnly(body.transfer_date) || null;
      const fromBranchId = toNumber(body.from_branch_id) || null;
      const toBranchId = toNumber(body.to_branch_id) || null;
      const fromWarehouseId = toNumber(body.from_warehouse_id) || null;
      const toWarehouseId = toNumber(body.to_warehouse_id) || null;
      const rawTransferType = body.transfer_type
        ? String(body.transfer_type).trim()
        : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const transferScope = await resolveTransferScopeTx(conn, {
        companyId,
        transferType: rawTransferType,
        fromBranchId,
        toBranchId,
        fromWarehouseId,
        toWarehouseId,
      });
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_transfers
        SET transfer_date = :transferDate, from_branch_id = :fromBranchId, to_branch_id = :toBranchId, 
            from_warehouse_id = :fromWarehouseId, to_warehouse_id = :toWarehouseId, transfer_type = :transferType, status = :status
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          transferDate: transferDate || null,
          fromBranchId: transferScope.fromBranchId,
          toBranchId: transferScope.toBranchId,
          fromWarehouseId: transferScope.fromWarehouseId,
          toWarehouseId: transferScope.toWarehouseId,
          transferType: transferScope.transferType,
          status,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Transfer not found");

      await conn.execute(
        `DELETE FROM inv_stock_transfer_details WHERE transfer_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId || qty <= 0) continue;
        // Fetch UOM from inv_items table
        const [itemRows] = await conn.execute(
          `SELECT uom FROM inv_items WHERE id = :itemId LIMIT 1`,
          { itemId: itemId || null },
        );
        const uom =
          itemRows && itemRows.length > 0 ? itemRows[0].uom || null : null;
        const batchNo = line.batch_number
          ? String(line.batch_number).trim() || null
          : null;
        await conn.execute(
          `
          INSERT INTO inv_stock_transfer_details
          (transfer_id, item_id, qty, uom, batch_no)
          VALUES (:transferId, :itemId, :qty, :uom, :batchNo)
          `,
          {
            transferId: id || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: uom || null,
            batchNo,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
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

router.put(
  "/stock-transfers/:id/status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("INV.STOCK.TRANSFER.MANAGE"),
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      const { status } = req.body;
      if (!id || !status)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id or status");

      await conn.beginTransaction();

      const [hdr] = await conn.execute(
        `SELECT * FROM inv_stock_transfers WHERE id = :id AND company_id = :companyId AND branch_id = :branchId LIMIT 1`,
        { id, companyId, branchId },
      );
      if (!hdr || !hdr.length)
        throw httpError(404, "NOT_FOUND", "Transfer not found");

      const transfer = hdr[0];
      const oldStatus = String(transfer.status || "").trim().toUpperCase();
      // Normalize: always store IN_TRANSIT with underscore
      const normalizedStatus =
        String(status).trim().toUpperCase() === "IN TRANSIT"
          ? "IN_TRANSIT"
          : status;

      // Update status
      await conn.execute(
        `UPDATE inv_stock_transfers SET status = :status WHERE id = :id`,
        { status: normalizedStatus, id },
      );

      // If dispatching (from DRAFT or APPROVED -> IN_TRANSIT), reserve stock
      const incomingUpper = String(status).trim().toUpperCase().replace(" ", "_");
      if (
        ["DRAFT", "APPROVED"].includes(oldStatus) &&
        incomingUpper === "IN_TRANSIT"
      ) {
        const [details] = await conn.execute(
          `SELECT item_id, qty FROM inv_stock_transfer_details WHERE transfer_id = :id`,
          { id },
        );
        for (const line of details) {
          await reserveStockTx(conn, {
            companyId,
            branchId,
            warehouseId: transfer.from_warehouse_id,
            itemId: line.item_id,
            qtyToReserve: line.qty,
            sourceRef: transfer.transfer_no,
            createdBy: req.user?.sub || null,
          });
        }
      }

      await conn.commit();
      res.json({ success: true, status });
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

// Stock Adjustment endpoints
router.post(
  "/stock-adjustments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const adjustmentNo =
        body.adjustment_no || (await nextAdjustmentNo(companyId));
      const adjustmentDate =
        toDateOnly(body.adjustment_date || new Date().toISOString().split("T")[0]) || null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks = body.remarks ? String(body.remarks).trim() || null : null;
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [result] = await conn.execute(
        `
        INSERT INTO inv_stock_adjustments
        (company_id, branch_id, adjustment_no, adjustment_date, status, remarks)
        VALUES (:companyId, :branchId, :adjustmentNo, :adjustmentDate, :status, :remarks)
        `,
        {
          companyId: companyId || null,
          branchId: branchId || null,
          adjustmentNo: adjustmentNo || null,
          adjustmentDate: adjustmentDate || null,
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      const adjustmentId = result.insertId;

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId) continue;
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details
          (adjustment_id, item_id, qty, uom, unit_price, line_total, remarks)
          VALUES (:adjustmentId, :itemId, :qty, :uom, :unitPrice, :lineTotal, :remarks)
          `,
          {
            adjustmentId: adjustmentId || null,
            itemId: itemId || null,
            qty: qty || 0,
            uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
            unitPrice: Number(line.unit_price || 0) || 0,
            lineTotal: Number(line.line_total || 0) || 0,
            remarks: line.remarks ? String(line.remarks).trim() || null : null,
          },
        );
      }

      await conn.commit();

      // auto-approve when no active workflow (same pattern as stock updation)
      if (status === "DRAFT") {
        try {
          const [wfRows] = await query(
            `SELECT COUNT(*) AS cnt FROM adm_workflows
             WHERE company_id = :companyId
               AND (document_route = '/inventory/stock-adjustments'
                    OR document_type IN ('STOCK_ADJUSTMENT','Stock Adjustment'))
               AND is_active = 1`,
            { companyId },
          );
          if (!wfRows?.cnt) {
            await query(
              `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id`,
              { id: adjustmentId },
            );
          }
        } catch {}
      }

      res.status(201).json({ id: adjustmentId, adjustment_no: adjustmentNo });
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

router.put(
  "/stock-adjustments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const adjustmentDate = toDateOnly(body.adjustment_date) || null;
      const warehouseId = toNumber(body.warehouse_id) || null;
      const adjustmentType = body.adjustment_type
        ? String(body.adjustment_type)
        : null;
      const referenceDoc = body.reference_doc
        ? String(body.reference_doc)
        : null;
      const reason = body.reason ? String(body.reason) : null;
      const status =
        (body.status ? String(body.status).trim() : null) || "DRAFT";
      const remarks =
        reason || (body.remarks ? String(body.remarks).trim() || null : null);
      const details = Array.isArray(body.details) ? body.details : [];

      await conn.beginTransaction();
      const [upd] = await conn.execute(
        `
        UPDATE inv_stock_adjustments
        SET warehouse_id = :warehouseId,
            adjustment_date = :adjustmentDate,
            adjustment_type = :adjustmentType,
            reference_doc = :referenceDoc,
            reason = :reason,
            status = :status,
            remarks = :remarks
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          branchId: branchId || null,
          warehouseId,
          adjustmentDate: adjustmentDate || null,
          adjustmentType,
          referenceDoc,
          reason,
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Adjustment not found");

      await conn.execute(
        `DELETE FROM inv_stock_adjustment_details WHERE adjustment_id = :id`,
        { id: id || null },
      );

      for (const line of details) {
        const itemId = toNumber(line.item_id);
        const qty = Number(line.qty || 0);
        if (!itemId) continue;
        const unitCost = Number(line.unit_cost || 0);
        await conn.execute(
          `
          INSERT INTO inv_stock_adjustment_details
          (adjustment_id, item_id, current_stock, adjusted_stock, qty, uom, unit_cost, unit_price, line_total, remarks)
          VALUES (:adjustmentId, :itemId, :currentStock, :adjustedStock, :qty, :uom, :unitCost, :unitPrice, :lineTotal, :remarks)
          `,
          {
            adjustmentId: id || null,
            itemId: itemId || null,
            currentStock: Number(line.current_stock || 0),
            adjustedStock: Number(line.adjusted_stock || 0),
            qty: qty || 0,
            uom: (line.uom ? String(line.uom).trim() : null) || "PCS",
            unitCost,
            unitPrice: unitCost,
            lineTotal: unitCost * Math.abs(qty || 0),
            remarks: line.remarks ? String(line.remarks).trim() || null : null,
          },
        );
      }

      await conn.commit();
      res.json({ ok: true });
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

// Daily Stock Count / Physical Stock Take Enterprise Endpoints
// =========================================================================
// SHARED ENTERPRISE INVENTORY STOCK COUNT ENGINE (DAILY & PHYSICAL STOCK TAKE)
// =========================================================================

async function ensureStockCountTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_daily_stock_counts (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NULL,
      stock_take_no VARCHAR(50) NULL,
      stock_take_type VARCHAR(20) NOT NULL DEFAULT 'PHYSICAL',
      count_scope VARCHAR(30) NOT NULL DEFAULT 'FULL_WAREHOUSE',
      count_date DATE NOT NULL,
      category_id BIGINT UNSIGNED NULL,
      tolerance_pct DECIMAL(5,2) DEFAULT 0.00,
      is_blind_count TINYINT(1) DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
      snapshot_at DATETIME NULL,
      submitted_by BIGINT UNSIGNED NULL,
      submitted_at DATETIME NULL,
      reviewed_by BIGINT UNSIGNED NULL,
      reviewed_at DATETIME NULL,
      approved_by BIGINT UNSIGNED NULL,
      approved_at DATETIME NULL,
      recount_count INT UNSIGNED DEFAULT 0,
      recount_reason TEXT NULL,
      adjustment_id BIGINT UNSIGNED NULL,
      total_items INT UNSIGNED DEFAULT 0,
      total_variance_items INT UNSIGNED DEFAULT 0,
      total_variance_value DECIMAL(18,4) DEFAULT 0,
      remarks TEXT,
      created_by BIGINT UNSIGNED,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_count_scope (company_id, branch_id),
      KEY idx_type (stock_take_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});

  // Drop legacy unique keys that prevent multiple stock takes or multiple daily counts per day
  const dropLegacyIndexes = [
    "ALTER TABLE inv_daily_stock_counts DROP INDEX uq_count",
    "ALTER TABLE inv_daily_stock_counts DROP INDEX uq_daily_stock_count",
    "ALTER TABLE inv_daily_stock_counts DROP INDEX uniq_count_day",
    "ALTER TABLE inv_daily_stock_counts DROP INDEX uq_count_date",
  ];
  for (const q of dropLegacyIndexes) {
    await query(q).catch(() => {});
  }

  // Add all needed columns if missing
  const cols = [
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS stock_take_no VARCHAR(50) NULL",
    "ALTER TABLE inv_daily_stock_counts MODIFY COLUMN warehouse_id BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS stock_take_type VARCHAR(20) NOT NULL DEFAULT 'PHYSICAL'",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS count_scope VARCHAR(30) NOT NULL DEFAULT 'FULL_WAREHOUSE'",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS count_type VARCHAR(30) NOT NULL DEFAULT 'FULL_COUNT'",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS category_id BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS tolerance_pct DECIMAL(5,2) DEFAULT 0.00",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS is_blind_count TINYINT(1) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS snapshot_at DATETIME NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS submitted_by BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS submitted_at DATETIME NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS reviewed_by BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS reviewed_at DATETIME NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS approved_by BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS approved_at DATETIME NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS recount_count INT UNSIGNED DEFAULT 0",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS recount_reason TEXT NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS adjustment_id BIGINT UNSIGNED NULL",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS total_items INT UNSIGNED DEFAULT 0",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS total_variance_items INT UNSIGNED DEFAULT 0",
    "ALTER TABLE inv_daily_stock_counts ADD COLUMN IF NOT EXISTS total_variance_value DECIMAL(18,4) DEFAULT 0",
  ];
  for (const c of cols) {
    await query(c).catch(() => {});
  }

  await query(`
    CREATE TABLE IF NOT EXISTS inv_daily_stock_count_details (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      count_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      batch_no VARCHAR(100) NULL,
      system_qty DECIMAL(18,3) DEFAULT 0,
      movement_qty DECIMAL(18,3) DEFAULT 0,
      expected_qty DECIMAL(18,3) DEFAULT 0,
      physical_qty DECIMAL(18,3) NULL,
      qty_counted DECIMAL(18,3) NULL,
      qty_system DECIMAL(18,3) NULL,
      variance DECIMAL(18,3) DEFAULT 0,
      variance_qty DECIMAL(18,3) DEFAULT 0,
      variance_pct DECIMAL(10,2) DEFAULT 0,
      unit_cost DECIMAL(18,4) DEFAULT 0,
      variance_value DECIMAL(18,4) DEFAULT 0,
      variance_reason VARCHAR(100) NULL,
      count_status VARCHAR(30) DEFAULT 'PENDING',
      recount_qty DECIMAL(18,3) NULL,
      location_name VARCHAR(100) NULL,
      remarks VARCHAR(255),
      created_by BIGINT UNSIGNED NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_detail (count_id),
      KEY idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});

  const detailCols = [
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS batch_no VARCHAR(100) NULL",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS system_qty DECIMAL(18,3) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS movement_qty DECIMAL(18,3) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS expected_qty DECIMAL(18,3) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS physical_qty DECIMAL(18,3) NULL",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS variance_qty DECIMAL(18,3) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS variance_pct DECIMAL(10,2) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS unit_cost DECIMAL(18,4) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS variance_value DECIMAL(18,4) DEFAULT 0",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS variance_reason VARCHAR(100) NULL",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS count_status VARCHAR(30) DEFAULT 'PENDING'",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS recount_qty DECIMAL(18,3) NULL",
    "ALTER TABLE inv_daily_stock_count_details ADD COLUMN IF NOT EXISTS location_name VARCHAR(100) NULL",
  ];
  for (const dc of detailCols) {
    await query(dc).catch(() => {});
  }

  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_count_logs (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      count_id BIGINT UNSIGNED NOT NULL,
      actor_user_id BIGINT UNSIGNED NULL,
      actor_name VARCHAR(100) NULL,
      action VARCHAR(50) NOT NULL,
      old_status VARCHAR(30) NULL,
      new_status VARCHAR(30) NULL,
      comments TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_count_logs (count_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

async function logStockTakeAction(countId, actorUserId, actorName, action, oldStatus, newStatus, comments) {
  try {
    await query(
      `INSERT INTO inv_stock_count_logs
        (count_id, actor_user_id, actor_name, action, old_status, new_status, comments)
       VALUES
        (:countId, :actorUserId, :actorName, :action, :oldStatus, :newStatus, :comments)`,
      {
        countId,
        actorUserId: actorUserId || null,
        actorName: actorName || "System",
        action,
        oldStatus: oldStatus || null,
        newStatus: newStatus || null,
        comments: comments || null,
      },
    );
  } catch {}
}

async function nextStockTakeNo(companyId, branchId, stockTakeType = "PHYSICAL") {
  const prefix = String(stockTakeType).toUpperCase() === "DAILY" ? "DST-" : "STK-";
  const rows = await query(
    `
    SELECT stock_take_no
     FROM inv_daily_stock_counts
     WHERE company_id = :companyId
       AND (:branchId IS NULL OR branch_id = :branchId OR branch_id IS NULL)
       AND stock_take_no LIKE :prefixPattern
    ORDER BY CAST(SUBSTRING(stock_take_no, :prefixLen) AS UNSIGNED) DESC
    LIMIT 1
    `,
    {
      companyId: companyId || null,
      branchId: branchId || null,
      prefixPattern: `${prefix}%`,
      prefixLen: prefix.length + 1,
    },
  ).catch(() => []);

  let nextNum = 1;
  if (rows && rows.length) {
    const prev = String(rows[0].stock_take_no || "");
    const numPart = prev.slice(prefix.length);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `${prefix}${String(nextNum).padStart(6, "0")}`;
}

// 1. GET /stock-takes - List stock takes with summary KPIs and type filter
router.get(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const { companyId, branchId = null } = req.scope || {};
      const { type, warehouse_id, status } = req.query || {};

      let sql = `
        SELECT c.id,
               c.stock_take_no,
               c.stock_take_type,
               c.count_scope,
               c.count_date AS stock_take_date,
               c.count_type,
               c.category_id,
               c.tolerance_pct,
               c.is_blind_count,
               c.status,
               c.warehouse_id,
               w.warehouse_name,
               cat.category_name,
               c.snapshot_at,
               c.submitted_at,
               c.approved_at,
               c.recount_count,
               c.adjustment_id,
               sa.adjustment_no,
               c.total_items,
               c.total_variance_items,
               c.total_variance_value,
               c.remarks,
               c.created_at,
               u.username AS created_by_name,
               u_app.username AS approved_by_name,
               COUNT(d.id) AS detail_lines_count
         FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        LEFT JOIN inv_item_categories cat ON cat.id = c.category_id
        LEFT JOIN inv_stock_adjustments sa ON sa.id = c.adjustment_id
        LEFT JOIN adm_users u ON u.id = c.created_by
        LEFT JOIN adm_users u_app ON u_app.id = c.approved_by
        LEFT JOIN inv_daily_stock_count_details d ON d.count_id = c.id
         WHERE c.company_id = :companyId
           AND (:branchId IS NULL OR c.branch_id = :branchId OR c.branch_id IS NULL)
      `;

      const params = { companyId: companyId || null, branchId: branchId || null };

      if (type && type !== "ALL") {
        sql += ` AND c.stock_take_type = :stockTakeType`;
        params.stockTakeType = String(type).toUpperCase();
      }

      if (warehouse_id && warehouse_id !== "ALL") {
        sql += ` AND c.warehouse_id = :warehouseId`;
        params.warehouseId = Number(warehouse_id);
      }

      if (status && status !== "ALL") {
        sql += ` AND c.status = :status`;
        params.status = String(status).toUpperCase();
      }

      sql += ` GROUP BY c.id ORDER BY c.id DESC`;

      const rows = await query(sql, params);
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Backward compatible alias /daily-stock-count
router.get(
  "/daily-stock-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT c.id, c.warehouse_id, c.count_date, c.status,
               c.stock_take_no, c.stock_take_type,
               w.warehouse_name, COUNT(d.id) AS item_count,
               c.created_at,
               u.username AS created_by_name
         FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        LEFT JOIN inv_daily_stock_count_details d ON d.count_id = c.id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
           AND (:branchId IS NULL OR c.branch_id = :branchId OR c.branch_id IS NULL)
        GROUP BY c.id
        ORDER BY c.count_date DESC, c.id DESC
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// 2. GET /stock-takes/:id - Full details, live reconciliation, audit logs
router.get(
  "/stock-takes/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const [hdr] = await query(
        `
        SELECT c.*,
               w.warehouse_name,
               w.warehouse_code,
               cat.category_name,
               sa.adjustment_no,
               u_cr.username AS created_by_name,
               u_sub.username AS submitted_by_name,
               u_rev.username AS reviewed_by_name,
               u_app.username AS approved_by_name
         FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        LEFT JOIN inv_item_categories cat ON cat.id = c.category_id
        LEFT JOIN inv_stock_adjustments sa ON sa.id = c.adjustment_id
        LEFT JOIN adm_users u_cr ON u_cr.id = c.created_by
        LEFT JOIN adm_users u_sub ON u_sub.id = c.submitted_by
        LEFT JOIN adm_users u_rev ON u_rev.id = c.reviewed_by
        LEFT JOIN adm_users u_app ON u_app.id = c.approved_by
         WHERE c.id = :id AND c.company_id = :companyId
        LIMIT 1
        `,
        { id, companyId },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Stock take not found");

      // Query line items with details
      const details = await query(
        `
        SELECT d.*,
               i.item_code,
               i.item_name,
               i.uom,
               uom.uom_name,
               cat.category_name AS item_category,
               COALESCE(d.unit_cost, i.cost_price, 0) AS effective_unit_cost
         FROM inv_daily_stock_count_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_item_categories cat ON cat.id = i.category_id
        LEFT JOIN inv_uoms uom ON uom.id = i.uom_id
         WHERE d.count_id = :id
        ORDER BY i.item_code ASC, i.item_name ASC
        `,
        { id },
      );

      // Query audit logs
      const logs = await query(
        `
        SELECT l.*, u.username AS actor_username
         FROM inv_stock_count_logs l
        LEFT JOIN adm_users u ON u.id = l.actor_user_id
         WHERE l.count_id = :id
        ORDER BY l.id ASC
        `,
        { id },
      );

      res.json({ item: hdr, details: details || [], logs: logs || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Backward compatible alias
router.get(
  "/daily-stock-count/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockCountTables();
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [hdr] = await query(
        `
        SELECT c.*, w.warehouse_name,
               c.created_at,
               u.username AS created_by_name
         FROM inv_daily_stock_counts c
        LEFT JOIN inv_warehouses w ON w.id = c.warehouse_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.id = :id
        LIMIT 1
        `,
        { id },
      );
      if (!hdr) throw httpError(404, "NOT_FOUND", "Stock count not found");
      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
               d.created_at,
               u.username AS created_by_name
         FROM inv_daily_stock_count_details d
        LEFT JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.count_id = :id
        ORDER BY d.id
        `,
        { id },
      );
      res.json({ item: hdr, details: details || [] });
    } catch (e) {
      next(e);
    }
  },
);

// 3. POST /stock-takes - Create Stock Take (Daily or Physical) in DRAFT status
router.post(
  "/stock-takes",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId, branchId = null } = req.scope || {};
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";
      const body = req.body || {};

      const stockTakeType = String(body.stock_take_type || "PHYSICAL").toUpperCase();
      const stockTakeDate = toDateOnly(body.stock_take_date || new Date().toISOString().split("T")[0]);
      const warehouseId = toNumber(body.warehouse_id) || null;
      const categoryId = toNumber(body.category_id) || null;
      const countScope = String(body.count_scope || (stockTakeType === "DAILY" ? "SELECTED_ITEMS" : "FULL_WAREHOUSE")).toUpperCase();
      const countType = String(body.count_type || "FULL_COUNT").toUpperCase();
      const tolerancePct = Number(body.tolerance_pct || 0);
      const isBlindCount = body.is_blind_count ? 1 : 0;
      const remarks = body.remarks ? String(body.remarks).trim() : null;
      const itemIds = Array.isArray(body.item_ids) ? body.item_ids.map(toNumber).filter(Boolean) : [];

      if (!stockTakeDate) throw httpError(400, "VALIDATION_ERROR", "Date is required");

      const stockTakeNo = await nextStockTakeNo(companyId, branchId, stockTakeType);

      await conn.beginTransaction();
      const [hdr] = await conn.execute(
        `
        INSERT INTO inv_daily_stock_counts
          (company_id, branch_id, warehouse_id, stock_take_no, stock_take_type, count_scope, count_type, count_date, category_id, tolerance_pct, is_blind_count, status, remarks, created_by)
        VALUES
          (:companyId, :branchId, :warehouseId, :stockTakeNo, :stockTakeType, :countScope, :countType, :countDate, :categoryId, :tolerancePct, :isBlindCount, 'DRAFT', :remarks, :actorId)
        `,
        {
          companyId,
          branchId,
          warehouseId,
          stockTakeNo,
          stockTakeType,
          countScope,
          countType,
          countDate: stockTakeDate,
          categoryId,
          tolerancePct,
          isBlindCount,
          remarks,
          actorId,
        },
      );
      const countId = hdr.insertId;

      // If specific item list is pre-configured (e.g. Daily Stock Take selected items)
      if (itemIds.length > 0) {
        for (const itId of itemIds) {
          await conn.execute(
            `
            INSERT INTO inv_daily_stock_count_details
              (count_id, item_id, system_qty, movement_qty, expected_qty, count_status, created_by)
            VALUES
              (:countId, :itemId, 0, 0, 0, 'PENDING', :actorId)
            `,
            { countId, itemId: itId, actorId },
          );
        }
        await conn.execute(
          `UPDATE inv_daily_stock_counts SET total_items = :tot WHERE id = :countId`,
          { tot: itemIds.length, countId },
        );
      }

      await logStockTakeAction(
        countId,
        actorId,
        actorName,
        "CREATE",
        null,
        "DRAFT",
        `${stockTakeType === "DAILY" ? "Daily" : "Physical"} Stock Take created with scope: ${countScope}${itemIds.length ? ` (${itemIds.length} preselected items)` : ""}`,
      );
      await conn.commit();

      res.status(201).json({
        id: countId,
        stock_take_no: stockTakeNo,
        stock_take_type: stockTakeType,
        status: "DRAFT",
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

// 4. POST /stock-takes/:id/start-count - Captures snapshot baseline from inv_stock_balances
router.post(
  "/stock-takes/:id/start-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "DRAFT" && stk.status !== "RECOUNT_REQUIRED") {
        throw httpError(400, "BAD_REQUEST", `Cannot start counting when status is ${stk.status}`);
      }

      await conn.beginTransaction();

      // Check if details already exist (preselected items for Daily Stock Take)
      const existingDetails = await query(
        `SELECT item_id FROM inv_daily_stock_count_details WHERE count_id = :id`,
        { id },
      );

      let itemScopeSql = `
        SELECT i.id AS item_id,
               i.cost_price,
               COALESCE(sb.qty, 0) AS system_qty
        FROM inv_items i
        LEFT JOIN (
          SELECT item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          WHERE company_id = :companyId
            ${stk.warehouse_id ? "AND warehouse_id = :warehouseId" : ""}
          GROUP BY item_id
        ) sb ON sb.item_id = i.id
        WHERE i.company_id = :companyId
      `;
      const queryParams = { companyId, warehouseId: stk.warehouse_id || null };

      if (existingDetails.length > 0) {
        const itemIdsList = existingDetails.map((d) => d.item_id);
        itemScopeSql += ` AND i.id IN (${itemIdsList.join(",")})`;
      } else if (stk.category_id) {
        itemScopeSql += ` AND i.category_id = :categoryId`;
        queryParams.categoryId = stk.category_id;
      }

      const scopeItems = await query(itemScopeSql, queryParams);

      await conn.execute(`DELETE FROM inv_daily_stock_count_details WHERE count_id = :id`, { id });

      for (const it of scopeItems) {
        const cost = Number(it.cost_price || 0);
        const sysQty = Number(it.system_qty || 0);
        await conn.execute(
          `
          INSERT INTO inv_daily_stock_count_details
            (count_id, item_id, system_qty, movement_qty, expected_qty, physical_qty, variance_qty, variance_pct, unit_cost, variance_value, count_status, created_by)
          VALUES
            (:countId, :itemId, :sysQty, 0, :sysQty, NULL, 0, 0, :cost, 0, 'PENDING', :actorId)
          `,
          {
            countId: id,
            itemId: it.item_id,
            sysQty,
            cost,
            actorId,
          },
        );
      }

      await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET status = 'COUNTING',
            snapshot_at = NOW(),
            total_items = :totItems
        WHERE id = :id
        `,
        { id, totItems: scopeItems.length },
      );

      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "START_COUNT",
        stk.status,
        "COUNTING",
        `Captured baseline snapshot for ${scopeItems.length} items.`,
      );
      await conn.commit();

      res.json({ ok: true, status: "COUNTING", total_items: scopeItems.length });
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

// 5. PUT /stock-takes/:id/save-count - Save physical counts in progress
router.put(
  "/stock-takes/:id/save-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const { details = [] } = req.body || {};

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "COUNTING" && stk.status !== "RECOUNT_REQUIRED" && stk.status !== "DRAFT") {
        throw httpError(400, "BAD_REQUEST", `Cannot edit counts when status is ${stk.status}`);
      }

      await conn.beginTransaction();

      for (const line of details) {
        const detailId = toNumber(line.id);
        const itemId = toNumber(line.item_id);
        const physicalQty = line.physical_qty === "" || line.physical_qty === null || line.physical_qty === undefined
          ? null
          : Number(line.physical_qty);
        const varianceReason = line.variance_reason ? String(line.variance_reason).trim() : null;
        const remarks = line.remarks ? String(line.remarks).trim() : null;

        if (detailId) {
          await conn.execute(
            `
            UPDATE inv_daily_stock_count_details
            SET physical_qty = :physicalQty,
                qty_counted = :physicalQty,
                variance_reason = :varianceReason,
                remarks = :remarks
            WHERE id = :detailId AND count_id = :id
            `,
            { detailId, id, physicalQty, varianceReason, remarks },
          );
        } else if (itemId) {
          await conn.execute(
            `
            UPDATE inv_daily_stock_count_details
            SET physical_qty = :physicalQty,
                qty_counted = :physicalQty,
                variance_reason = :varianceReason,
                remarks = :remarks
            WHERE count_id = :id AND item_id = :itemId
            `,
            { id, itemId, physicalQty, varianceReason, remarks },
          );
        }
      }

      await conn.commit();
      res.json({ ok: true, message: "Counts saved successfully" });
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

// 6. POST /stock-takes/:id/submit-count - Reconciles interim movements, calculates variances, submits for review
router.post(
  "/stock-takes/:id/submit-count",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "COUNTING" && stk.status !== "RECOUNT_REQUIRED" && stk.status !== "DRAFT") {
        throw httpError(400, "BAD_REQUEST", `Cannot submit when status is ${stk.status}`);
      }

      await conn.beginTransaction();

      const details = await query(
        `SELECT * FROM inv_daily_stock_count_details WHERE count_id = :id`,
        { id },
      );

      let totalVarianceItems = 0;
      let totalVarianceValue = 0;
      const tolerancePct = Number(stk.tolerance_pct || 0);

      for (const d of details) {
        const sysQty = Number(d.system_qty || 0);
        const cost = Number(d.unit_cost || 0);

        let movementQty = 0;
        if (stk.snapshot_at) {
          const [mov] = await query(
            `
            SELECT COALESCE(SUM(qty_change), 0) AS mov_qty
            FROM inv_stock_ledger
            WHERE company_id = :companyId
              ${stk.warehouse_id ? "AND warehouse_id = :warehouseId" : ""}
              AND item_id = :itemId
              AND created_at > :snapshotAt
            `,
            {
              companyId,
              warehouseId: stk.warehouse_id || null,
              itemId: d.item_id,
              snapshotAt: stk.snapshot_at,
            },
          );
          movementQty = Number(mov?.mov_qty || 0);
        }

        const expectedQty = sysQty + movementQty;
        const physicalQty = d.physical_qty !== null && d.physical_qty !== undefined ? Number(d.physical_qty) : null;

        let varianceQty = 0;
        let variancePct = 0;
        let varianceVal = 0;
        let countStatus = "PENDING";

        if (physicalQty !== null) {
          varianceQty = physicalQty - expectedQty;
          variancePct = expectedQty !== 0 ? (varianceQty / expectedQty) * 100 : (varianceQty === 0 ? 0 : 100);
          varianceVal = varianceQty * cost;

          if (Math.abs(varianceQty) < 0.0001) {
            countStatus = "MATCHED";
          } else if (tolerancePct > 0 && Math.abs(variancePct) <= tolerancePct) {
            countStatus = "WITHIN_TOLERANCE";
            totalVarianceItems++;
            totalVarianceValue += Math.abs(varianceVal);
          } else if (varianceQty < 0) {
            countStatus = "SHORTAGE";
            totalVarianceItems++;
            totalVarianceValue += Math.abs(varianceVal);
          } else {
            countStatus = "SURPLUS";
            totalVarianceItems++;
            totalVarianceValue += Math.abs(varianceVal);
          }
        }

        await conn.execute(
          `
          UPDATE inv_daily_stock_count_details
          SET movement_qty = :movementQty,
              expected_qty = :expectedQty,
              variance = :varianceQty,
              variance_qty = :varianceQty,
              variance_pct = :variancePct,
              variance_value = :varianceVal,
              count_status = :countStatus
          WHERE id = :detailId
          `,
          {
            detailId: d.id,
            movementQty,
            expectedQty,
            varianceQty,
            variancePct,
            varianceVal,
            countStatus,
          },
        );
      }

      await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET status = 'UNDER_REVIEW',
            submitted_by = :actorId,
            submitted_at = NOW(),
            total_items = :totalItems,
            total_variance_items = :totalVarianceItems,
            total_variance_value = :totalVarianceValue
        WHERE id = :id
        `,
        {
          id,
          actorId,
          totalItems: details.length,
          totalVarianceItems,
          totalVarianceValue,
        },
      );

      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "SUBMIT_COUNT",
        stk.status,
        "UNDER_REVIEW",
        `Count submitted for review. Identified ${totalVarianceItems} variance items with total variance value of ${totalVarianceValue.toFixed(2)}.`,
      );

      await conn.commit();
      res.json({
        ok: true,
        status: "UNDER_REVIEW",
        total_variance_items: totalVarianceItems,
        total_variance_value: totalVarianceValue,
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

// 7. POST /stock-takes/:id/request-recount - Supervisor requests recount
router.post(
  "/stock-takes/:id/request-recount",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";
      const { reason = "" } = req.body || {};

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "UNDER_REVIEW") {
        throw httpError(400, "BAD_REQUEST", `Can only request recount when status is UNDER_REVIEW`);
      }

      await conn.beginTransaction();

      await conn.execute(
        `
        UPDATE inv_daily_stock_count_details
        SET recount_qty = physical_qty
        WHERE count_id = :id
        `,
        { id },
      );

      await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET status = 'RECOUNT_REQUIRED',
            recount_count = recount_count + 1,
            recount_reason = :reason,
            reviewed_by = :actorId,
            reviewed_at = NOW()
        WHERE id = :id
        `,
        { id, reason: reason || null, actorId },
      );

      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "REQUEST_RECOUNT",
        "UNDER_REVIEW",
        "RECOUNT_REQUIRED",
        `Recount requested (Cycle #${Number(stk.recount_count || 0) + 1}). Reason: ${reason || "Discrepancy review"}`,
      );

      await conn.commit();
      res.json({ ok: true, status: "RECOUNT_REQUIRED" });
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

// 8. POST /stock-takes/:id/approve - Approve the Stock Take
router.post(
  "/stock-takes/:id/approve",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "UNDER_REVIEW") {
        throw httpError(400, "BAD_REQUEST", `Can only approve when status is UNDER_REVIEW`);
      }

      await conn.beginTransaction();

      await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET status = 'APPROVED',
            approved_by = :actorId,
            approved_at = NOW()
        WHERE id = :id
        `,
        { id, actorId },
      );

      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "APPROVE",
        "UNDER_REVIEW",
        "APPROVED",
        "Stock Take approved. Ready for inventory adjustment posting.",
      );

      await conn.commit();
      res.json({ ok: true, status: "APPROVED" });
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

// 9. POST /stock-takes/:id/post-adjustment - Generates inv_stock_adjustments and calls recordMovementTx atomically
router.post(
  "/stock-takes/:id/post-adjustment",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      await ensureStockAdjustmentTables();
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status !== "APPROVED") {
        throw httpError(400, "BAD_REQUEST", `Stock take must be APPROVED before posting adjustment (current status: ${stk.status})`);
      }
      if (stk.adjustment_id) {
        throw httpError(400, "BAD_REQUEST", "Inventory adjustment has already been posted for this stock take.");
      }

      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name, i.uom
        FROM inv_daily_stock_count_details d
        JOIN inv_items i ON i.id = d.item_id
        WHERE d.count_id = :id
        `,
        { id },
      );

      const varianceLines = details.filter((d) => Math.abs(Number(d.variance_qty || 0)) >= 0.0001);

      await conn.beginTransaction();

      let adjId = null;
      let adjNo = null;

      if (varianceLines.length > 0) {
        adjNo = await nextAdjustmentNo(companyId);
        const adjType = stk.stock_take_type === "DAILY" ? "DAILY_STOCK_TAKE" : "PHYSICAL_STOCK_TAKE";
        const [adjHdr] = await conn.execute(
          `
          INSERT INTO inv_stock_adjustments
            (company_id, branch_id, warehouse_id, adjustment_no, adjustment_date, adjustment_type, reference_doc, reason, status, remarks, created_by)
          VALUES
            (:companyId, :branchId, :warehouseId, :adjNo, NOW(), :adjType, :refDoc, 'Stock Take Variance Reconciliation', 'APPROVED', :remarks, :actorId)
          `,
          {
            companyId,
            branchId: stk.branch_id || branchId,
            warehouseId: stk.warehouse_id || null,
            adjNo,
            adjType,
            refDoc: stk.stock_take_no,
            remarks: `Auto-generated from ${stk.stock_take_type === "DAILY" ? "Daily" : "Physical"} Stock Take ${stk.stock_take_no}. Reconciled ${varianceLines.length} discrepancies.`,
            actorId,
          },
        );
        adjId = adjHdr.insertId;

        for (const line of varianceLines) {
          const vQty = Number(line.variance_qty || 0);
          const expQty = Number(line.expected_qty || 0);
          const physQty = Number(line.physical_qty || 0);
          const cost = Number(line.unit_cost || 0);
          const uom = String(line.uom || "PCS");

          await conn.execute(
            `
            INSERT INTO inv_stock_adjustment_details
              (adjustment_id, item_id, current_stock, adjusted_stock, qty, uom, unit_cost, unit_price, line_total, remarks)
            VALUES
              (:adjId, :itemId, :currentStock, :adjustedStock, :qty, :uom, :unitCost, :unitPrice, :lineTotal, :remarks)
            `,
            {
              adjId,
              itemId: line.item_id,
              currentStock: expQty,
              adjustedStock: physQty,
              qty: vQty,
              uom,
              unitCost: cost,
              unitPrice: cost,
              lineTotal: cost * Math.abs(vQty),
              remarks: line.variance_reason || "Stock Take Variance",
            },
          );

          await recordMovementTx(conn, {
            companyId,
            branchId: stk.branch_id || branchId,
            warehouseId: stk.warehouse_id || null,
            itemId: line.item_id,
            transactionType: "STOCK_ADJUSTMENT",
            qtyChange: vQty,
            sourceRef: adjId,
            createdBy: actorId,
          });
        }
      }

      await conn.execute(
        `
        UPDATE inv_daily_stock_counts
        SET status = 'ADJUSTMENT_POSTED',
            adjustment_id = :adjId
        WHERE id = :id
        `,
        { id, adjId },
      );

      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "POST_ADJUSTMENT",
        "APPROVED",
        "ADJUSTMENT_POSTED",
        adjNo
          ? `Inventory Adjustment ${adjNo} posted. Corrected balances for ${varianceLines.length} items.`
          : "Stock Take closed. All items matched baseline (zero variances).",
      );

      await conn.commit();
      res.json({
        ok: true,
        status: "ADJUSTMENT_POSTED",
        adjustment_id: adjId,
        adjustment_no: adjNo,
        adjusted_items_count: varianceLines.length,
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

// 10. POST /stock-takes/:id/cancel - Cancels stock take
router.post(
  "/stock-takes/:id/cancel",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureStockCountTables();
      const { companyId } = req.scope || {};
      const id = toNumber(req.params.id);
      const actorId = req.user?.sub || null;
      const actorName = req.user?.username || req.user?.name || "User";
      const { reason = "" } = req.body || {};

      const [stk] = await query(
        `SELECT * FROM inv_daily_stock_counts WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!stk) throw httpError(404, "NOT_FOUND", "Stock take not found");
      if (stk.status === "ADJUSTMENT_POSTED" || stk.status === "CLOSED") {
        throw httpError(400, "BAD_REQUEST", "Cannot cancel an already posted/closed stock take");
      }

      await conn.beginTransaction();
      await conn.execute(
        `UPDATE inv_daily_stock_counts SET status = 'CANCELLED' WHERE id = :id`,
        { id },
      );
      await logStockTakeAction(
        id,
        actorId,
        actorName,
        "CANCEL",
        stk.status,
        "CANCELLED",
        `Stock Take cancelled. Reason: ${reason || "User cancelled"}`,
      );
      await conn.commit();

      res.json({ ok: true, status: "CANCELLED" });
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

// Stock Reorder Points
async function ensureStockReorderTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_stock_reorder_points (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NOT NULL,
      reorder_level DECIMAL(18,3) NOT NULL DEFAULT 0,
      reorder_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      max_stock DECIMAL(18,3),
      min_stock DECIMAL(18,3),
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_reorder (company_id, branch_id, item_id, warehouse_id),
      KEY idx_item (item_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

router.get(
  "/stock-reorder",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureStockReorderTables();
      const { companyId, branchId = null } = req.scope || {};
      const rows = await query(
        `
        SELECT r.*, i.item_code, i.item_name, w.warehouse_name,
               COALESCE(s.qty, 0) AS current_qty,
          r.created_at,
          u.username AS created_by_name
         FROM inv_stock_reorder_points r
        LEFT JOIN inv_items i ON i.id = r.item_id
        LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
        LEFT JOIN inv_stock_balances s ON s.item_id = r.item_id AND s.warehouse_id = r.warehouse_id
        LEFT JOIN adm_users u ON u.id = r.created_by
         WHERE r.company_id = :companyId AND r.branch_id = :branchId AND r.is_active = 1
        ORDER BY i.item_name, w.warehouse_name
        `,
        { companyId: companyId || null, branchId: branchId || null },
      );
      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// Items endpoints
let _itemsTableEnsured = false;
async function ensureItemsTable() {
  if (_itemsTableEnsured) return;
  _itemsTableEnsured = true;
  await query(`
    CREATE TABLE IF NOT EXISTS inv_items (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      company_id BIGINT UNSIGNED NOT NULL,
      item_code VARCHAR(50) NOT NULL,
      item_name VARCHAR(255) NOT NULL,
      uom VARCHAR(20) DEFAULT 'PCS',
      item_type VARCHAR(50) DEFAULT 'INVENTORY',
      category VARCHAR(100),
      category_id BIGINT UNSIGNED NULL,
      description TEXT,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_item_code (company_id, item_code),
      KEY idx_item_name (item_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
  // Ensure UOM column exists and update any null/empty values
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS uom VARCHAR(20) DEFAULT 'PCS'
  `).catch(() => {});
  // Ensure stock level columns exist
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS min_stock_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS max_stock_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS reorder_level DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS category_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS barcode VARCHAR(120) NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS cost_price DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS selling_price DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS currency_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS item_group_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS safety_stock DECIMAL(18,3) DEFAULT 0
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS created_by BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS vat_on_purchase_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS vat_on_sales_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS purchase_account_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS sales_account_id BIGINT UNSIGNED NULL
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS service_item CHAR(1) NOT NULL DEFAULT 'N'
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS is_stockable CHAR(1) NOT NULL DEFAULT 'Y'
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS is_sellable CHAR(1) NOT NULL DEFAULT 'Y'
  `).catch(() => {});
  await query(`
    ALTER TABLE inv_items ADD COLUMN IF NOT EXISTS is_purchasable CHAR(1) NOT NULL DEFAULT 'Y'
  `).catch(() => {});
  // Add unique constraint on item_name per company to detect and reject duplicates
  await query(`
    ALTER TABLE inv_items ADD UNIQUE KEY uq_item_name (company_id, item_name)
  `).catch(() => {});
  // Update any items with NULL or empty UOM to default 'PCS'
  await query(`
    UPDATE inv_items SET uom = 'PCS' WHERE uom IS NULL OR uom = ''
  `).catch(() => {});
}

router.get("/items/:id", requireAuth, async (req, res, next) => {
  try {
    await ensureItemsTable();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const [item] = await query(
      `SELECT i.*,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.id = :id LIMIT 1`,
      { id: id || null },
    );
    if (!item) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ item });
  } catch (e) {
    next(e);
  }
});

router.post(
  "/items/bulk",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureItemsTable();
      const { companyId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const items = Array.isArray(req.body?.items)
        ? req.body.items
        : Array.isArray(req.body?.rows)
          ? req.body.rows
          : [];

      if (!items.length) {
        return res.json({ inserted: 0, updated: 0, failed: 0 });
      }

      await conn.beginTransaction();

      let inserted = 0;
      let updated = 0;
      let failed = 0;

      // Get current max code for auto-generation
      const [codeRows] = await conn.execute(
        `SELECT item_code FROM inv_items 
         WHERE company_id = :companyId AND item_code LIKE 'ITM-%' 
         ORDER BY id DESC LIMIT 10`,
        { companyId },
      );
      let currentMax = 0;
      (codeRows || []).forEach((r) => {
        const m = String(r.item_code || "").match(/(\d+)/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > currentMax) currentMax = n;
        }
      });

      for (const item of items) {
        try {
          let itemCode = item.item_code ? String(item.item_code).trim() : null;
          if (!itemCode) {
            currentMax++;
            itemCode = `ITM-${String(currentMax).padStart(6, "0")}`;
          }

          const itemName = item.item_name
            ? String(item.item_name).trim()
            : null;
          if (!itemName) {
            failed++;
            continue;
          }

          const uom = item.uom ? String(item.uom).trim() : "PCS";
          const itemType = item.item_type || "INVENTORY";
          const categoryId = toNumber(item.category_id);
          const itemGroupId = toNumber(item.item_group_id);
          const costPrice = Number(item.cost_price || 0);
          const sellingPrice = Number(item.selling_price || 0);
          const isActive =
            item.is_active === false || item.is_active === 0 ? 0 : 1;
          const barcode = item.barcode
            ? String(item.barcode).trim() || null
            : null;
          const currencyId = toNumber(item.currency_id);
          const imageUrl = item.image_url
            ? String(item.image_url).trim() || null
            : null;
          const vatOnPurchaseId = toNumber(item.vat_on_purchase_id);
          const vatOnSalesId = toNumber(item.vat_on_sales_id);
          const purchaseAccountId = toNumber(item.purchase_account_id);
          const salesAccountId = toNumber(item.sales_account_id);
          const serviceItem =
            String(item.service_item || "N").toUpperCase() === "Y" ? "Y" : "N";
          const isStockable =
            String(item.is_stockable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
          const isSellable =
            String(item.is_sellable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
          const isPurchasable =
            String(item.is_purchasable ?? "Y").toUpperCase() === "Y"
              ? "Y"
              : "N";
          const minStockLevel = Number(item.min_stock_level || 0);
          const maxStockLevel = Number(item.max_stock_level || 0);
          const reorderLevel = Number(item.reorder_level || 0);
          const safetyStock = Number(item.safety_stock || 0);
          const description = item.description
            ? String(item.description).trim() || null
            : null;

          // Check if exists
          const [existing] = await conn.execute(
            `SELECT id FROM inv_items WHERE company_id = :companyId AND item_code = :itemCode LIMIT 1`,
            { companyId, itemCode },
          );

          if (existing && existing.length > 0) {
            const itemId = existing[0].id;
            await conn.execute(
              `UPDATE inv_items SET
                item_name = :itemName, uom = :uom, item_type = :itemType,
                category_id = :categoryId, item_group_id = :itemGroupId,
                cost_price = :costPrice, selling_price = :sellingPrice, is_active = :isActive,
                barcode = :barcode, currency_id = :currencyId, image_url = :imageUrl,
                vat_on_purchase_id = :vatOnPurchaseId, vat_on_sales_id = :vatOnSalesId,
                purchase_account_id = :purchaseAccountId, sales_account_id = :salesAccountId,
                service_item = :serviceItem, is_stockable = :isStockable, is_sellable = :isSellable,
                is_purchasable = :isPurchasable, min_stock_level = :minStockLevel,
                max_stock_level = :maxStockLevel, reorder_level = :reorderLevel,
                safety_stock = :safetyStock, description = :description
               WHERE id = :itemId`,
              {
                itemName,
                uom,
                itemType,
                categoryId,
                itemGroupId,
                costPrice,
                sellingPrice,
                isActive,
                barcode,
                currencyId,
                imageUrl,
                vatOnPurchaseId,
                vatOnSalesId,
                purchaseAccountId,
                salesAccountId,
                serviceItem,
                isStockable,
                isSellable,
                isPurchasable,
                minStockLevel,
                maxStockLevel,
                reorderLevel,
                safetyStock,
                description,
                itemId,
              },
            );
            updated++;
          } else {
            await conn.execute(
              `INSERT INTO inv_items (
                company_id, item_code, item_name, uom, item_type,
                category_id, item_group_id, cost_price, selling_price, is_active, created_by,
                barcode, currency_id, image_url, vat_on_purchase_id, vat_on_sales_id,
                purchase_account_id, sales_account_id, service_item, is_stockable, is_sellable,
                is_purchasable, min_stock_level, max_stock_level, reorder_level, safety_stock,
                description
              ) VALUES (
                :companyId, :itemCode, :itemName, :uom, :itemType,
                :categoryId, :itemGroupId, :costPrice, :sellingPrice, :isActive, :createdBy,
                :barcode, :currencyId, :imageUrl, :vatOnPurchaseId, :vatOnSalesId,
                :purchaseAccountId, :salesAccountId, :serviceItem, :isStockable, :isSellable,
                :isPurchasable, :minStockLevel, :maxStockLevel, :reorderLevel, :safetyStock,
                :description
              )`,
              {
                companyId,
                itemCode,
                itemName,
                uom,
                itemType,
                categoryId,
                itemGroupId,
                costPrice,
                sellingPrice,
                isActive,
                createdBy: userId,
                barcode,
                currencyId,
                imageUrl,
                vatOnPurchaseId,
                vatOnSalesId,
                purchaseAccountId,
                salesAccountId,
                serviceItem,
                isStockable,
                isSellable,
                isPurchasable,
                minStockLevel,
                maxStockLevel,
                reorderLevel,
                safetyStock,
                description,
              },
            );
            inserted++;
          }
        } catch (itemErr) {
          console.error("Bulk item error:", itemErr);
          failed++;
        }
      }

      await conn.commit();
      res.json({ inserted, updated, failed });
    } catch (e) {
      await conn.rollback();
      next(e);
    } finally {
      conn.release();
    }
  },
);

router.post(
  "/items",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemsTable();
      const { companyId = null, branchId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const body = req.body || {};
      let itemCode = body.item_code ? String(body.item_code).trim() : null;

      if (!itemCode) {
        const rows = await query(
          `SELECT item_code FROM inv_items 
           WHERE company_id = :companyId AND item_code LIKE 'ITM-%' 
           ORDER BY id DESC LIMIT 10`,
          { companyId },
        );
        let maxNum = 0;
        (rows || []).forEach((r) => {
          const m = String(r.item_code || "").match(/(\d+)/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (n > maxNum) maxNum = n;
          }
        });
        itemCode = `ITM-${String(maxNum + 1).padStart(6, "0")}`;
      }

      const itemName = body.item_name ? String(body.item_name).trim() : null;
      const uom = body.uom ? String(body.uom).trim() : "PCS";
      const itemType = body.item_type
        ? String(body.item_type).trim()
        : "INVENTORY";
      const categoryId = toNumber(body.category_id || body.category);
      const itemGroupId = toNumber(body.item_group_id || body.group_id);
      const barcode = body.barcode ? String(body.barcode).trim() || null : null;
      const costPrice = Number(body.cost_price || 0);
      const sellingPrice = Number(body.selling_price || 0);
      const currencyId = toNumber(body.currency_id);
      const vatOnPurchaseId = toNumber(body.vat_on_purchase_id);
      const vatOnSalesId = toNumber(body.vat_on_sales_id);
      const purchaseAccountId = toNumber(body.purchase_account_id);
      const salesAccountId = toNumber(body.sales_account_id);
      const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
      const serviceItem =
        String(body.service_item || "N").toUpperCase() === "Y" ? "Y" : "N";
      const isStockable =
        String(body.is_stockable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const isSellable =
        String(body.is_sellable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const isPurchasable =
        String(body.is_purchasable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const minStockLevel = Number(body.min_stock_level || 0);
      const maxStockLevel = Number(body.max_stock_level || 0);
      const reorderLevel = Number(body.reorder_level || 0);
      const safetyStock = Number(body.safety_stock || 0);
      const description = body.description
        ? String(body.description).trim() || null
        : null;
      const openingQuantity = Number(body.opening_quantity || 0);
      const openingWarehouseId = body.opening_warehouse_id ? toNumber(body.opening_warehouse_id) : null;

      if (!itemCode || !itemName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_code and item_name are required",
        );
      }

      const resultRaw = await query(
        `
        INSERT INTO inv_items
        (
          company_id, item_code, item_name, uom, item_type, category_id, item_group_id,
          barcode, cost_price, selling_price, currency_id,
          vat_on_purchase_id, vat_on_sales_id, purchase_account_id, sales_account_id,
          description, min_stock_level, max_stock_level, reorder_level, safety_stock,
          service_item, is_stockable, is_sellable, is_purchasable, is_active
          , created_by
        )
        VALUES (
          :companyId, :itemCode, :itemName, :uom, :itemType, :categoryId, :itemGroupId,
          :barcode, :costPrice, :sellingPrice, :currencyId,
          :vatOnPurchaseId, :vatOnSalesId, :purchaseAccountId, :salesAccountId,
          :description, :minStockLevel, :maxStockLevel, :reorderLevel, :safetyStock,
          :serviceItem, :isStockable, :isSellable, :isPurchasable, :isActive
          , :createdBy
        )
        `,
        {
          companyId: companyId || null,
          itemCode: itemCode || null,
          itemName: itemName || null,
          uom: uom || "PCS",
          itemType: itemType || "INVENTORY",
          categoryId: categoryId || null,
          itemGroupId: itemGroupId || null,
          barcode: barcode || null,
          costPrice: Number.isFinite(costPrice) ? costPrice : 0,
          sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
          currencyId: currencyId || null,
          vatOnPurchaseId: vatOnPurchaseId || null,
          vatOnSalesId: vatOnSalesId || null,
          purchaseAccountId: purchaseAccountId || null,
          salesAccountId: salesAccountId || null,
          description: description || null,
          minStockLevel: Number.isFinite(minStockLevel) ? minStockLevel : 0,
          maxStockLevel: Number.isFinite(maxStockLevel) ? maxStockLevel : 0,
          reorderLevel: Number.isFinite(reorderLevel) ? reorderLevel : 0,
          safetyStock: Number.isFinite(safetyStock) ? safetyStock : 0,
          serviceItem,
          isStockable,
          isSellable,
          isPurchasable,
          isActive,
          createdBy: userId,
        },
      );
      const result = Array.isArray(resultRaw) ? resultRaw[0] : resultRaw;
      const itemId = result.insertId;

      if (openingQuantity > 0 && openingWarehouseId) {
        const updationNo = `UPD-OP-${Date.now()}`;
        
        // Fetch warehouse branch_id
        const whRes = await query('SELECT branch_id FROM inv_warehouses WHERE id = :warehouseId', { warehouseId: openingWarehouseId });
        const actualBranchId = whRes && whRes.length > 0 ? whRes[0].branch_id : null;
        
        // 1. Create Stock Updation Header
        const updRaw = await query(
          `INSERT INTO inv_stock_updations 
             (company_id, branch_id, warehouse_id, updation_no, updation_date, reason, status, created_by)
           VALUES 
             (:companyId, :branchId, :warehouseId, :updationNo, NOW(), 'Opening Balance', 'APPROVED', :createdBy)`,
          {
            companyId: companyId || null,
            branchId: actualBranchId,
            warehouseId: openingWarehouseId,
            updationNo,
            createdBy: userId
          }
        );
        const updationId = (Array.isArray(updRaw) ? updRaw[0] : updRaw).insertId;
        
        // 2. Create Stock Updation Detail
        await query(
          `INSERT INTO inv_stock_updation_details 
             (updation_id, item_id, qty, uom, current_stock, created_by)
           VALUES 
             (:updationId, :itemId, :qty, :uom, 0, :createdBy)`,
          {
            updationId,
            itemId,
            qty: openingQuantity,
            uom: uom || "PCS",
            createdBy: userId
          }
        );

        // 3. Update physical stock balance
        const sbRows = await query(
          `SELECT qty FROM inv_stock_balances 
            WHERE company_id = :companyId AND warehouse_id = :warehouseId AND item_id = :itemId
            LIMIT 1`,
          { companyId: companyId || null, warehouseId: openingWarehouseId, itemId }
        );
        
        if (Array.isArray(sbRows) && sbRows.length > 0) {
          await query(
            `UPDATE inv_stock_balances SET qty = qty + :delta, updated_at = NOW()
              WHERE company_id = :companyId AND warehouse_id = :warehouseId AND item_id = :itemId`,
            { delta: openingQuantity, companyId: companyId || null, warehouseId: openingWarehouseId, itemId }
          );
        } else {
          await query(
            `INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
             VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)`,
            { companyId: companyId || null, branchId: actualBranchId, warehouseId: openingWarehouseId, itemId, qty: openingQuantity }
          );
        }
      }

      res.status(201).json({ id: itemId, item_code: itemCode });
    } catch (e) {
      // Handle duplicate key errors
      if (
        e?.code === "ER_DUP_ENTRY" ||
        /duplicate entry/i.test(e?.message || "")
      ) {
        if (/uq_item_code/i.test(e?.message || "")) {
          throw httpError(
            409,
            "DUPLICATE_ITEM_CODE",
            "An item with this code already exists",
          );
        }
        if (/uq_item_name/i.test(e?.message || "")) {
          throw httpError(
            409,
            "DUPLICATE_ITEM_NAME",
            "An item with this name already exists",
          );
        }
        throw httpError(
          409,
          "DUPLICATE_ENTRY",
          "An item with this code or name already exists",
        );
      }
      next(e);
    }
  },
);

router.put(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemsTable();
      const { companyId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const itemCode = body.item_code ? String(body.item_code).trim() : null;
      const itemName = body.item_name ? String(body.item_name).trim() : null;
      const uom = body.uom ? String(body.uom).trim() : "PCS";
      const itemType = body.item_type
        ? String(body.item_type).trim()
        : "INVENTORY";
      const categoryId = toNumber(body.category_id || body.category);
      const itemGroupId = toNumber(body.item_group_id || body.group_id);
      const barcode = body.barcode ? String(body.barcode).trim() || null : null;
      const costPrice = Number(body.cost_price || 0);
      const sellingPrice = Number(body.selling_price || 0);
      const currencyId = toNumber(body.currency_id);
      const vatOnPurchaseId = toNumber(body.vat_on_purchase_id);
      const vatOnSalesId = toNumber(body.vat_on_sales_id);
      const purchaseAccountId = toNumber(body.purchase_account_id);
      const salesAccountId = toNumber(body.sales_account_id);
      const isActive = body.is_active === false || body.is_active === 0 ? 0 : 1;
      const serviceItem =
        String(body.service_item || "N").toUpperCase() === "Y" ? "Y" : "N";
      const isStockable =
        String(body.is_stockable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const isSellable =
        String(body.is_sellable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const isPurchasable =
        String(body.is_purchasable ?? "Y").toUpperCase() === "Y" ? "Y" : "N";
      const minStockLevel = Number(body.min_stock_level || 0);
      const maxStockLevel = Number(body.max_stock_level || 0);
      const reorderLevel = Number(body.reorder_level || 0);
      const safetyStock = Number(body.safety_stock || 0);
      const description = body.description
        ? String(body.description).trim() || null
        : null;

      if (!itemCode || !itemName) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_code and item_name are required",
        );
      }

      const updRaw = await query(
        `
        UPDATE inv_items
        SET item_code = :itemCode,
            item_name = :itemName,
            uom = :uom,
            item_type = :itemType,
            category_id = :categoryId,
            item_group_id = :itemGroupId,
            barcode = :barcode,
            cost_price = :costPrice,
            selling_price = :sellingPrice,
            currency_id = :currencyId,
            vat_on_purchase_id = :vatOnPurchaseId,
            vat_on_sales_id = :vatOnSalesId,
            purchase_account_id = :purchaseAccountId,
            sales_account_id = :salesAccountId,
            description = :description,
            min_stock_level = :minStockLevel,
            max_stock_level = :maxStockLevel,
            reorder_level = :reorderLevel,
            safety_stock = :safetyStock,
            service_item = :serviceItem,
            is_stockable = :isStockable,
            is_sellable = :isSellable,
            is_purchasable = :isPurchasable,
            is_active = :isActive
        WHERE id = :id AND company_id = :companyId
        `,
        {
          id: id || null,
          companyId: companyId || null,
          itemCode: itemCode || null,
          itemName: itemName || null,
          uom: uom || "PCS",
          itemType: itemType || "INVENTORY",
          categoryId: categoryId || null,
          itemGroupId: itemGroupId || null,
          barcode: barcode || null,
          costPrice: Number.isFinite(costPrice) ? costPrice : 0,
          sellingPrice: Number.isFinite(sellingPrice) ? sellingPrice : 0,
          currencyId: currencyId || null,
          vatOnPurchaseId: vatOnPurchaseId || null,
          vatOnSalesId: vatOnSalesId || null,
          purchaseAccountId: purchaseAccountId || null,
          salesAccountId: salesAccountId || null,
          description: description || null,
          minStockLevel: Number.isFinite(minStockLevel) ? minStockLevel : 0,
          maxStockLevel: Number.isFinite(maxStockLevel) ? maxStockLevel : 0,
          reorderLevel: Number.isFinite(reorderLevel) ? reorderLevel : 0,
          safetyStock: Number.isFinite(safetyStock) ? safetyStock : 0,
          serviceItem,
          isStockable,
          isSellable,
          isPurchasable,
          isActive,
        },
      );
      const upd = Array.isArray(updRaw) ? updRaw[0] : updRaw;
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item not found");
      res.json({ ok: true });
    } catch (e) {
      // Handle duplicate key errors
      if (
        e?.code === "ER_DUP_ENTRY" ||
        /duplicate entry/i.test(e?.message || "")
      ) {
        if (/uq_item_code/i.test(e?.message || "")) {
          throw httpError(
            409,
            "DUPLICATE_ITEM_CODE",
            "An item with this code already exists",
          );
        }
        if (/uq_item_name/i.test(e?.message || "")) {
          throw httpError(
            409,
            "DUPLICATE_ITEM_NAME",
            "An item with this name already exists",
          );
        }
        throw httpError(
          409,
          "DUPLICATE_ENTRY",
          "An item with this code or name already exists",
        );
      }
      next(e);
    }
  },
);

router.patch(
  "/items/:id/status",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureItemsTable();
      const { companyId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const { is_active } = req.body;
      const isActiveVal =
        is_active === true || is_active === 1 || is_active === "1" || is_active === "Y"
          ? 1
          : 0;

      const updRaw = await query(
        `UPDATE inv_items SET is_active = :isActive WHERE id = :id AND company_id = :companyId`,
        { id, companyId, isActive: isActiveVal },
      );
      const upd = Array.isArray(updRaw) ? updRaw[0] : updRaw;
      if (!upd?.affectedRows && upd?.affectedRows !== 0) {
        const [exists] = await query(
          `SELECT id FROM inv_items WHERE id = :id AND company_id = :companyId LIMIT 1`,
          { id, companyId },
        );
        if (!exists) throw httpError(404, "NOT_FOUND", "Item not found");
      }
      res.json({ ok: true, is_active: isActiveVal });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/items/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { companyId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;

      const hasPerm = await userHasExceptionalAllow(userId, "INVENTORY.ITEM.DELETE");
      if (!hasPerm) {
        throw httpError(403, "FORBIDDEN", "You do not have exceptional permission to delete items");
      }

      const [result] = await pool.query(
        "DELETE FROM inv_items WHERE id = ? AND company_id = ?",
        [id, companyId]
      );

      if (result.affectedRows === 0) {
        throw httpError(404, "NOT_FOUND", "Item not found");
      }

      res.json({ success: true, message: "Item deleted successfully" });
    } catch (e) {
      if (e.code === "ER_ROW_IS_REFERENCED_2") {
        next(httpError(409, "CONSTRAINT_ERROR", "Cannot delete item because it is in use by other records"));
      } else {
        next(e);
      }
    }
  }
);

// ─── Cost Price Endpoints ──────────────────────────────────────────────────
router.post(
  "/items/cost-price",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const body = req.body || {};
      const itemId = toNumber(body.item_id);
      const costPrice = Number(body.cost_price);
      if (!itemId) throw httpError(400, "VALIDATION_ERROR", "item_id is required");
      if (!Number.isFinite(costPrice) || costPrice < 0)
        throw httpError(400, "VALIDATION_ERROR", "Valid cost_price is required");
      const upd = await query(
        "UPDATE inv_items SET cost_price = :costPrice WHERE id = :id AND company_id = :companyId",
        { costPrice, id: itemId, companyId },
      );
      if (!upd.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item not found");
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/items/cost-prices/bulk",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length)
        throw httpError(400, "VALIDATION_ERROR", "No items provided");
      let updated = 0;
      let notFound = 0;
      for (const row of items) {
        const itemCode = String(row.item_code || row["Item Code"] || "").trim();
        const costPriceVal = row["New Cost Price"] ?? row["Cost Price"] ?? row.cost_price ?? row["Current Cost Price"] ?? 0;
        const costPrice = Number(costPriceVal);
        if (!itemCode || !Number.isFinite(costPrice)) continue;
        const [existing] = await query(
          "SELECT id FROM inv_items WHERE item_code = :itemCode AND company_id = :companyId LIMIT 1",
          { itemCode, companyId },
        );
        if (!existing) { notFound++; continue; }
        await query(
          "UPDATE inv_items SET cost_price = :costPrice WHERE id = :id",
          { costPrice, id: existing.id },
        );
        updated++;
      }
      res.json({ ok: true, updated, notFound });
    } catch (e) {
      next(e);
    }
  },
);

// ─── Supplier-Item Link Table ────────────────────────────────────────────
async function ensureSupplierItemsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_supplier_items (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      supplier_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      min_stock_level DECIMAL(18,3) DEFAULT 0,
      max_stock_level DECIMAL(18,3) DEFAULT 0,
      reorder_level DECIMAL(18,3) DEFAULT 0,
      lead_time INT DEFAULT 0,
      preferred TINYINT(1) DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_supplier_item (company_id, branch_id, supplier_id, item_id),
      KEY idx_supplier (supplier_id),
      KEY idx_item (item_id),
      CONSTRAINT fk_si_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_si_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_si_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id),
      CONSTRAINT fk_si_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

// ─── Reorder Points Table ────────────────────────────────────────────────
async function ensureReorderPointsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS inv_reorder_points (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      branch_id BIGINT UNSIGNED NOT NULL,
      warehouse_id BIGINT UNSIGNED NOT NULL,
      item_id BIGINT UNSIGNED NOT NULL,
      min_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
      max_stock DECIMAL(18,3) NOT NULL DEFAULT 0,
      reorder_qty DECIMAL(18,3) NOT NULL DEFAULT 0,
      lead_time INT DEFAULT 0,
      supplier_id BIGINT UNSIGNED NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_reorder_point (company_id, branch_id, warehouse_id, item_id),
      KEY idx_rp_company_branch (company_id, branch_id),
      KEY idx_rp_warehouse (warehouse_id),
      KEY idx_rp_item (item_id),
      CONSTRAINT fk_rp_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
      CONSTRAINT fk_rp_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
      CONSTRAINT fk_rp_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id),
      CONSTRAINT fk_rp_item FOREIGN KEY (item_id) REFERENCES inv_items(id),
      CONSTRAINT fk_rp_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `).catch(() => {});
}

// ─── Reorder Points Endpoints ─────────────────────────────────────────────
router.get(
  "/reorder-points",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensureReorderPointsTable();
      const { companyId, branchId = null } = req.scope || {};
      const { warehouseId, search, status } = req.query;

      let where =
        "WHERE rp.company_id = :companyId AND rp.branch_id = :branchId";
      const params = { companyId, branchId };

      if (warehouseId) {
        where += " AND rp.warehouse_id = :warehouseId";
        params.warehouseId = toNumber(warehouseId);
      }

      if (search) {
        where += " AND (i.item_code LIKE :search OR i.item_name LIKE :search)";
        params.search = `%${String(search).trim()}%`;
      }

      const rows = await query(
        `
        SELECT 
          rp.id,
          rp.warehouse_id,
          rp.supplier_id,
          rp.item_id,
          rp.min_stock,
          rp.max_stock,
          rp.reorder_qty,
          rp.lead_time,
          i.item_code,
          i.item_name,
          i.uom,
          w.warehouse_name,
          s.supplier_name,
          COALESCE(sb.qty, 0) AS current_stock,
          rp.created_at,
          u.username AS created_by_name
         FROM inv_reorder_points rp
        JOIN inv_items i ON i.id = rp.item_id
        JOIN inv_warehouses w ON w.id = rp.warehouse_id
        LEFT JOIN pur_suppliers s ON s.id = rp.supplier_id
        LEFT JOIN inv_stock_balances sb ON sb.company_id = rp.company_id 
          AND sb.branch_id = rp.branch_id 
          AND sb.warehouse_id = rp.warehouse_id 
          AND sb.item_id = rp.item_id
        ${where}
        LEFT JOIN adm_users u ON u.id = rp.created_by
         ORDER BY i.item_name ASC
        `,
        params,
      ).catch(() => []);

      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/reorder-points",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReorderPointsTable();
      await ensureSupplierItemsTable();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};

      const warehouseId = toNumber(body.warehouse_id);
      const itemId = toNumber(body.item_id);
      const supplierId = toNumber(body.supplier_id);
      const minStock = Number(body.min_stock || 0);
      const maxStock = Number(body.max_stock || 0);
      const reorderQty = Number(body.reorder_qty || 0);
      const leadTime = Number(body.lead_time || 0);

      if (!itemId || !warehouseId) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "item_id and warehouse_id are required",
        );
      }

      await conn.beginTransaction();

      // Insert or update reorder point for warehouse
      await conn.execute(
        `
        INSERT INTO inv_reorder_points 
          (company_id, branch_id, warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, supplier_id, is_active)
        VALUES 
          (:companyId, :branchId, :warehouseId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, :supplierId, 1)
        ON DUPLICATE KEY UPDATE
          min_stock = :minStock,
          max_stock = :maxStock,
          reorder_qty = :reorderQty,
          lead_time = :leadTime,
          supplier_id = :supplierId
        `,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          minStock,
          maxStock,
          reorderQty,
          leadTime,
          supplierId,
        },
      );

      // Insert or update supplier-item link if supplier is provided
      if (supplierId) {
        await conn.execute(
          `
          INSERT INTO inv_supplier_items 
            (company_id, branch_id, supplier_id, item_id, min_stock_level, max_stock_level, reorder_level, lead_time, preferred)
          VALUES 
            (:companyId, :branchId, :supplierId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, 1)
          ON DUPLICATE KEY UPDATE
            min_stock_level = :minStock,
            max_stock_level = :maxStock,
            reorder_level = :reorderQty,
            lead_time = :leadTime,
            preferred = 1
          `,
          {
            companyId,
            branchId,
            supplierId,
            itemId,
            minStock,
            maxStock,
            reorderQty,
            leadTime,
          },
        );
      }

      // Update inv_items table with stock levels
      await conn.execute(
        `
        UPDATE inv_items
        SET min_stock_level = :minStock,
            max_stock_level = :maxStock,
            reorder_level = :reorderQty
        WHERE id = :itemId AND company_id = :companyId
        `,
        { itemId, companyId, minStock, maxStock, reorderQty },
      );

      await conn.commit();
      res.status(201).json({ ok: true, item_id: itemId });
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

router.delete(
  "/reorder-points/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);

      if (!id) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      }

      await conn.beginTransaction();

      // Delete from inv_reorder_points
      await conn.execute(
        `
        DELETE FROM inv_reorder_points
        WHERE id = :id AND company_id = :companyId AND branch_id = :branchId
        `,
        { id, companyId, branchId },
      );

      await conn.commit();
      res.json({ ok: true });
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

// Bulk Reorder Template Export
router.get(
  "/reorder-points/export/template",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      console.log("📥 Template export request received");
      console.log(
        "🔐 Auth scope - Company:",
        req.scope?.companyId,
        "Branch:",
        req.scope?.branchId,
      );
      await ensureReorderPointsTable();
      const { companyId, branchId = null } = req.scope || {};
      console.log("🔍 Fetching items and warehouses for company:", companyId);

      // Fetch all items and warehouses for this company/branch
      const [items] = await query(
        `
        SELECT id, item_code, item_name, uom,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND is_active = 1
        ORDER BY item_code ASC
        `,
        { companyId },
      );
      console.log("📦 Items found:", items?.length || 0);

      const [warehouses] = await query(
        `
        SELECT id, warehouse_name,
          created_at,
          u.username AS created_by_name
         FROM inv_warehouses
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND branch_id = :branchId
        ORDER BY warehouse_name ASC
        `,
        { companyId, branchId },
      );
      console.log("🏭 Warehouses found:", warehouses?.length || 0);
      const hasItems = Array.isArray(items) && items.length > 0;
      const hasWarehouses = Array.isArray(warehouses) && warehouses.length > 0;

      // Create template data: Cartesian product of items x warehouses
      const templateData = [];
      if (hasItems && hasWarehouses) {
        for (const item of items) {
          for (const warehouse of warehouses) {
            templateData.push({
              "Item Code": item.item_code,
              "Item Name": item.item_name,
              UOM: item.uom || "PCS",
              Warehouse: warehouse.warehouse_name,
              "Min Stock": "",
              "Max Stock": "",
              "Reorder Qty": "",
              "Lead Time (Days)": "",
            });
          }
        }
      } else {
        templateData.push({
          "Item Code": "",
          "Item Name": "",
          UOM: "",
          Warehouse: "",
          "Min Stock": "",
          "Max Stock": "",
          "Reorder Qty": "",
          "Lead Time (Days)": "",
        });
      }

      // Create workbook and sheet
      const ws = XLSX.utils.json_to_sheet(templateData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reorder Points");

      // Auto-size columns
      const colWidths = [
        { wch: 15 }, // Item Code
        { wch: 25 }, // Item Name
        { wch: 10 }, // UOM
        { wch: 20 }, // Warehouse
        { wch: 12 }, // Min Stock
        { wch: 12 }, // Max Stock
        { wch: 12 }, // Reorder Qty
        { wch: 15 }, // Lead Time
      ];
      ws["!cols"] = colWidths;

      // Generate buffer and send
      console.log(
        "📊 Generated template data with",
        templateData.length,
        "rows",
      );
      const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
      console.log("📦 Excel buffer created, size:", buffer.length, "bytes");
      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
      res.setHeader(
        "Content-Disposition",
        'attachment; filename="reorder_points_template.xlsx"',
      );
      res.send(buffer);
      console.log("✅ Template sent successfully");
    } catch (err) {
      console.error("❌ Template export error:", err);
      next(err);
    }
  },
);

// Bulk Reorder Upload
router.post(
  "/reorder-points/bulk-upload",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      await ensureReorderPointsTable();
      await ensureSupplierItemsTable();
      const { companyId, branchId = null } = req.scope || {};
      const body = req.body || {};
      const data = Array.isArray(body.data) ? body.data : [];

      if (!data.length) {
        throw httpError(400, "VALIDATION_ERROR", "No data provided");
      }

      await conn.beginTransaction();
      let processed = 0;
      const errors = [];

      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        try {
          const itemCode = String(row["Item Code"] || "").trim();
          const warehouseName = String(row["Warehouse"] || "").trim();
          const minStock = Number(row["Min Stock"] || 0);
          const maxStock = Number(row["Max Stock"] || 0);
          const reorderQty = Number(row["Reorder Qty"] || 0);
          const leadTime = Number(row["Lead Time (Days)"] || 0);

          if (!itemCode || !warehouseName) {
            errors.push(`Row ${i + 2}: Item Code and Warehouse are required`);
            continue;
          }

          // Find item ID by code
          const [itemResult] = await conn.execute(
            `SELECT id FROM inv_items WHERE company_id = :companyId AND item_code = :itemCode`,
            { companyId, itemCode },
          );
          if (!itemResult || !itemResult.length) {
            errors.push(`Row ${i + 2}: Item '${itemCode}' not found`);
            continue;
          }
          const itemId = itemResult[0].id;

          // Find warehouse ID by name
          const [whResult] = await conn.execute(
            `SELECT id FROM inv_warehouses WHERE company_id = :companyId AND branch_id = :branchId AND warehouse_name = :warehouseName`,
            { companyId, branchId, warehouseName },
          );
          if (!whResult || !whResult.length) {
            errors.push(`Row ${i + 2}: Warehouse '${warehouseName}' not found`);
            continue;
          }
          const warehouseId = whResult[0].id;

          // Upsert reorder point
          await conn.execute(
            `
            INSERT INTO inv_reorder_points 
              (company_id, branch_id, warehouse_id, item_id, min_stock, max_stock, reorder_qty, lead_time, is_active)
            VALUES 
              (:companyId, :branchId, :warehouseId, :itemId, :minStock, :maxStock, :reorderQty, :leadTime, 1)
            ON DUPLICATE KEY UPDATE
              min_stock = :minStock,
              max_stock = :maxStock,
              reorder_qty = :reorderQty,
              lead_time = :leadTime
            `,
            {
              companyId,
              branchId,
              warehouseId,
              itemId,
              minStock,
              maxStock,
              reorderQty,
              leadTime,
            },
          );

          // Update inv_items table with global stock levels
          await conn.execute(
            `
            UPDATE inv_items
            SET min_stock_level = :minStock,
                max_stock_level = :maxStock,
                reorder_level = :reorderQty
            WHERE id = :itemId AND company_id = :companyId
            `,
            { itemId, companyId, minStock, maxStock, reorderQty },
          );

          processed++;
        } catch (rowErr) {
          errors.push(`Row ${i + 2}: ${rowErr.message}`);
        }
      }

      await conn.commit();
      res.json({
        ok: true,
        processed,
        total: data.length,
        errors: errors.length > 0 ? errors : undefined,
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
  "/granular-balances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const { itemId, warehouseId, batchNo, search } = req.query || {};

      const clauses = [
        "company_id = :companyId",
        "branch_id = :branchId",
        "qty > 0",
      ];
      const params = { companyId, branchId };

      if (itemId) {
        clauses.push("item_id = :itemId");
        params.itemId = toNumber(itemId);
      }
      if (warehouseId) {
        clauses.push("warehouse_id = :warehouseId");
        params.warehouseId = toNumber(warehouseId);
      }
      if (batchNo) {
        clauses.push("batch_no = :batchNo");
        params.batchNo = batchNo;
      }
      if (search) {
        clauses.push(
          "(item_name LIKE :search OR item_code LIKE :search OR batch_no LIKE :search OR serial_no LIKE :search)",
        );
        params.search = `%${search}%`;
      }

      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

      const items = await query(
        `
        SELECT *
         FROM v_active_stock_details
        ${where}
         ORDER BY item_name ASC, entry_date ASC
        LIMIT 1000
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
  "/unit-conversions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const { itemId } = req.query;
      let sql = `
        SELECT c.id, c.company_id, c.item_id,
               i.item_code, i.item_name,
               c.from_uom, c.to_uom, c.conversion_factor, c.is_active,
               c.created_at,
               u.username AS created_by_name
          FROM inv_unit_conversions c
          LEFT JOIN inv_items i ON i.id = c.item_id
          LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId AND c.is_active = 1
      `;
      const params = { companyId };

      if (itemId) {
        sql += " AND c.item_id = :itemId";
        params.itemId = toNumber(itemId);
      }

      sql +=
        " ORDER BY i.item_name ASC, c.from_uom ASC, c.to_uom ASC, c.id ASC";
      const rows = await query(sql, params);
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/transfer-acceptance",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      // Fetch transfers where status is IN TRANSIT / IN_TRANSIT and to_branch_id = current branch
      const rows = await query(
        `
        SELECT t.*, 
               fw.warehouse_name AS from_warehouse_name,
               tw.warehouse_name AS to_warehouse_name,
          t.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfers t
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.company_id = :companyId 
          AND (
            COALESCE(tw.branch_id, 0) = :branchId
            OR COALESCE(t.to_branch_id, 0) = :branchId
            OR COALESCE(t.branch_id, 0) = :branchId
          )
          AND UPPER(REPLACE(COALESCE(t.status, ''), ' ', '_'))
              IN ('IN_TRANSIT', 'PARTIALLY_RECEIVED')
        ORDER BY t.transfer_date DESC, t.id DESC
        `,
        { companyId, branchId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/transfer-acceptance/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

      const rows = await query(
        `
        SELECT t.*, 
               fw.warehouse_name AS from_warehouse_name,
               tw.warehouse_name AS to_warehouse_name,
          t.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfers t
        LEFT JOIN inv_warehouses fw ON fw.id = t.from_warehouse_id
        LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.id = :id
          AND t.company_id = :companyId
          AND (
            COALESCE(tw.branch_id, 0) = :branchId
            OR COALESCE(t.to_branch_id, 0) = :branchId
            OR COALESCE(t.branch_id, 0) = :branchId
          )
        LIMIT 1
        `,
        { id, companyId, branchId },
      );

      const item = rows?.[0] || null;
      if (!item) throw httpError(404, "NOT_FOUND", "Transfer not found");

      const details = await query(
        `
        SELECT d.*, i.item_code, i.item_name,
               COALESCE(d.qty - COALESCE(d.received_qty, 0), 0) AS remaining_qty,
          d.created_at,
          u.username AS created_by_name
         FROM inv_stock_transfer_details d
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN adm_users u ON u.id = d.created_by
         WHERE d.transfer_id = :id
        ORDER BY d.id ASC
        `,
        { id },
      );

      res.json({ item, details });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/transfer-acceptance/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    const conn = await pool.getConnection();
    try {
      const { companyId, branchId = null } = req.scope || {};
      const userId = toNumber(req.scope?.userId ?? req.user?.sub) || null;
      const id = toNumber(req.params.id);
      const details = Array.isArray(req.body?.details) ? req.body.details : [];

      await conn.beginTransaction();

      // Fetch the transfer header scoped to the receiving branch
      const [hdrRows] = await conn.execute(
        `SELECT t.*
         FROM inv_stock_transfers t
         LEFT JOIN inv_warehouses tw ON tw.id = t.to_warehouse_id
         WHERE t.id = :id
           AND t.company_id = :companyId
           AND (
             COALESCE(tw.branch_id, 0) = :branchId
             OR COALESCE(t.to_branch_id, 0) = :branchId
             OR COALESCE(t.branch_id, 0) = :branchId
           )
         LIMIT 1`,
        { id, companyId, branchId },
      );
      const hdr = hdrRows?.[0];
      if (!hdr) throw httpError(404, "NOT_FOUND", "Transfer not found");
      const transferId = Number(hdr.id);

      // Guard against double-confirmation
      const currentStatus = String(hdr.status || "").toUpperCase();
      if (["RECEIVED", "TRANSFERRED", "CANCELLED"].includes(currentStatus)) {
        throw httpError(400, "VALIDATION_ERROR", `Transfer is already ${hdr.status}`);
      }

      // If caller supplied per-line quantities, update them first
      for (const d of details) {
        const lineId = toNumber(d.id);
        if (!lineId) continue;
        const accQty  = Number(d.accepted_qty  ?? d.qty ?? 0);
        const rejQty  = Number(d.rejected_qty  ?? 0);
        const recvQty = Number(d.received_qty  ?? d.accepted_qty ?? d.qty ?? 0);
        await conn.execute(
          `UPDATE inv_stock_transfer_details
             SET accepted_qty       = :accQty,
                 rejected_qty       = :rejQty,
                 received_qty       = :recvQty,
                 acceptance_remarks = :remarks
           WHERE id = :lineId`,
          {
            accQty,
            rejQty,
            recvQty,
            remarks: d.acceptance_remarks || null,
            lineId,
          },
        );
      }

      // Mark the transfer as RECEIVED
      await conn.execute(
        `UPDATE inv_stock_transfers
            SET status        = 'RECEIVED',
                received_date = CURRENT_TIMESTAMP,
                received_by   = :userId
          WHERE id = :transferId`,
        { transferId, userId },
      );

      // Move reserved stock from source warehouse to destination warehouse
      await applyTransferReceiptMovementsTx(conn, {
        companyId,
        branchId,
        transferId,
        createdBy: userId,
      });

      await conn.commit();
      res.json({ ok: true, message: "Transfer confirmed and stock updated" });
    } catch (err) {
      if (conn) await conn.rollback().catch(() => {});
      next(err);
    } finally {
      if (conn) conn.release();
    }
  },
);

router.get(
  "/alerts/low-stock",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const items = await query(
        `
        SELECT 
          i.id,
          i.item_code,
          i.item_name,
          i.uom,
          COALESCE(sb.qty, 0) AS qty,
          COALESCE(i.reorder_level, 0) AS reorder_level,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
          AND COALESCE(i.reorder_level, 0) > 0
          AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
        ORDER BY qty ASC, i.item_name ASC
        LIMIT 200
        `,
        { companyId, branchId },
      );
      res.json({ items: Array.isArray(items) ? items : [] });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/alerts/low-stock/notify-email",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const items = await query(
        `
        SELECT 
          i.id,
          i.item_code,
          i.item_name,
          i.uom,
          COALESCE(sb.qty, 0) AS qty,
          COALESCE(i.reorder_level, 0) AS reorder_level,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN (
          SELECT company_id, branch_id, item_id, SUM(qty) AS qty
          FROM inv_stock_balances
          GROUP BY company_id, branch_id, item_id
        ) sb
          ON sb.company_id = i.company_id
         AND sb.branch_id = :branchId
         AND sb.item_id = i.id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
          AND COALESCE(i.reorder_level, 0) > 0
          AND COALESCE(sb.qty, 0) <= COALESCE(i.reorder_level, 0)
        ORDER BY qty ASC, i.item_name ASC
        LIMIT 200
        `,
        { companyId, branchId },
      );

      if (!items.length) {
        return res.json({ message: "No low stock items found" });
      }

      if (!isMailerConfigured()) {
        throw httpError(400, "BAD_REQUEST", "Mailer is not configured");
      }

      await query(`
        CREATE TABLE IF NOT EXISTS adm_notification_prefs (
          user_id BIGINT UNSIGNED NOT NULL,
          pref_key VARCHAR(100) NOT NULL,
          push_enabled TINYINT(1) NOT NULL DEFAULT 0,
          email_enabled TINYINT(1) NOT NULL DEFAULT 0,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (user_id, pref_key),
          INDEX idx_pref_key (pref_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
      `);

      let recipients = await query(
        `
        SELECT DISTINCT u.id, u.email, COALESCE(u.telephone, '') AS phone,
          np.email_enabled, np.sms_enabled, np.whatsapp_enabled,
          u.created_at,
          cu.username AS created_by_name
         FROM adm_users u
        JOIN adm_notification_prefs np
          ON np.user_id = u.id
         AND np.pref_key = 'low-stock'
        LEFT JOIN adm_users cu ON cu.id = u.created_by
         WHERE u.is_active = 1
          AND u.company_id = :companyId
          AND u.branch_id = :branchId
          AND (np.email_enabled = 1 OR np.sms_enabled = 1 OR np.whatsapp_enabled = 1)
        `,
        { companyId, branchId },
      );

      if (!recipients.length) {
        recipients = await query(
          `
          SELECT id, email, COALESCE(telephone, '') AS phone,
          1 as email_enabled, 0 as sms_enabled, 0 as whatsapp_enabled,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :userId
            AND company_id = :companyId
            AND branch_id = :branchId
            AND is_active = 1
          LIMIT 1
          `,
          { userId: req.user.sub, companyId, branchId },
        );
      }

      if (!recipients.length) {
        throw httpError(400, "BAD_REQUEST", "No recipient email found");
      }

      const count = items.length;
      const subject = `Low Stock Alert (${count} items)`;
      const lines = items
        .slice(0, 50)
        .map(
          (it) =>
            `${it.item_code} ${it.item_name} — qty ${Number(it.qty || 0)}, reorder ${Number(it.reorder_level || 0)}`,
        )
        .join("\n");
      const htmlRows = items
        .slice(0, 50)
        .map(
          (it) =>
            `<tr><td>${it.item_code}</td><td>${it.item_name}</td><td style="text-align:right">${Number(it.qty || 0)}</td><td style="text-align:right">${Number(it.reorder_level || 0)}</td></tr>`,
        )
        .join("");
      const text = `${count} items are at or below reorder levels.\n\n${lines}\n\nOpen: /inventory/alerts/low-stock`;
      const html = `<p>${count} items are at or below reorder levels.</p><table border="1" cellpadding="6" cellspacing="0"><thead><tr><th>Code</th><th>Name</th><th>Qty</th><th>Reorder</th></tr></thead><tbody>${htmlRows}</tbody></table><p><a href="/inventory/alerts/low-stock">Open Alerts</a></p>`;

      for (const recipient of recipients) {
        if (recipient.email_enabled && recipient.email) {
          await sendExternalNotification({ type: 'email', recipientEmail: recipient.email, subject, text, html }).catch(()=>null);
        }
        if (recipient.sms_enabled && recipient.phone) {
          await sendExternalNotification({ type: 'sms', recipientPhone: recipient.phone, text }).catch(()=>null);
        }
        if (recipient.whatsapp_enabled && recipient.phone) {
          await sendExternalNotification({ type: 'whatsapp', recipientPhone: recipient.phone, text }).catch(()=>null);
        }
      }

      res.json({
        message: `Notification dispatched to ${recipients.length} recipient${recipients.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      next(err);
    }
  },
);

// Stock Verification Report
router.get(
  "/reports/stock-verification",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null } = req.scope || {};
      const { from, to } = req.query;
      let where = "WHERE v.company_id = :companyId AND v.branch_id = :branchId";
      const params = { companyId, branchId };

      if (from) {
        where += " AND v.verification_date >= :from";
        params.from = from;
      }
      if (to) {
        where += " AND v.verification_date <= :to";
        params.to = to;
      }

      const rows = await query(
        `
        SELECT 
          v.id,
          v.verification_no AS verify_no,
          v.verification_date AS verify_date,
          v.status,
          w.warehouse_name,
          i.item_code,
          i.item_name,
          d.system_qty,
          d.counted_qty,
          d.variance_qty,
          v.created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications v
        JOIN inv_stock_verification_details d ON d.verification_id = v.id
        JOIN inv_items i ON i.id = d.item_id
        LEFT JOIN inv_warehouses w ON w.id = v.warehouse_id
        LEFT JOIN adm_users u ON u.id = v.created_by
        ${where}
         ORDER BY v.verification_date DESC, v.verification_no DESC
        `,
        params,
      );

      res.json({ items: rows || [] });
    } catch (e) {
      next(e);
    }
  },
);

// ===== DASHBOARD STATS =====
router.get(
  "/dashboard-stats",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const [items] = await query(
        "SELECT COUNT(*) as count FROM inv_items WHERE company_id = :companyId AND is_active = 1",
        { companyId },
      ).catch(() => [{ count: 0 }]);
      const [stock] = await query(
        "SELECT COUNT(DISTINCT item_id) as items_count, COALESCE(SUM(qty), 0) as total_qty FROM inv_stock_balances WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))",
        { companyId, branchIdsStr },
      ).catch(() => [{ items_count: 0, total_qty: 0 }]);
      const [locations] = await query(
        "SELECT COUNT(DISTINCT branch_id) as locations_count FROM inv_stock_balances WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))",
        { companyId, branchIdsStr },
      ).catch(() => [{ locations_count: 0 }]);
      const [reqs] = await query(
        "SELECT COUNT(*) as count FROM inv_material_requisitions WHERE company_id = :companyId AND branch_id = :branchId AND status IN ('PENDING','SUBMITTED','PENDING_APPROVAL')",
        { companyId, branchId },
      ).catch(() => [{ count: 0 }]);
      const [transfers] = await query(
        "SELECT COUNT(*) as count FROM inv_stock_transfers WHERE company_id = :companyId AND branch_id = :branchId AND status NOT IN ('RECEIVED','COMPLETED','CANCELLED')",
        { companyId, branchId },
      ).catch(() => [{ count: 0 }]);
      const [lowStock] = await query(
        `SELECT COUNT(*) as count FROM inv_items i
       WHERE i.company_id = :companyId AND i.is_active = 1 AND i.reorder_level > 0
       AND i.reorder_level > (SELECT COALESCE(SUM(sb.qty), 0) FROM inv_stock_balances sb WHERE sb.item_id = i.id AND (:branchIdsStr = '' OR FIND_IN_SET(sb.branch_id, :branchIdsStr)))`,
        { companyId, branchIdsStr },
      ).catch(() => [{ count: 0 }]);
      const [adjustments] = await query(
        "SELECT COUNT(*) as count FROM inv_stock_adjustments WHERE company_id = :companyId AND branch_id = :branchId AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)",
        { companyId, branchId },
      ).catch(() => [{ count: 0 }]);
      res.json({
        success: true,
        data: {
          // canonical names expected by InventoryHome.jsx
          totalItems: items.count,
          activeItems: stock.items_count,
          totalStockQty: stock.total_qty,
          locationsCount: locations.locations_count,
          pendingRequisitions: reqs.count,
          pendingTransfers: transfers.count,
          lowStockItems: lowStock.count,
          recentAdjustments: adjustments.count,
          // legacy aliases kept for any other consumers
          itemsCount: items.count,
          stockItemsCount: stock.items_count,
          stockTotalQty: stock.total_qty,
        },
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
