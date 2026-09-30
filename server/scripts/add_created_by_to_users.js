/**
 * @fileoverview Database migration script to add a 'created_by' column to the adm_users table.
 * @module scripts/add_created_by_to_users
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

/**
 * Executes the database migration to add 'created_by' to 'adm_users' and creates an index.
 * Exits the process with code 0 on success, or 1 on failure.
 *
 * @returns {Promise<void>} Resolves when the migration is complete.
 */
// Main migration execution block
async function run() {
  try {
    console.log("Adding created_by column to adm_users...");
    // Execute alter table query to add created_by column and index
    await query(`
      ALTER TABLE adm_users 
      ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER role_id,
      ADD INDEX idx_user_created_by (created_by)
    `);
    console.log("Column added successfully.");
    process.exit(0);
  } catch (err) {
    // Handle migration failure and exit with error
    console.error("Migration failed:", err);
    process.exit(1);
  }
}
run();
