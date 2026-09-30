/**
 * @fileoverview Database migration script to create and populate the fin_tax_components table.
 * @module scripts/create_fin_tax_components_table
 */

import { query } from "../db/pool.js";

/**
 * Creates the 'fin_tax_components' table if it doesn't exist and populates it
 * with default mappings based on existing 'fin_tax_details' for company_id 1.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the schema is created and data is upserted.
 */
async function run() {
  try {
    const sql = `
      CREATE TABLE IF NOT EXISTS fin_tax_components (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        tax_code_id BIGINT UNSIGNED NOT NULL,
        tax_detail_id BIGINT UNSIGNED NOT NULL,
        rate_percent DECIMAL(9,4) NULL,
        sort_order INT NOT NULL DEFAULT 0,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_tax_components (company_id, tax_code_id, tax_detail_id),
        KEY idx_tc_tax_code (tax_code_id),
        KEY idx_tc_tax_detail (tax_detail_id),
        CONSTRAINT fk_tc_company FOREIGN KEY (company_id) REFERENCES adm_companies(id),
        CONSTRAINT fk_tc_tax_code FOREIGN KEY (tax_code_id) REFERENCES fin_tax_codes(id) ON DELETE CASCADE,
        CONSTRAINT fk_tc_tax_detail FOREIGN KEY (tax_detail_id) REFERENCES fin_tax_details(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `;
    await query(sql);
    console.log("fin_tax_components table ensured.");

    const insertSql = `
      INSERT INTO fin_tax_components (company_id, tax_code_id, tax_detail_id, rate_percent, sort_order, is_active)
      SELECT 
        d.company_id,
        d.tax_code_id,
        d.id,
        d.rate_percent,
        CASE d.component_name
          WHEN 'NHIL' THEN 10 
          WHEN 'GETFund' THEN 20 
          WHEN 'COVID-19 Levy' THEN 30 
          WHEN 'Standard VAT' THEN 40 
          ELSE 100 
        END AS sort_order,
        d.is_active
      FROM fin_tax_details d
      WHERE d.company_id = 1
        AND d.tax_code_id = 1
      ON DUPLICATE KEY UPDATE
        rate_percent = VALUES(rate_percent),
        sort_order = VALUES(sort_order),
        is_active = VALUES(is_active);
    `;
    await query(insertSql);
    const countRows = await query(
      "SELECT COUNT(*) AS c FROM fin_tax_components WHERE company_id = :companyId AND tax_code_id = :taxCodeId",
      { companyId: 1, taxCodeId: 1 }
    );
    console.log(
      `fin_tax_components upsert complete. Rows for company_id=1, tax_code_id=1: ${countRows?.[0]?.c ?? 0}`
    );
    process.exit(0);
  } catch (err) {
    console.error("Error creating fin_tax_components:", err);
    process.exit(1);
  }
}

run();
