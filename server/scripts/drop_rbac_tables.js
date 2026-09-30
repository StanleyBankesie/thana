/**
 * @fileoverview Database migration script to remove deprecated RBAC tables.
 * @module scripts/drop_rbac_tables
 */

import { query } from "../db/pool.js";

/**
 * Drops a series of deprecated role-based access control (RBAC) tables if they exist.
 * Logs each dropped table and exits the process when complete.
 *
 * @returns {Promise<void>} Resolves when all deprecated tables are dropped.
 */
async function run() {
  try {
    console.log("Dropping deprecated RBAC tables...");
    const tables = [
      "adm_user_roles",
      "adm_role_feature_permissions",
      "adm_user_permission_overrides",
      "adm_user_feature_overrides",
      "adm_role_disabled_features",
    ];
    for (const t of tables) {
      await query(`DROP TABLE IF EXISTS ${t}`);
      console.log(`Dropped: ${t}`);
    }
    console.log("Done.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to drop tables:", err);
    process.exit(1);
  }
}

run();
