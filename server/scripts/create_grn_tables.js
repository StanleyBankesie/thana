/**
 * @fileoverview Database migration script to create tables for Goods Receipt Notes (GRN).
 * @module scripts/create_grn_tables
 */

import { pool } from "../db/pool.js";

/**
 * Creates 'inv_goods_receipt_notes' and 'inv_goods_receipt_note_details' tables.
 * Uses a database transaction to ensure atomicity.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the tables are successfully created.
 */
async function createGrnTables() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    console.log("Creating inv_goods_receipt_notes table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_goods_receipt_notes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NULL,
        grn_no VARCHAR(50) NOT NULL,
        grn_date DATETIME NOT NULL,
        grn_type VARCHAR(50) NOT NULL DEFAULT 'LOCAL',
        supplier_id BIGINT UNSIGNED NOT NULL,
        po_id BIGINT UNSIGNED NULL,
        warehouse_id BIGINT UNSIGNED NULL,
        port_clearance_id BIGINT UNSIGNED NULL,
        invoice_no VARCHAR(100) NULL,
        invoice_date DATE NULL,
        invoice_amount DECIMAL(18,2) NULL,
        invoice_due_date DATE NULL,
        bill_of_lading VARCHAR(100) NULL,
        customs_entry_no VARCHAR(100) NULL,
        shipping_company VARCHAR(100) NULL,
        port_of_entry VARCHAR(100) NULL,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        remarks TEXT NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_grn_no (company_id, grn_no),
        KEY idx_grn_company (company_id),
        KEY idx_grn_supplier (supplier_id),
        KEY idx_grn_po (po_id),
        CONSTRAINT fk_grn_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_grn_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Creating inv_goods_receipt_note_details table...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_goods_receipt_note_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        grn_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_ordered DECIMAL(18,4) NOT NULL DEFAULT 0,
        qty_received DECIMAL(18,4) NOT NULL DEFAULT 0,
        qty_accepted DECIMAL(18,4) NOT NULL DEFAULT 0,
        qty_rejected DECIMAL(18,4) NOT NULL DEFAULT 0,
        uom VARCHAR(20) NOT NULL DEFAULT 'PCS',
        unit_price DECIMAL(18,2) NOT NULL DEFAULT 0,
        line_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        batch_serial VARCHAR(100) NULL,
        expiry_date DATE NULL,
        inspection_status VARCHAR(50) DEFAULT 'PENDING',
        remarks TEXT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_grnd_grn (grn_id),
        KEY idx_grnd_item (item_id),
        CONSTRAINT fk_grnd_grn FOREIGN KEY (grn_id) REFERENCES inv_goods_receipt_notes(id) ON DELETE CASCADE,
        CONSTRAINT fk_grnd_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.commit();
    console.log("GRN tables created successfully.");
  } catch (error) {
    await connection.rollback();
    console.error("Error creating GRN tables:", error);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

createGrnTables();
