import { pool, query } from "../db/pool.js";

let _tablesReady = false;

/**
 * Ensures inv_stock_balances has all required columns for batch/serial tracking,
 * creates inv_stock_ledger, and creates/replaces v_active_stock_details view.
 *
 * Uses the global `query()` helper (non-transactional) for DDL to avoid
 * implicit-commit issues that break in-progress transactions.
 */
export async function ensureStockBalancesWarehouseInfrastructure(connOrPool) {
  // Early exit if the infrastructure check already passed this lifecycle
  if (_tablesReady) return;
  const q = connOrPool
    ? (sql, params) => connOrPool.execute(sql, params).then((r) => r[0])
    : query;

  try {
    // ── 1. Discover existing columns ──────────────────────────────────────
    const cols = await q(
      `SELECT COLUMN_NAME
       FROM information_schema.columns
       WHERE table_schema = DATABASE()
         AND table_name = 'inv_stock_balances'`,
    );
    const existing = new Set((cols || []).map((c) => c.COLUMN_NAME));

    // ── 2. Add id PK if missing (needed for row-level FIFO operations) ───
    if (!existing.has("id")) {
      try {
        await query(
          "ALTER TABLE inv_stock_balances ADD COLUMN id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY FIRST",
        );
      } catch {
        try {
          await query("ALTER TABLE inv_stock_balances DROP PRIMARY KEY");
          await query(
            "ALTER TABLE inv_stock_balances ADD COLUMN id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY FIRST",
          );
        } catch {
          /* table may already have a usable PK */
        }
      }
    }

    // ── 3. Add missing columns ────────────────────────────────────────────
    const needed = [
      ["warehouse_id", "BIGINT UNSIGNED NULL"],
      ["reserved_qty", "DECIMAL(18,3) NOT NULL DEFAULT 0"],
      ["batch_no", "VARCHAR(100) NULL"],
      ["serial_no", "VARCHAR(100) NULL"],
      ["expiry_date", "DATE NULL"],
      ["entry_date", "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP"],
      ["source_type", "VARCHAR(50) NULL"],
      ["source_id", "BIGINT UNSIGNED NULL"],
    ];
    for (const [name, def] of needed) {
      if (!existing.has(name)) {
        await query(
          `ALTER TABLE inv_stock_balances ADD COLUMN ${name} ${def}`,
        ).catch(() => {});
      }
    }

    // ── 4. Fix NULL reserved_qty values ───────────────────────────────────
    await query(
      "UPDATE inv_stock_balances SET reserved_qty = 0 WHERE reserved_qty IS NULL",
    ).catch(() => {});

    // ── 5. Drop old unique keys that prevent multiple rows/batches ────────
    // We try multiple names and syntaxes to ensure they are gone.
    const keysToDrop = [
      "uq_stock_scope_wh_item",
      "uq_stock_scope_item",
      "uq_stock_item_br",
    ];
    for (const keyName of keysToDrop) {
      await query(`ALTER TABLE inv_stock_balances DROP KEY ${keyName}`).catch(
        () => {},
      );
      await query(`ALTER TABLE inv_stock_balances DROP INDEX ${keyName}`).catch(
        () => {},
      );
    }

    // ── 6. Add non-unique index for query performance ─────────────────────
    await query(
      "ALTER TABLE inv_stock_balances ADD KEY idx_stock_wh_item (company_id, branch_id, warehouse_id, item_id)",
    ).catch(() => {});

    // ── 7. Create inv_stock_ledger ────────────────────────────────────────
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

    // ── 8. Create / replace view (reads from inv_stock_balances directly) ─
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
        i.item_code,
        i.item_name,
        i.uom,
        w.warehouse_name
      FROM inv_stock_balances sb
      JOIN inv_items i ON i.id = sb.item_id
      LEFT JOIN inv_warehouses w ON w.id = sb.warehouse_id
      WHERE (sb.qty > 0 OR sb.reserved_qty > 0)
    `);

    _tablesReady = true;
  } catch (err) {
    console.error("Stock infrastructure check failed:", err);
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   INFLOW  –  recordMovementTx
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Record a stock movement.
 * Positive qtyChange → INFLOW  (inserts a new row in inv_stock_balances).
 * Negative qtyChange → OUTFLOW (delegates to FIFO consumer).
 */
/**
 * Records an inventory movement in the stock ledger and updates stock balances.
 * Executes within a provided database transaction.
 * @param {import('mysql2/promise').Connection} conn - Database transaction connection.
 * @param {Object} params - Movement parameters.
 * @returns {Promise<void>}
 */
// Endpoint / Major Logic: General-purpose stock movement router
export async function recordMovementTx(conn, params) {
  await ensureStockBalancesWarehouseInfrastructure();

  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    transactionType,
    qtyChange,
    batchNo = null,
    serialNo = null,
    expiryDate = null,
    sourceRef = null,
    createdBy = null,
    sourceType = null,
    sourceId = null,
  } = params;

  if (qtyChange === 0) return;

  if (qtyChange > 0) {
    // ── INFLOW: update existing or insert new ────────────────────────────
    let [existingRows] = await conn.execute(
      `SELECT id FROM inv_stock_balances 
       WHERE company_id = :companyId 
         AND warehouse_id = :warehouseId 
         AND item_id = :itemId 
         AND COALESCE(batch_no, '') = COALESCE(:batchNo, '')
       LIMIT 1`,
      { companyId, warehouseId, itemId, batchNo },
    );

    if (existingRows.length === 0) {
      [existingRows] = await conn.execute(
        `SELECT id FROM inv_stock_balances 
         WHERE company_id = :companyId 
           AND warehouse_id = :warehouseId 
           AND item_id = :itemId
         LIMIT 1`,
        { companyId, warehouseId, itemId },
      );
    }

    if (existingRows.length === 0) {
      [existingRows] = await conn.execute(
        `SELECT id FROM inv_stock_balances 
         WHERE company_id = :companyId 
           AND branch_id = :branchId 
           AND item_id = :itemId 
         LIMIT 1`,
        { companyId, branchId, itemId },
      );
    }

    if (existingRows.length > 0) {
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = qty + :qtyChange WHERE id = :id`,
        { qtyChange, id: existingRows[0].id },
      );
    } else {
      try {
        await conn.execute(
          `INSERT INTO inv_stock_balances
            (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty,
             batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
           VALUES
            (:companyId, :branchId, :warehouseId, :itemId, :qty, 0,
             :batchNo, :serialNo, :expiryDate, NOW(), :sourceType, :sourceId)`,
          {
            companyId,
            branchId,
            warehouseId,
            itemId,
            qty: qtyChange,
            batchNo,
            serialNo,
            expiryDate,
            sourceType: sourceType || transactionType || null,
            sourceId,
          },
        );
      } catch (err) {
        if (String(err?.code) !== "ER_DUP_ENTRY") throw err;
        await conn.execute(
          `UPDATE inv_stock_balances 
           SET qty = qty + :qtyChange
           WHERE company_id = :companyId
             AND (
               (warehouse_id = :warehouseId AND item_id = :itemId)
               OR (branch_id = :branchId AND item_id = :itemId)
             )
           LIMIT 1`,
          { qtyChange, companyId, branchId, warehouseId, itemId },
        );
      }
    }

    // Ledger
    await conn.execute(
      `INSERT INTO inv_stock_ledger
        (company_id, branch_id, warehouse_id, item_id, transaction_type,
         qty_change, batch_no, serial_no, expiry_date, source_ref, created_by)
       VALUES
        (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
         :qtyChange, :batchNo, :serialNo, :expiryDate, :sourceRef, :createdBy)`,
      {
        companyId,
        branchId,
        warehouseId,
        itemId,
        transactionType,
        qtyChange,
        batchNo,
        serialNo,
        expiryDate,
        sourceRef,
        createdBy,
      },
    );
  } else {
    // ── OUTFLOW: consume via FIFO ─────────────────────────────────────────
    await consumeStockFIFOTx(conn, {
      ...params,
      qtyToConsume: Math.abs(qtyChange),
    });
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   OUTFLOW (FIFO)  –  consumeStockFIFOTx
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Consumes stock using FIFO (First-In, First-Out) logic, deducting from batches.
 * Executes within a provided database transaction.
 * @param {import('mysql2/promise').Connection} conn - Database transaction connection.
 * @param {Object} params - Consumption parameters.
 * @returns {Promise<void>}
 */
// Internal Logic: Outflow processor applying FIFO rules
export async function consumeStockFIFOTx(conn, params) {
  await ensureStockBalancesWarehouseInfrastructure();

  const {
    companyId,
    branchId = null,
    warehouseId,
    itemId,
    transactionType,
    qtyToConsume,
    sourceRef = null,
    createdBy = null,
  } = params;

  let remaining = Math.abs(qtyToConsume);
  if (remaining <= 0) return;

  // Fetch available batches in FIFO order (oldest entry_date first)
  const [batches] = await conn.execute(
    `SELECT id, qty, batch_no, serial_no, expiry_date
     FROM inv_stock_balances
     WHERE company_id = :companyId
       AND warehouse_id = :warehouseId
       AND item_id = :itemId
       AND qty > 0
     ORDER BY entry_date ASC`,
    { companyId, warehouseId, itemId },
  );

  // Iterate through available batches sequentially (oldest first)
  for (const batch of batches) {
    if (remaining <= 0) break;
    const consume = Math.min(remaining, Number(batch.qty));

    // Delete the row when qty is fully consumed
    if (Number(batch.qty) <= consume) {
      await conn.execute(`DELETE FROM inv_stock_balances WHERE id = :id`, {
        id: batch.id,
      });
    } else {
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = qty - :consume WHERE id = :id`,
        { consume, id: batch.id },
      );
    }

    // Ledger entry for this batch slice
    await conn.execute(
      `INSERT INTO inv_stock_ledger
        (company_id, branch_id, warehouse_id, item_id, transaction_type,
         qty_change, batch_no, serial_no, expiry_date, source_ref, created_by)
       VALUES
        (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
         :qtyChange, :batchNo, :serialNo, :expiryDate, :sourceRef, :createdBy)`,
      {
        companyId,
        branchId,
        warehouseId,
        itemId,
        transactionType,
        qtyChange: -consume,
        batchNo: batch.batch_no,
        serialNo: batch.serial_no,
        expiryDate: batch.expiry_date,
        sourceRef,
        createdBy,
      },
    );

    remaining -= consume;
  }

  // If still remaining after consuming all available batches, record negative balance
  if (remaining > 0) {
    const [existingNeg] = await conn.execute(
      `SELECT id FROM inv_stock_balances
       WHERE company_id = :companyId
         AND warehouse_id = :warehouseId
         AND item_id = :itemId
       LIMIT 1`,
      { companyId, warehouseId, itemId },
    );
    if (existingNeg.length > 0) {
      await conn.execute(
        `UPDATE inv_stock_balances SET qty = qty - :remaining WHERE id = :id`,
        { remaining, id: existingNeg[0].id },
      );
    } else {
      await conn.execute(
        `INSERT INTO inv_stock_balances
          (company_id, branch_id, warehouse_id, item_id, qty, entry_date)
         VALUES
          (:companyId, :branchId, :warehouseId, :itemId, :remaining, NOW())`,
        {
          companyId,
          branchId,
          warehouseId,
          itemId,
          remaining: -remaining,
        },
      );
    }
    await conn.execute(
      `INSERT INTO inv_stock_ledger
        (company_id, branch_id, warehouse_id, item_id, transaction_type,
         qty_change, source_ref, created_by)
       VALUES
        (:companyId, :branchId, :warehouseId, :itemId, :transactionType,
         :qtyChange, :sourceRef, :createdBy)`,
      {
        companyId,
        branchId,
        warehouseId,
        itemId,
        transactionType,
        qtyChange: -remaining,
        sourceRef,
        createdBy,
      },
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   RESERVE  –  reserveStockTx  (Stock Transfer creation)
   ═══════════════════════════════════════════════════════════════════════════ */

// Endpoint / Major Logic: Shifts available stock into reserved state for transfers
export async function reserveStockTx(conn, params) {
  await ensureStockBalancesWarehouseInfrastructure();

  const {
    companyId,
    branchId,
    warehouseId,
    itemId,
    qtyToReserve,
    sourceRef,
    createdBy,
  } = params;

  let remaining = Math.abs(qtyToReserve);
  if (remaining <= 0) return;

  const [batches] = await conn.execute(
    `SELECT id, qty, batch_no, serial_no, expiry_date
     FROM inv_stock_balances
     WHERE company_id = :companyId
       AND warehouse_id = :warehouseId
       AND item_id = :itemId
       AND qty > 0
     ORDER BY entry_date ASC`,
    { companyId, warehouseId, itemId },
  );

  let totalMoved = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const move = Math.min(remaining, Number(batch.qty));

    // Shift qty → reserved_qty
    await conn.execute(
      `UPDATE inv_stock_balances
       SET qty = qty - :move,
           reserved_qty = COALESCE(reserved_qty, 0) + :move
       WHERE id = :id`,
      { move, id: batch.id },
    );

    totalMoved += move;
    remaining -= move;
  }

  // Ledger
  if (totalMoved > 0) {
    await conn.execute(
      `INSERT INTO inv_stock_ledger
        (company_id, branch_id, warehouse_id, item_id, transaction_type,
         qty_change, source_ref, created_by)
       VALUES
        (:companyId, :branchId, :warehouseId, :itemId, 'STOCK_RESERVE',
         :qty, :sourceRef, :createdBy)`,
      {
        companyId,
        branchId,
        warehouseId,
        itemId,
        qty: -totalMoved,
        sourceRef,
        createdBy,
      },
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSFER ACCEPTANCE  –  moveReservedStockTx
   ═══════════════════════════════════════════════════════════════════════════ */

// Endpoint / Major Logic: Completes a transfer by moving reserved stock to the destination warehouse
export async function moveReservedStockTx(conn, params) {
  await ensureStockBalancesWarehouseInfrastructure();

  const {
    companyId,
    branchId,
    fromWarehouseId,
    toWarehouseId,
    itemId,
    qtyToMove,
    sourceRef,
    createdBy,
  } = params;

  let remaining = Math.abs(qtyToMove);
  if (remaining <= 0) return;

  const [batches] = await conn.execute(
    `SELECT id, reserved_qty, qty, batch_no, serial_no, expiry_date
     FROM inv_stock_balances
     WHERE company_id = :companyId
       AND warehouse_id = :fromWarehouseId
       AND item_id = :itemId
       AND reserved_qty > 0
     ORDER BY entry_date ASC`,
    { companyId, fromWarehouseId, itemId },
  );

  let totalMoved = 0;
  for (const batch of batches) {
    if (remaining <= 0) break;
    const move = Math.min(remaining, Number(batch.reserved_qty));

    // Deduct from source reserved (delete row if fully empty)
    if (Number(batch.reserved_qty) <= move && Number(batch.qty || 0) <= 0) {
      await conn.execute(`DELETE FROM inv_stock_balances WHERE id = :id`, {
        id: batch.id,
      });
    } else {
      await conn.execute(
        `UPDATE inv_stock_balances
         SET reserved_qty = reserved_qty - :move
         WHERE id = :id`,
        { move, id: batch.id },
      );
    }

    let [destRows] = await conn.execute(
      `SELECT id
       FROM inv_stock_balances
       WHERE company_id = :companyId
         AND warehouse_id = :toWarehouseId
         AND item_id = :itemId
         AND COALESCE(batch_no, '') = COALESCE(:batchNo, '')
       LIMIT 1`,
      {
        companyId,
        toWarehouseId,
        itemId,
        batchNo: batch.batch_no,
      },
    );

    if (destRows.length === 0) {
      [destRows] = await conn.execute(
        `SELECT id
         FROM inv_stock_balances
         WHERE company_id = :companyId
           AND warehouse_id = :toWarehouseId
           AND item_id = :itemId
         LIMIT 1`,
        { companyId, toWarehouseId, itemId },
      );
    }

    if (destRows.length === 0) {
      [destRows] = await conn.execute(
        `SELECT id
         FROM inv_stock_balances
         WHERE company_id = :companyId
           AND branch_id = :branchId
           AND item_id = :itemId
         LIMIT 1`,
        { companyId, branchId, itemId },
      );
    }

    if (destRows.length > 0) {
      await conn.execute(
        `UPDATE inv_stock_balances
         SET qty = qty + :move
         WHERE id = :id`,
        { move, id: destRows[0].id },
      );
    } else {
      try {
        await conn.execute(
          `INSERT INTO inv_stock_balances
            (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty,
             batch_no, serial_no, expiry_date, entry_date, source_type, source_id)
           VALUES
            (:companyId, :branchId, :toWarehouseId, :itemId, :move, 0,
             :batchNo, :serialNo, :expiryDate, NOW(), 'TRANSFER', NULL)`,
          {
            companyId,
            branchId,
            toWarehouseId,
            itemId,
            move,
            batchNo: batch.batch_no,
            serialNo: batch.serial_no,
            expiryDate: batch.expiry_date,
          },
        );
      } catch (err) {
        if (String(err?.code) !== "ER_DUP_ENTRY") throw err;
        await conn.execute(
          `UPDATE inv_stock_balances
           SET qty = qty + :move
           WHERE company_id = :companyId
             AND (
               (warehouse_id = :toWarehouseId AND item_id = :itemId)
               OR (branch_id = :branchId AND item_id = :itemId)
             )
           LIMIT 1`,
          { move, companyId, toWarehouseId, branchId, itemId },
        );
      }
    }

    totalMoved += move;
    remaining -= move;
  }

  if (totalMoved <= 0) return;

  // Ledger — OUT
  await conn.execute(
    `INSERT INTO inv_stock_ledger
      (company_id, branch_id, warehouse_id, item_id, transaction_type,
       qty_change, source_ref, created_by)
     VALUES
      (:companyId, :branchId, :fromWarehouseId, :itemId, 'STOCK_TRANSFER_OUT',
       :qtyOut, :sourceRef, :createdBy)`,
    {
      companyId,
      branchId,
      fromWarehouseId,
      itemId,
      qtyOut: -totalMoved,
      sourceRef,
      createdBy,
    },
  );

  // Ledger — IN
  await conn.execute(
    `INSERT INTO inv_stock_ledger
      (company_id, branch_id, warehouse_id, item_id, transaction_type,
       qty_change, source_ref, created_by)
     VALUES
      (:companyId, :branchId, :toWarehouseId, :itemId, 'STOCK_TRANSFER_IN',
       :qtyIn, :sourceRef, :createdBy)`,
    {
      companyId,
      branchId,
      toWarehouseId,
      itemId,
      qtyIn: totalMoved,
      sourceRef,
      createdBy,
    },
  );
}
