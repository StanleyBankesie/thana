/**
 * @file stock-verification.service.js
 * @description Provides business logic for applying approved stock verifications 
 * and updating stock balances and ledgers accordingly.
 */
import { query } from "../db/pool.js";

// Utility Function: Insert a single stock ledger record reflecting a quantity change
async function insertLedgerRow(conn, params) {
  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    qtyChange,
    verificationId,
    createdBy = null,
  } = params;

  // Skip inserting ledger entry if the quantity change is zero or invalid
  if (!Number.isFinite(Number(qtyChange)) || Number(qtyChange) === 0) return;

  await conn.execute(
    `
    INSERT INTO inv_stock_ledger
      (company_id, branch_id, warehouse_id, item_id, transaction_type, qty_change, source_ref, created_by)
    VALUES
      (:companyId, :branchId, :warehouseId, :itemId, 'STOCK_VERIFICATION', :qtyChange, :sourceRef, :createdBy)
    `,
    {
      companyId,
      branchId,
      warehouseId,
      itemId,
      qtyChange: Number(qtyChange),
      sourceRef: String(verificationId),
      createdBy,
    },
  );
}

/**
 * Applies a stock verification approval.
 * Updates stock balances to the verified quantities and records the differences 
 * as movements in the inventory ledger.
 * Executes within a provided database transaction.
 *
 * @param {import('mysql2/promise').Connection} conn - Database connection/transaction.
 * @param {Object} params - Parameters containing the verification ID and metadata.
 * @param {number} params.companyId - The company ID.
 * @param {number} params.branchId - The branch ID.
 * @param {number} params.verificationId - The ID of the approved stock verification.
 * @param {number} params.warehouseId - The warehouse ID.
 * @param {number} [params.createdBy] - The user ID applying the approval.
 * @returns {Promise<void>}
 */
export async function applyStockVerificationApprovalTx(
  conn,
  { companyId, branchId, verificationId, warehouseId, createdBy = null },
) {
  // Fetch all verified items and their counted/verified quantities for the given verification
  const [details] = await conn.execute(
    `
    SELECT
      item_id,
      COALESCE(counted_qty, verified_qty, 0) AS verified_qty
    FROM inv_stock_verification_details
    WHERE verification_id = :verificationId
    ORDER BY id ASC
    `,
    { verificationId },
  );

  // Loop over each item detail to update stock balances and ledger
  for (const detail of details || []) {
    const itemId = Number(detail.item_id || 0);
    const verifiedQty = Number(detail.verified_qty || 0);
    if (!itemId) continue;

    // Retrieve existing stock balance rows to determine current quantity on hand
    const [rows] = await conn.execute(
      `
      SELECT id, qty
      FROM inv_stock_balances
      WHERE company_id = :companyId
        AND warehouse_id = :warehouseId
        AND item_id = :itemId
      ORDER BY id ASC
      `,
      { companyId, warehouseId, itemId },
    );

    const existingRows = Array.isArray(rows) ? rows : [];
    const existingTotalQty = existingRows.reduce(
      (sum, row) => sum + Number(row.qty || 0),
      0,
    );

    // If an existing stock balance is found, overwrite the first available record's qty with the verified qty
    if (existingRows.length > 0) {
      const firstRowId = Number(existingRows[0].id);
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = :verifiedQty WHERE id = :id`,
        { verifiedQty, id: firstRowId },
      );
    } else {
      // If no existing stock balance, insert a new record with the verified qty
      await conn.execute(
        `
        INSERT INTO inv_stock_balances
          (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, source_type, source_id, entry_date)
        VALUES
          (:companyId, :branchId, :warehouseId, :itemId, :verifiedQty, 0, 'STOCK_VERIFICATION', :sourceId, NOW())
        `,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          verifiedQty,
          sourceId: verificationId,
        },
      );
    }

    // Record the net difference (verified minus current) in the inventory ledger
    await insertLedgerRow(conn, {
      companyId,
      branchId,
      warehouseId,
      itemId,
      qtyChange: verifiedQty - existingTotalQty,
      verificationId,
      createdBy,
    });
  }
}

/**
 * Ensures that the 'verified_qty' column exists on the inv_stock_verification_details table.
 * Used for schema migrations.
 *
 * @returns {Promise<void>}
 */
export async function ensureStockVerificationDetailColumns() {
  const columns = await query(
    `
    SELECT COLUMN_NAME
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = 'inv_stock_verification_details'
    `,
  ).catch(() => []);

  // Extract column names into a Set for quick lookups
  const existing = new Set((columns || []).map((column) => column.COLUMN_NAME));

  if (!existing.has("verified_qty")) {
    await query(
      `ALTER TABLE inv_stock_verification_details ADD COLUMN verified_qty DECIMAL(18,3) NULL AFTER counted_qty`,
    ).catch(() => {});
  }
}
