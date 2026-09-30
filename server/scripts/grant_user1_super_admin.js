/**
 * @file grant_user1_super_admin.js
 * @description Alternative script to grant super admin access to user 1.
 * Focuses on page-level access via the `adm_role_pages` table and ensures
 * all prerequisite tables and columns exist before applying grants.
 */

import { query } from "../db/pool.js";
import {
  ensureUserColumns,
  ensurePagesTable,
  ensurePagesSeed,
  ensureRolePagesTable,
  ensureUserPermissionsTable,
} from "../utils/dbUtils.js";

/**
 * Main execution function.
 * Initializes required database structures, validates the user exists,
 * ensures the "Super Admin" role, and links all active pages to the role.
 * 
 * @returns {Promise<void>} Resolves when the role and page grants are applied.
 */
async function run() {
  try {
    console.log("Ensuring required tables and columns exist...");
    await ensureUserColumns();
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();

    console.log("Checking user with id=1...");
    const users = await query(
      "SELECT id, role_id, is_active FROM adm_users WHERE id = :id LIMIT 1",
      { id: 1 },
    );
    if (!users.length) {
      console.log("User with id=1 not found. Aborting.");
      process.exit(1);
    }

    console.log("Ensuring role with id=1 exists...");
    await query(
      `INSERT IGNORE INTO adm_roles (id, company_id, name, code, is_active)
       VALUES (1, 1, 'Super Admin', 'SUPER_ADMIN', 1)`,
    );

    console.log("Assigning role_id=1 to user id=1 if not already set...");
    await query(
      `UPDATE adm_users 
       SET role_id = 1, is_active = 1 
       WHERE id = 1`,
    );

    console.log("Loading all active pages...");
    const pages = await query(
      "SELECT id FROM adm_pages WHERE is_active = 1",
    );
    const pageIds = pages.map((p) => Number(p.id)).filter((id) => Number.isFinite(id));

    console.log(
      `Granting role 1 access to ${pageIds.length} pages in adm_role_pages...`,
    );
    for (const pageId of pageIds) {
      await query(
        "INSERT IGNORE INTO adm_role_pages (role_id, page_id) VALUES (:roleId, :pageId)",
        { roleId: 1, pageId },
      );
    }

    console.log(
      "Clearing any user-specific overrides for user id=1 in adm_user_permissions...",
    );
    await query("DELETE FROM adm_user_permissions WHERE user_id = :uid", {
      uid: 1,
    });

    console.log(
      "User id=1 with role id=1 now has access to all pages and module features based on role grants.",
    );
    process.exit(0);
  } catch (err) {
    console.error("Failed to grant full access to user id=1:", err);
    process.exit(1);
  }
}

run();

