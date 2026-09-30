/**
 * @file costing.service.js
 * @description Provides business logic for recalculating and updating item costs (e.g. average cost).
 */
import { pool } from "../db/pool.js";

// Utility Function: Check if value represents a 'Yes' / truthy value
function isYes(v) {
  if (v == null) return false;
  const s = String(v).trim().toUpperCase();
  return s === "Y" || s === "1" || s === "YES" || s === "TRUE";
}

/**
 * Updates the average cost of an item based on a new purchase and current stock.
 * Executes within a provided database transaction.
 *
 * @param {import('mysql2/promise').Connection} conn - Database connection/transaction.
 * @param {Object} params - Parameters for the cost update.
 * @param {number} params.companyId - The company ID.
 * @param {number} params.branchId - The branch ID.
 * @param {number} params.warehouseId - The warehouse ID.
 * @param {number} params.itemId - The ID of the item.
 * @param {number} params.purchaseQty - Quantity purchased.
 * @param {number} params.purchaseUnitCost - Unit cost of the new purchase.
 * @returns {Promise<{updated: boolean, newCost?: number}>} The result of the update.
 */
export async function updateItemAverageCostTx(conn, params) {
  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    purchaseQty,
    purchaseUnitCost,
  } = params || {};

  // Parse and validate purchase quantities
  const qty = Number(purchaseQty || 0);
  if (!(Number.isFinite(qty) && qty > 0)) return { updated: false };
  const unitCost = Number(purchaseUnitCost || 0);

  // Fetch item details (cost, stockable status) with an exclusive row lock for update
  const [itemRows] = await conn.execute(
    `
    SELECT id, cost_price, is_stockable, service_item
    FROM inv_items
    WHERE company_id = :companyId AND id = :itemId
    LIMIT 1
    FOR UPDATE
    `,
    { companyId, itemId },
  );
  if (!itemRows.length) return { updated: false };
  const item = itemRows[0];

  // Validate if item is eligible for stock tracking
  if (!isYes(item.is_stockable) || isYes(item.service_item)) {
    return { updated: false };
  }

  // Fetch stock balances across the current warehouse/branch for this item
  const [sbRows] = await conn.execute(
    `
    SELECT warehouse_id, qty
    FROM inv_stock_balances
    WHERE company_id = :companyId AND branch_id = :branchId AND item_id = :itemId
    FOR UPDATE
    `,
    { companyId, branchId, itemId },
  );

  // Calculate current total stock quantity by summing up warehouse balances
  let currentQty = 0;
  for (const r of sbRows || []) {
    currentQty += Number(r.qty || 0);
  }
  const currentCost = Number(item.cost_price || 0);

  // Compute the new weighted average cost
  let newCost = currentCost;
  if (currentQty <= 0) {
    newCost = unitCost;
  } else {
    newCost = (currentQty * currentCost + qty * unitCost) / (currentQty + qty);
  }
  const roundedCost = Number(newCost.toFixed(2));

  // Update the item's cost price in the database
  await conn.execute(
    `
    UPDATE inv_items
    SET cost_price = :roundedCost
    WHERE company_id = :companyId AND id = :itemId
    `,
    { roundedCost, companyId, itemId },
  );

  // Upsert the new stock balance, adding the new purchase quantity
  await conn.execute(
    `
    INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
    VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
    ON DUPLICATE KEY UPDATE qty = qty + :qty
    `,
    { companyId, branchId, warehouseId, itemId, qty },
  );
  return { updated: true, newCost: roundedCost };
}

/**
 * Updates the average cost of an item, automatically managing its own database transaction.
 *
 * @param {Object} params - Parameters for the cost update.
 * @returns {Promise<{updated: boolean, newCost?: number}>} The result of the update.
 */
export async function updateItemAverageCost(params) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const res = await updateItemAverageCostTx(conn, params);
    await conn.commit();
    return res;
  } catch (e) {
    try {
      await conn.rollback();
    } catch {}
    throw e;
  } finally {
    conn.release();
  }
}
