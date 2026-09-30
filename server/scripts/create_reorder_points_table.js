/**
 * @fileoverview Database migration script to create the inventory reorder points table.
 * @module scripts/create_reorder_points_table
 */

import { pool } from "../db/pool.js";

/**
 * Creates the 'inv_reorder_points' table if it does not already exist.
 * This table is used to track min, max, and reorder levels for items in warehouses.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the table creation is complete.
 */
async function createReorderPointsTable() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting schema update for Reorder Points...");

    await conn.query(`
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
        CONSTRAINT fk_rp_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id),
        CONSTRAINT fk_rp_item FOREIGN KEY (item_id) REFERENCES inv_items(id),
        CONSTRAINT fk_rp_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    
    console.log("Ensured inv_reorder_points table exists");
    console.log("Schema update completed successfully.");
  } catch (err) {
    console.error("Schema update failed:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

createReorderPointsTable();
