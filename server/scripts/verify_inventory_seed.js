/**
 * @file verify_inventory_seed.js
 * @description Quick verification script to check the row counts of core
 * inventory configuration tables (UOMs, Categories, Groups).
 */

import { pool } from "../db/pool.js";

/**
 * Main execution function.
 * Connects to the database and logs the total count of records
 * in the inventory configuration tables.
 * 
 * @returns {Promise<void>} Resolves when the verification is complete.
 */
async function verify() {
  try {
    const [uoms] = await pool.query("SELECT COUNT(*) as c FROM inv_uoms");
    const [cats] = await pool.query("SELECT COUNT(*) as c FROM inv_item_categories");
    const [groups] = await pool.query("SELECT COUNT(*) as c FROM inv_item_groups");

    console.log(`UOMs: ${uoms[0].c}`);
    console.log(`Categories: ${cats[0].c}`);
    console.log(`Groups: ${groups[0].c}`);
  } catch (err) {
    console.error("Verification failed:", err);
  } finally {
    process.exit();
  }
}

verify();
