import { query } from "../db/pool.js";

async function run() {
  try {
    console.log("Creating missing workflow tables...");

    // 1. pur_supplier_quotations
    await query(`
      CREATE TABLE IF NOT EXISTS pur_supplier_quotations (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        quotation_no VARCHAR(50) NOT NULL,
        quotation_date DATE NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        rfq_id BIGINT UNSIGNED NULL,
        valid_until DATE NULL,
        currency_id BIGINT UNSIGNED NULL,
        exchange_rate DECIMAL(15, 6) DEFAULT 1,
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        status ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
        remarks VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sq_scope_no (company_id, branch_id, quotation_no),
        CONSTRAINT fk_sq_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_sq_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
        CONSTRAINT fk_sq_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_supplier_quotations");

    // 2. pur_supplier_quotation_details
    await query(`
      CREATE TABLE IF NOT EXISTS pur_supplier_quotation_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        quotation_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        unit_price DECIMAL(18,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        line_total DECIMAL(18,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sq_details_quotation (quotation_id),
        CONSTRAINT fk_sq_details_quotation FOREIGN KEY (quotation_id) REFERENCES pur_supplier_quotations(id) ON DELETE CASCADE,
        CONSTRAINT fk_sq_details_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_supplier_quotation_details");

    // 2.5 pur_orders (Added because it was missing)
    await query(`
      CREATE TABLE IF NOT EXISTS pur_orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        po_no VARCHAR(50) NOT NULL,
        po_date DATE NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        quotation_id BIGINT UNSIGNED NULL,
        po_type ENUM('LOCAL', 'IMPORT') NOT NULL DEFAULT 'LOCAL',
        delivery_date DATE NULL,
        currency_id BIGINT UNSIGNED NULL,
        exchange_rate DECIMAL(15, 6) DEFAULT 1,
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        status ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'CANCELLED', 'RECEIVED') NOT NULL DEFAULT 'DRAFT',
        remarks VARCHAR(500) NULL,
        approved_by BIGINT UNSIGNED NULL,
        approved_at TIMESTAMP NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_po_scope_no (company_id, branch_id, po_no),
        CONSTRAINT fk_po_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_po_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
        CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id),
        CONSTRAINT fk_po_quotation FOREIGN KEY (quotation_id) REFERENCES pur_supplier_quotations(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_orders");

    // 2.6 pur_order_details
    await query(`
      CREATE TABLE IF NOT EXISTS pur_order_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        po_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty DECIMAL(18,3) NOT NULL,
        unit_price DECIMAL(18,2) NOT NULL,
        discount_percent DECIMAL(5,2) DEFAULT 0,
        line_total DECIMAL(18,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_po_details_po (po_id),
        CONSTRAINT fk_po_details_po FOREIGN KEY (po_id) REFERENCES pur_orders(id) ON DELETE CASCADE,
        CONSTRAINT fk_po_details_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_order_details");

    // 2.7 pur_bills
    await query(`
      CREATE TABLE IF NOT EXISTS pur_bills (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        bill_no VARCHAR(50) NOT NULL,
        bill_date DATE NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        po_id BIGINT UNSIGNED NULL,
        grn_id BIGINT UNSIGNED NULL,
        bill_type ENUM('LOCAL','IMPORT') NOT NULL DEFAULT 'LOCAL',
        due_date DATE NULL,
        currency_id BIGINT UNSIGNED NULL,
        exchange_rate DECIMAL(15, 6) DEFAULT 1,
        payment_terms INT DEFAULT 30,
        total_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        discount_amount DECIMAL(15, 2) DEFAULT 0,
        freight_charges DECIMAL(15, 2) DEFAULT 0,
        other_charges DECIMAL(15, 2) DEFAULT 0,
        tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        net_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_purchase_bill_no (company_id, branch_id, bill_no),
        KEY idx_purchase_bill_supplier (supplier_id),
        CONSTRAINT fk_purchase_bill_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_purchase_bill_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
        CONSTRAINT fk_purchase_bill_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id),
        CONSTRAINT fk_purchase_bill_po FOREIGN KEY (po_id) REFERENCES pur_orders(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_bills");

    // 2.8 pur_bill_details
    await query(`
      CREATE TABLE IF NOT EXISTS pur_bill_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        bill_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        uom_id BIGINT UNSIGNED NULL,
        qty DECIMAL(18,3) NOT NULL,
        unit_price DECIMAL(18,2) NOT NULL,
        discount_percent DECIMAL(5, 2) DEFAULT 0,
        tax_amount DECIMAL(18,2) NOT NULL DEFAULT 0,
        line_total DECIMAL(18,2) NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_purchase_bill_details_bill (bill_id),
        CONSTRAINT fk_purchase_bill_details_bill FOREIGN KEY (bill_id) REFERENCES pur_bills(id) ON DELETE CASCADE,
        CONSTRAINT fk_purchase_bill_details_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_bill_details");

    // 3. pur_shipping_advices
    await query(`
      CREATE TABLE IF NOT EXISTS pur_shipping_advices (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        advice_no VARCHAR(50) NOT NULL,
        advice_date DATE NOT NULL,
        po_id BIGINT UNSIGNED NOT NULL,
        supplier_id BIGINT UNSIGNED NOT NULL,
        bill_of_lading VARCHAR(100) NULL,
        vessel_name VARCHAR(100) NULL,
        container_no VARCHAR(100) NULL,
        eta_date DATE NULL,
        status ENUM('DRAFT', 'SUBMITTED', 'CLEARED') NOT NULL DEFAULT 'DRAFT',
        remarks VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_sa_scope_no (company_id, branch_id, advice_no),
        CONSTRAINT fk_sa_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_sa_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
        CONSTRAINT fk_sa_po FOREIGN KEY (po_id) REFERENCES pur_orders(id),
        CONSTRAINT fk_sa_supplier FOREIGN KEY (supplier_id) REFERENCES pur_suppliers(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_shipping_advices");

    // 4. pur_shipping_advice_details
    await query(`
      CREATE TABLE IF NOT EXISTS pur_shipping_advice_details (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        advice_id BIGINT UNSIGNED NOT NULL,
        item_id BIGINT UNSIGNED NOT NULL,
        qty_shipped DECIMAL(18,3) NOT NULL,
        remarks VARCHAR(255) NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_sa_details_advice (advice_id),
        CONSTRAINT fk_sa_details_advice FOREIGN KEY (advice_id) REFERENCES pur_shipping_advices(id) ON DELETE CASCADE,
        CONSTRAINT fk_sa_details_item FOREIGN KEY (item_id) REFERENCES inv_items(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_shipping_advice_details");

    // 5. pur_port_clearances
    await query(`
      CREATE TABLE IF NOT EXISTS pur_port_clearances (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        branch_id BIGINT UNSIGNED NOT NULL,
        clearance_no VARCHAR(50) NOT NULL,
        clearance_date DATE NOT NULL,
        advice_id BIGINT UNSIGNED NULL,
        customs_entry_no VARCHAR(100) NULL,
        clearing_agent VARCHAR(150) NULL,
        duty_amount DECIMAL(18,2) DEFAULT 0,
        other_charges DECIMAL(18,2) DEFAULT 0,
        status ENUM('DRAFT', 'COMPLETED') NOT NULL DEFAULT 'DRAFT',
        remarks VARCHAR(500) NULL,
        created_by BIGINT UNSIGNED NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_pc_scope_no (company_id, branch_id, clearance_no),
        CONSTRAINT fk_pc_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_pc_branch FOREIGN KEY (branch_id) REFERENCES adm_branches(id),
        CONSTRAINT fk_pc_advice FOREIGN KEY (advice_id) REFERENCES pur_shipping_advices(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log("Created pur_port_clearances");

    console.log("Missing tables creation complete.");
    process.exit(0);
  } catch (err) {
    console.error("Error creating tables:", err);
    process.exit(1);
  }
}

run();
