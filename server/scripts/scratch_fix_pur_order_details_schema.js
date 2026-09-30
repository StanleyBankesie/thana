/**
 * @fileoverview Script to fix the schema of the pur_order_details table by ensuring required columns exist.
 * @module scratch_fix_pur_order_details_schema
 */

import { query, pool } from "./db/pool.js";

/**
 * Checks if a specific column exists in a given table.
 *
 * @param {string} tableName - The name of the table to check.
 * @param {string} columnName - The name of the column to look for.
 * @returns {Promise<boolean>} Resolves to true if the column exists, otherwise false.
 */
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

/**
 * Ensures that various extended columns exist in the pur_order_details table.
 * Includes tax, UOM, and other details. Adds any missing columns.
 *
 * @returns {Promise<void>} Resolves when all checks and necessary additions are complete.
 */
async function ensurePurchaseOrderDetailExtendedColumns() {
  const cols = [
    { name: "tax_code_id", def: "BIGINT UNSIGNED NULL" },
    { name: "tax_percent", def: "DECIMAL(5,2) NOT NULL DEFAULT 0" },
    { name: "tax_amount", def: "DECIMAL(18,2) NOT NULL DEFAULT 0" },
    { name: "uom", def: "VARCHAR(20) NULL" },
  ];
  for (const col of cols) {
    if (!(await hasColumn("pur_order_details", col.name))) {
      console.log(`Adding ${col.name} column to pur_order_details...`);
      await pool
        .query(`ALTER TABLE pur_order_details ADD COLUMN ${col.name} ${col.def}`)
        .catch((e) => console.error(`Error adding ${col.name}:`, e.message));
    }
  }
}

/**
 * Main entry point for the schema migration script.
 * Runs the column addition functions and outputs the resulting table schema.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the entire process completes.
 */
async function run() {
  try {
    await ensurePurchaseOrderDetailExtendedColumns();
    console.log("pur_order_details schema update complete.");
    
    const rows = await query("SHOW COLUMNS FROM pur_order_details");
    console.table(rows.map(r => ({ Field: r.Field, Type: r.Type })));
  } catch (e) {
    console.error("Run error:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
