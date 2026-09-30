/**
 * @fileoverview Database migration script to consolidate company logo storage in adm_companies.
 * @module scripts/drop_company_logo_columns
 */

import { pool } from "../db/pool.js";

/**
 * Drops legacy logo columns ('logo_url', 'logo_blob', 'logo_mime') from 'adm_companies'
 * and creates a unified 'logo' LONGBLOB column. Ignores errors if columns don't exist.
 * Exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when the migration is complete.
 */
async function dropCompanyLogoColumns() {
  const conn = await pool.getConnection();
  try {
    console.log("Dropping logo columns from adm_companies...");
    try {
      await conn.query("ALTER TABLE adm_companies DROP COLUMN logo_url");
      console.log("Dropped column: logo_url");
    } catch (e) {
      console.log("logo_url drop skipped:", e?.message || e);
    }
    try {
      await conn.query("ALTER TABLE adm_companies DROP COLUMN logo_blob");
      console.log("Dropped column: logo_blob");
    } catch (e) {
      console.log("logo_blob drop skipped:", e?.message || e);
    }
    try {
      await conn.query("ALTER TABLE adm_companies DROP COLUMN logo_mime");
      console.log("Dropped column: logo_mime");
    } catch (e) {
      console.log("logo_mime drop skipped:", e?.message || e);
    }
    try {
      await conn.query(
        "ALTER TABLE adm_companies ADD COLUMN logo LONGBLOB NULL",
      );
      console.log("Added column: logo");
    } catch (e) {
      console.log("logo column add skipped:", e?.message || e);
    }
  } finally {
    conn.release();
  }
  process.exit(0);
}

dropCompanyLogoColumns().catch((e) => {
  console.error("Failed to drop columns:", e);
  process.exit(1);
});
