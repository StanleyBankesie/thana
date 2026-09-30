/**
 * @file seed_inventory_missing.js
 * @description Script to initialize and seed foundational inventory configuration tables.
 * Creates missing tables (inv_item_groups, inv_item_categories, inv_item_types)
 * if they do not exist, ensures the `item_type` column is present in `inv_items`,
 * and seeds default data across all companies.
 */

import { pool } from "../db/pool.js";

/**
 * Main execution function to seed missing inventory tables and data.
 * Executes table creations and schema modifications sequentially,
 * followed by data insertion loops for default groups, categories,
 * item types, and units of measure (UOMs). Uses a transaction.
 * 
 * @returns {Promise<void>} Resolves when schema updates and seeding are complete.
 */
async function seedInventoryMissing() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [companyRows] = await connection.query(
      `SELECT id FROM adm_companies`
    );
    const companyIds =
      Array.isArray(companyRows) && companyRows.length
        ? companyRows.map((r) => Number(r.id)).filter((n) => Number.isFinite(n))
        : [1];

    console.log("Creating inv_item_groups table if not exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_item_groups (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        group_code VARCHAR(50) NOT NULL,
        group_name VARCHAR(100) NOT NULL,
        parent_group_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_group_company_code (company_id, group_code),
        KEY idx_group_company (company_id),
        KEY idx_group_parent (parent_group_id),
        CONSTRAINT fk_group_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_group_parent FOREIGN KEY (parent_group_id) REFERENCES inv_item_groups(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Creating inv_item_categories table if not exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_item_categories (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        category_code VARCHAR(50) NOT NULL,
        category_name VARCHAR(100) NOT NULL,
        parent_category_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_category_company_code (company_id, category_code),
        KEY idx_category_company (company_id),
        KEY idx_category_parent (parent_category_id),
        CONSTRAINT fk_category_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_category_parent FOREIGN KEY (parent_category_id) REFERENCES inv_item_categories(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Creating inv_item_types table if not exists...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS inv_item_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        type_code VARCHAR(50) NOT NULL,
        type_name VARCHAR(100) NOT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_type_company_code (company_id, type_code),
        KEY idx_type_company (company_id),
        CONSTRAINT fk_type_company FOREIGN KEY (company_id) REFERENCES adm_companies(id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("Ensuring inv_items has item_type column...");
    const [itemTypeColRows] = await connection.query(
      `
      SELECT COUNT(*) AS c
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'inv_items'
        AND column_name = 'item_type'
      `
    );
    const hasItemTypeCol = Number(itemTypeColRows?.[0]?.c || 0) > 0;
    if (!hasItemTypeCol) {
      await connection.query(
        `ALTER TABLE inv_items ADD COLUMN item_type VARCHAR(50) NULL AFTER barcode`
      );
    }

    console.log("Seeding inv_item_groups...");
    const groups = [
      { code: "DEF", name: "Default Group" },
      { code: "ELEC", name: "Electronics" },
      { code: "HW", name: "Hardware" },
      { code: "SOFT", name: "Software" },
    ];

    for (const companyId of companyIds) {
      for (const g of groups) {
        await connection.query(
          `
          INSERT INTO inv_item_groups (company_id, group_code, group_name, is_active)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE group_name = VALUES(group_name)
          `,
          [companyId, g.code, g.name]
        );
      }
    }

    console.log("Seeding inv_item_categories...");
    const categories = [
      { code: "RAW", name: "Raw Materials" },
      { code: "FG", name: "Finished Goods" },
      { code: "PKG", name: "Packaging Materials" },
    ];

    for (const companyId of companyIds) {
      for (const c of categories) {
        await connection.query(
          `
          INSERT INTO inv_item_categories (company_id, category_code, category_name, parent_category_id, is_active)
          VALUES (?, ?, ?, NULL, 1)
          ON DUPLICATE KEY UPDATE category_name = VALUES(category_name)
          `,
          [companyId, c.code, c.name]
        );
      }
    }

    console.log("Seeding inv_item_types...");
    const itemTypes = [
      { code: "RAW_MATERIAL", name: "Raw Material" },
      { code: "FINISHED_GOOD", name: "Finished Good" },
      { code: "SEMI_FINISHED", name: "Semi-Finished" },
      { code: "CONSUMABLE", name: "Consumable" },
      { code: "SERVICE", name: "Service" },
    ];

    for (const companyId of companyIds) {
      for (const t of itemTypes) {
        await connection.query(
          `
          INSERT INTO inv_item_types (company_id, type_code, type_name, is_active)
          VALUES (?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE type_name = VALUES(type_name)
          `,
          [companyId, t.code, t.name]
        );
      }
    }

    console.log("Seeding inv_uoms...");
    const uoms = [
      { code: "PCS", name: "Pieces", type: "COUNT" },
      { code: "EA", name: "Each", type: "COUNT" },
      { code: "BOX", name: "Box", type: "COUNT" },
      { code: "KG", name: "Kilogram", type: "WEIGHT" },
      { code: "LTR", name: "Liter", type: "VOLUME" },
      { code: "M", name: "Meter", type: "LENGTH" },
    ];

    for (const companyId of companyIds) {
      for (const u of uoms) {
        await connection.query(
          `
          INSERT INTO inv_uoms (company_id, uom_code, uom_name, uom_type, is_active)
          VALUES (?, ?, ?, ?, 1)
          ON DUPLICATE KEY UPDATE uom_name = VALUES(uom_name), uom_type = VALUES(uom_type)
          `,
          [companyId, u.code, u.name, u.type]
        );
      }
    }

    await connection.commit();
    console.log("Inventory missing data seeded successfully.");
  } catch (err) {
    await connection.rollback();
    console.error("Error seeding inventory data:", err);
  } finally {
    connection.release();
    process.exit();
  }
}

seedInventoryMissing();
