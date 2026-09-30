import { query } from "../db/pool.js";

async function run() {
  try {
    console.log("Updating schema for Purchase Flow...");

    // 0. Drop existing tables if they conflict (Assumes fresh start for these specific flow tables is acceptable/requested)
    // We drop child first
    // await query(`DROP TABLE IF EXISTS pur_rfq_details`);
    // await query(`DROP TABLE IF EXISTS pur_rfq_items`);
    // await query(`DROP TABLE IF EXISTS pur_rfq_suppliers`);
    // await query(`DROP TABLE IF EXISTS pur_rfqs`);

    // Also need to drop constraints on other tables if they reference pur_rfqs,
    // but pur_supplier_quotations.rfq_id might reference it.
    // If pur_rfqs is dropped, constraints usually drop or error.
    // Let's try to remove constraint from pur_supplier_quotations if it exists.
    try {
      // await query(
      //   `ALTER TABLE pur_supplier_quotations DROP FOREIGN KEY fk_sq_rfq`
      // );
    } catch (e) {
      /* ignore */
    }

    // 1. Create pur_rfqs
    await query(`
      CREATE TABLE IF NOT EXISTS pur_rfqs (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        rfq_no VARCHAR(50) NOT NULL,
        rfq_date DATE NOT NULL,
        expiry_date DATE NULL,
        status ENUM('DRAFT', 'SENT', 'CLOSED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
        delivery_terms VARCHAR(100) NULL,
        terms_conditions TEXT NULL,
        remarks VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_rfq_scope_no (company_id, branch_id, rfq_no)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_rfqs");

    try {
      await query(
        `ALTER TABLE pur_rfqs ADD COLUMN expiry_date DATE NULL AFTER rfq_date`
      );
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("expiry_date column error:", e.message);
    }

    try {
      await query(
        `ALTER TABLE pur_rfqs ADD COLUMN delivery_terms VARCHAR(100) NULL AFTER status`
      );
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("delivery_terms column error:", e.message);
    }

    try {
      await query(
        `ALTER TABLE pur_rfqs ADD COLUMN terms_conditions TEXT NULL AFTER delivery_terms`
      );
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("terms_conditions column error:", e.message);
    }

    // 2. Create pur_rfq_details
    await query(`
      CREATE TABLE IF NOT EXISTS pur_rfq_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        rfq_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        required_date DATE NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_rfq_details_rfq (rfq_id),
        CONSTRAINT fk_rfq_details_rfq FOREIGN KEY (rfq_id) REFERENCES pur_rfqs(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_rfq_details");

    // 2.5 Create pur_rfq_suppliers
    await query(`
      CREATE TABLE IF NOT EXISTS pur_rfq_suppliers (
        rfq_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        PRIMARY KEY (rfq_id, supplier_id),
        KEY idx_rfq_sup_sup (supplier_id),
        CONSTRAINT fk_rfq_sup_rfq FOREIGN KEY (rfq_id) REFERENCES pur_rfqs(id) ON DELETE CASCADE,
        CONSTRAINT fk_rfq_sup_sup FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_rfq_suppliers");

    // 3. Add rfq_id to pur_supplier_quotations
    try {
      // Check if column exists first or just try ADD
      await query(
        `ALTER TABLE pur_supplier_quotations ADD COLUMN rfq_id BIGINT UNSIGNED NULL AFTER supplier_id`
      );
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("rfq_id column error:", e.message);
    }

    try {
      await query(
        `ALTER TABLE pur_supplier_quotations ADD CONSTRAINT fk_sq_rfq FOREIGN KEY (rfq_id) REFERENCES pur_rfqs(id)`
      );
      console.log("Linked pur_supplier_quotations to pur_rfqs");
    } catch (e) {
      if (!e.message.includes("Duplicate key"))
        console.log("fk_sq_rfq error:", e.message);
    }

    // 4. Add quotation_id to pur_orders
    try {
      await query(
        `ALTER TABLE pur_orders ADD COLUMN quotation_id BIGINT UNSIGNED NULL AFTER supplier_id`
      );
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("quotation_id column error:", e.message);
    }

    try {
      await query(
        `ALTER TABLE pur_orders ADD CONSTRAINT fk_po_quotation FOREIGN KEY (quotation_id) REFERENCES pur_supplier_quotations(id)`
      );
      console.log("Linked pur_orders to pur_supplier_quotations");
    } catch (e) {
      if (!e.message.includes("Duplicate key"))
        console.log("fk_po_quotation error:", e.message);
    }

    // 5. Update pur_orders status and approval columns
    try {
      // Update ENUM. Note: This might be slow on large tables.
      await query(
        `ALTER TABLE pur_orders MODIFY COLUMN status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'RECEIVED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT'`
      );
      console.log("Updated pur_orders status ENUM");
    } catch (e) {
      console.log("pur_orders status update error:", e.message);
    }

    try {
      await query(
        `ALTER TABLE pur_orders ADD COLUMN approved_by BIGINT UNSIGNED NULL AFTER remarks`
      );
      await query(
        `ALTER TABLE pur_orders ADD COLUMN approved_at TIMESTAMP NULL AFTER approved_by`
      );
      console.log("Added approval columns to pur_orders");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("approval columns error:", e.message);
    }

    // 6. Add clearing_id to inv_goods_receipt_notes
    try {
      await query(
        `ALTER TABLE inv_goods_receipt_notes ADD COLUMN clearing_id BIGINT UNSIGNED NULL AFTER po_id`
      );
      await query(
        `ALTER TABLE inv_goods_receipt_notes ADD CONSTRAINT fk_grn_clearing FOREIGN KEY (clearing_id) REFERENCES pur_port_clearances(id)`
      );
      console.log("Added clearing_id to inv_goods_receipt_notes");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("clearing_id error:", e.message);
    }

    // 7. Add grn_id to pur_bills
    try {
      await query(
        `ALTER TABLE pur_bills ADD COLUMN grn_id BIGINT UNSIGNED NULL AFTER po_id`
      );
      await query(
        `ALTER TABLE pur_bills ADD CONSTRAINT fk_bill_grn FOREIGN KEY (grn_id) REFERENCES inv_goods_receipt_notes(id)`
      );
      console.log("Added grn_id to pur_bills");
    } catch (e) {
      if (!e.message.includes("Duplicate column"))
        console.log("grn_id error:", e.message);
    }

    console.log("Schema update complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error updating schema:", err);
    process.exit(1);
  }
}

run();
