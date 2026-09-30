// Database Pool Import
import { pool } from "../db/pool.js";

/**
 * Main execution function to create purchase reward campaign tables.
 * Handles table creation and schema updates for existing tables.
 */
async function run() {
  const conn = await pool.getConnection();
  try {
    console.log("Creating purchase reward campaign tables...");

    // 1. Create Purchase Reward Campaigns Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_purchase_reward_campaigns (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        campaign_name VARCHAR(255) NOT NULL,
        campaign_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        effective_from DATE NOT NULL,
        effective_to DATE DEFAULT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT '1',
        created_by BIGINT UNSIGNED DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pr_company (company_id),
        KEY idx_pr_created_by (created_by),
        KEY idx_pr_active (company_id, is_active, effective_from, effective_to),
        CONSTRAINT fk_pr_company FOREIGN KEY (company_id) REFERENCES adm_companies (id),
        CONSTRAINT fk_pr_created_by FOREIGN KEY (created_by) REFERENCES adm_users (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. Create Purchase Reward Campaign Items Table
    await conn.query(`
      CREATE TABLE IF NOT EXISTS sal_purchase_reward_campaign_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        campaign_id BIGINT UNSIGNED NOT NULL,
        item_ids VARCHAR(500) NOT NULL DEFAULT '',
        item_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        free_item_ids VARCHAR(500) NOT NULL DEFAULT '',
        free_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000',
        PRIMARY KEY (id),
        KEY idx_pr_items_campaign (campaign_id),
        CONSTRAINT fk_pr_items_campaign FOREIGN KEY (campaign_id) REFERENCES sal_purchase_reward_campaigns (id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add used_qty column if it doesn't exist (for existing tables)
    try {
      // Attempt to add used_qty column for backward compatibility
      await conn.query(`
        ALTER TABLE sal_purchase_reward_campaigns
        ADD COLUMN used_qty DECIMAL(18,3) NOT NULL DEFAULT '0.000'
        AFTER campaign_qty
      `);
      console.log("Added used_qty column to existing sal_purchase_reward_campaigns table");
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME') {
        console.log("used_qty column already exists");
      } else {
        throw e;
      }
    }

    console.log("Purchase reward campaign tables ready");
  } finally {
    conn.release();
  }
  process.exit(0);
}

run().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
