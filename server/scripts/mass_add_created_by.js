/**
 * @file mass_add_created_by.js
 * @description Migration script that scans all base tables in the database
 * and adds a `created_by` column with an associated index to any table
 * that doesn't already have it.
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

/**
 * Main execution function.
 * Retrieves a list of all tables in the current database, checks for
 * the `created_by` column, and alters the table to add it if missing.
 * 
 * @returns {Promise<void>} Resolves when all tables have been processed.
 */
async function run() {
  try {
    const tables = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
    `);
    
    for (const t of tables) {
      const tableName = t.table_name || t.TABLE_NAME;
      const columns = await query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = DATABASE() 
          AND table_name = :tableName 
          AND column_name = 'created_by'
      `, { tableName });
      
      if (columns.length === 0) {
        console.log(`Adding created_by to ${tableName}...`);
        try {
          await query(`
            ALTER TABLE ${tableName} 
            ADD COLUMN created_by BIGINT UNSIGNED NULL,
            ADD INDEX idx_${tableName}_created_by (created_by)
          `);
        } catch (e) {
          console.error(`Failed to add created_by to ${tableName}: ${e.message}`);
        }
      }
    }
    
    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
