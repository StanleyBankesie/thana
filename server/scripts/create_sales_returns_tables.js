/**
 * @fileoverview Database migration script to create tables for sales returns.
 * @module scripts/create_sales_returns_tables
 */

import { pool } from "../db/pool.js";

/**
 * Creates 'sal_returns' and 'sal_return_details' tables to track customer returns.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the tables are created successfully.
 */
async function run() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_returns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        return_no VARCHAR(50) NOT NULL,
        return_date DATE NOT NULL,
        invoice_id BIGINT UNSIGNED,
        customer_id BIGINT UNSIGNED,
        return_type VARCHAR(50) DEFAULT 'DAMAGED',
        status VARCHAR(20) DEFAULT 'DRAFT',
        remarks TEXT,
        total_amount DECIMAL(18,2) DEFAULT 0,
        created_by BIGINT UNSIGNED,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_return_no (company_id, branch_id, return_no),
        INDEX idx_company_branch (company_id, branch_id)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_return_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        return_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_returned DECIMAL(18,4) NOT NULL DEFAULT 0,
        unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
        total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
        reason_code VARCHAR(50),
        remarks TEXT,
        PRIMARY KEY (id),
        INDEX idx_return (return_id),
        CONSTRAINT fk_sal_return_details_header FOREIGN KEY (return_id) REFERENCES sal_returns(id) ON DELETE CASCADE
      )
    `);
  } catch (err) {
    console.error(err);
  } finally {
    conn.release();
    process.exit();
  }
}

run();
