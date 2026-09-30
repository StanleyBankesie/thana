/**
 * @fileoverview Script to fix the schema of the pur_orders table by ensuring required columns exist.
 * @module scratch_fix_pur_orders_schema
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
 * Ensures that currency-related columns exist in the pur_orders table.
 * Adds 'currency' and 'exchange_rate' columns if they are missing.
 *
 * @returns {Promise<void>} Resolves when the check and possible alterations are complete.
 */
async function ensurePurchaseOrderCurrencyColumns() {
  if (!(await hasColumn("pur_orders", "currency"))) {
    console.log("Adding currency column...");
    await pool
      .query(
        "ALTER TABLE pur_orders ADD COLUMN currency VARCHAR(20) NULL",
      )
      .catch((e) => console.error("Error adding currency:", e.message));
  }
  if (!(await hasColumn("pur_orders", "exchange_rate"))) {
    console.log("Adding exchange_rate column...");
    await pool
      .query(
        "ALTER TABLE pur_orders ADD COLUMN exchange_rate DECIMAL(18,6) NOT NULL DEFAULT 1",
      )
      .catch((e) => console.error("Error adding exchange_rate:", e.message));
  }
}

/**
 * Ensures that various extended business columns exist in the pur_orders table.
 * Checks for columns like 'warehouse_id', 'payment_terms', 'delivery_date', etc.,
 * and adds any missing columns based on predefined configurations.
 *
 * @returns {Promise<void>} Resolves when all checks and necessary additions are complete.
 */
async function ensurePurchaseOrderExtendedColumns() {
  const cols = [
    { name: "warehouse_id", def: "BIGINT UNSIGNED NULL" },
    { name: "payment_terms", def: "INT NULL" },
    { name: "delivery_date", def: "DATE NULL" },
    { name: "terms_conditions", def: "TEXT NULL" },
    { name: "tax_amount", def: "DECIMAL(18,2) NOT NULL DEFAULT 0" },
    { name: "discount_amount", def: "DECIMAL(18,2) NOT NULL DEFAULT 0" },
    { name: "freight_amount", def: "DECIMAL(18,2) NOT NULL DEFAULT 0" },
    { name: "other_charges", def: "DECIMAL(18,2) NOT NULL DEFAULT 0" },
    { name: "port_loading", def: "VARCHAR(150) NULL" },
    { name: "port_discharge", def: "VARCHAR(150) NULL" },
    { name: "incoterms", def: "VARCHAR(100) NULL" },
    { name: "hs_code", def: "VARCHAR(50) NULL" },
    { name: "shipping_date", def: "DATE NULL" },
    { name: "insurance_required", def: "TINYINT(1) NOT NULL DEFAULT 0" },
  ];
  for (const col of cols) {
    if (!(await hasColumn("pur_orders", col.name))) {
      console.log(`Adding ${col.name} column...`);
      await pool
        .query(`ALTER TABLE pur_orders ADD COLUMN ${col.name} ${col.def}`)
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
    await ensurePurchaseOrderCurrencyColumns();
    await ensurePurchaseOrderExtendedColumns();
    console.log("Schema update complete.");
    
    const rows = await query("SHOW COLUMNS FROM pur_orders");
    console.table(rows.map(r => ({ Field: r.Field, Type: r.Type })));
  } catch (e) {
    console.error("Run error:", e.message);
  } finally {
    process.exit(0);
  }
}

run();
