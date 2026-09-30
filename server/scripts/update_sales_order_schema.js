import { pool } from "../db/pool.js";

async function updateSchema() {
  const conn = await pool.getConnection();
  try {
    console.log("Starting schema update for sales orders...");

    // Update sal_orders table
    console.log("Updating sal_orders table...");
    const orderColumns = [
      "ADD COLUMN quotation_id BIGINT UNSIGNED NULL",
      "ADD COLUMN expected_delivery_date DATE NULL",
      "ADD COLUMN actual_delivery_date DATE NULL",
      "ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4",
      "ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1",
      "ADD COLUMN sales_person_id BIGINT UNSIGNED NULL",
      "ADD COLUMN payment_terms VARCHAR(50) NULL",
      "ADD COLUMN priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM'",
      "ADD COLUMN sub_total DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN discount_amount DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN shipping_charges DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN shipping_method VARCHAR(50) NULL",
      "ADD COLUMN carrier VARCHAR(100) NULL",
      "ADD COLUMN tracking_number VARCHAR(100) NULL",
      "ADD COLUMN vehicle_number VARCHAR(50) NULL",
      "ADD COLUMN driver_name VARCHAR(100) NULL",
      "ADD COLUMN driver_phone VARCHAR(50) NULL",
      "ADD COLUMN delivery_time TIME NULL",
      "ADD COLUMN delivery_instructions TEXT NULL",
      "ADD COLUMN internal_notes TEXT NULL",
      "ADD COLUMN customer_notes TEXT NULL",
      "ADD COLUMN created_by BIGINT UNSIGNED NULL",
    ];

    for (const col of orderColumns) {
      try {
        await conn.query(`ALTER TABLE sal_orders ${col}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          console.log(`Note: Could not execute ${col}: ${e.message}`);
        }
      }
    }

    // Add new sales order fields
    const extraOrderColumns = [
      "ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
      "ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'",
      "ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'",
    ];
    for (const col of extraOrderColumns) {
      try {
        await conn.query(`ALTER TABLE sal_orders ${col}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          console.log(`Note: Could not execute ${col}: ${e.message}`);
        }
      }
    }
    try {
      await conn.query(
        "ALTER TABLE sal_orders ADD CONSTRAINT fk_orders_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id)"
      );
    } catch (e) {
      if (e.code !== "ER_DUP_KEYNAME" && e.code !== "ER_CANNOT_ADD_FOREIGN") {
        console.log(`Note: Could not add FK fk_orders_warehouse: ${e.message}`);
      }
    }

    // Update sal_order_details table
    console.log("Updating sal_order_details table...");
    const detailColumns = [
      "ADD COLUMN qty_shipped DECIMAL(18,4) DEFAULT 0",
      "ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0",
      "MODIFY COLUMN qty DECIMAL(18,4) NOT NULL DEFAULT 0",
      "MODIFY COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0",
      "MODIFY COLUMN discount_percent DECIMAL(5,2) DEFAULT 0",
    ];

    for (const col of detailColumns) {
      try {
        await conn.query(`ALTER TABLE sal_order_details ${col}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          console.log(`Note: Could not execute ${col}: ${e.message}`);
        }
      }
    }

    // Create fin_item_taxes table if missing (renamed from fin_tax_details)
    try {
      await conn.query(`
        CREATE TABLE IF NOT EXISTS fin_item_taxes (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          item_id BIGINT UNSIGNED NOT NULL,
          tax_id BIGINT UNSIGNED NOT NULL,
          is_active TINYINT(1) NOT NULL DEFAULT 1,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_it_item (item_id),
          KEY idx_it_tax (tax_id),
          CONSTRAINT fk_it_item FOREIGN KEY (item_id) REFERENCES inv_items(id),
          CONSTRAINT fk_it_tax FOREIGN KEY (tax_id) REFERENCES fin_tax_codes(id)
        )
      `);
    } catch (e) {
      console.log(`Note: Could not create fin_item_taxes: ${e.message}`);
    }

    // Update sal_quotations header with needed fields
    console.log("Updating sal_quotations table...");
    const quotationColumns = [
      "ADD COLUMN warehouse_id BIGINT UNSIGNED NULL",
      "ADD COLUMN price_type ENUM('WHOLESALE','RETAIL') DEFAULT 'RETAIL'",
      "ADD COLUMN payment_type ENUM('CASH','CHEQUE','CREDIT') DEFAULT 'CASH'",
      "ADD COLUMN currency_id BIGINT UNSIGNED DEFAULT 4",
      "ADD COLUMN exchange_rate DECIMAL(18,6) DEFAULT 1",
    ];
    for (const col of quotationColumns) {
      try {
        await conn.query(`ALTER TABLE sal_quotations ${col}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          console.log(`Note: Could not execute ${col}: ${e.message}`);
        }
      }
    }
    try {
      await conn.query(
        "ALTER TABLE sal_quotations ADD CONSTRAINT fk_quotations_warehouse FOREIGN KEY (warehouse_id) REFERENCES inv_warehouses(id)"
      );
    } catch (e) {
      if (e.code !== "ER_DUP_KEYNAME" && e.code !== "ER_CANNOT_ADD_FOREIGN") {
        console.log(
          `Note: Could not add FK fk_quotations_warehouse: ${e.message}`
        );
      }
    }

    // Update sal_quotation_details to store tax info/rates
    console.log("Updating sal_quotation_details table...");
    const quotationDetailColumns = [
      "ADD COLUMN tax_type VARCHAR(50) NULL",
      "ADD COLUMN tax_amount DECIMAL(18,2) DEFAULT 0",
      "ADD COLUMN net_amount DECIMAL(18,2) DEFAULT 0",
      "MODIFY COLUMN qty DECIMAL(18,4) NOT NULL DEFAULT 0",
      "MODIFY COLUMN unit_price DECIMAL(18,4) NOT NULL DEFAULT 0",
      "MODIFY COLUMN discount_percent DECIMAL(5,2) DEFAULT 0",
    ];
    for (const col of quotationDetailColumns) {
      try {
        await conn.query(`ALTER TABLE sal_quotation_details ${col}`);
      } catch (e) {
        if (e.code !== "ER_DUP_FIELDNAME") {
          console.log(`Note: Could not execute ${col}: ${e.message}`);
        }
      }
    }

    // Seed default item-tax links (choose highest rate tax per company if not linked)
    try {
      await conn.query(`
        INSERT INTO fin_item_taxes (company_id, item_id, tax_id, is_active)
        SELECT i.company_id, i.id, t.id, 1
        FROM inv_items i
        JOIN (
          SELECT ft.company_id, ft.id
          FROM fin_tax_codes ft
        ) t ON t.company_id = i.company_id
        WHERE NOT EXISTS (
          SELECT 1 FROM fin_item_taxes d WHERE d.item_id = i.id
        )
        AND t.id = (
          SELECT ft2.id
          FROM fin_tax_codes ft2
          WHERE ft2.company_id = i.company_id
          ORDER BY ft2.rate_percent DESC
          LIMIT 1
        )
      `);
    } catch (e) {
      console.log(`Note: Could not seed fin_item_taxes: ${e.message}`);
    }

    console.log("Schema update completed successfully.");
  } catch (err) {
    console.error("Error updating schema:", err);
  } finally {
    conn.release();
    process.exit();
  }
}

updateSchema();
