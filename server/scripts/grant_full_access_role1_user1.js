/**
 * @file grant_full_access_role1_user1.js
 * @description Script to grant full system access to the user with ID 1
 * by assigning them the Super Admin role and ensuring they have maximum 
 * permissions across all modules and features.
 */

import { query } from "../db/pool.js";

/**
 * Main execution function.
 * Ensures the "Super Admin" role exists, assigns it to user 1,
 * and sets up broad permissions and overrides for full system access.
 * 
 * @returns {Promise<void>} Resolves when access granting is complete.
 */
async function run() {
  try {
    console.log(
      "Ensuring role id=1 exists as 'Super Admin' (legacy schema)...",
    );
    await query(
      `
      INSERT INTO adm_roles (id, company_id, name, code, is_active)
      VALUES (1, 1, 'Super Admin', 'SUPER_ADMIN', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), is_active = VALUES(is_active)
      `,
      {},
    );

    console.log("Assigning role_id=1 to user id=1...");
    await query(
      `
      UPDATE adm_users
      SET role_id = 1
      WHERE id = 1
      `,
      {},
    );

    const modules = [
      "administration",
      "sales",
      "inventory",
      "purchase",
      "finance",
      "human-resources",
      "maintenance",
      "project-management",
      "production",
      "pos",
      "business-intelligence",
      "service-management",
    ];

    console.log("Granting all modules visibility to role id=1...");
    for (const mk of modules) {
      await query(
        `
        INSERT IGNORE INTO adm_role_modules (role_id, module_key)
        VALUES (1, :moduleKey)
        `,
        { moduleKey: mk },
      );
    }

    console.log("Granting full permissions for all modules to role id=1...");
    for (const mk of modules) {
      await query(
        `
        INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
        VALUES (1, :moduleKey, :moduleKey, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
        `,
        { moduleKey: mk },
      );
    }

    console.log("Clearing user id=1 overrides to avoid accidental denies...");
    await query(
      `
      DELETE FROM adm_user_permission_overrides
      WHERE user_id = 1
      `,
      {},
    );

    console.log(
      "Setting explicit overrides for ALL modules to ALLOW for user id=1...",
    );
    for (const mk of modules) {
      await query(
        `
        INSERT INTO adm_user_permission_overrides (user_id, module_key, can_view, can_create, can_edit, can_delete)
        VALUES (1, :moduleKey, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
        `,
        { moduleKey: mk },
      );
    }

    console.log("Ensuring feature overrides table exists...");
    await query(`
      CREATE TABLE IF NOT EXISTS adm_user_feature_overrides (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        feature_key VARCHAR(150) NOT NULL,
        can_view TINYINT(1) NULL,
        can_create TINYINT(1) NULL,
        can_edit TINYINT(1) NULL,
        can_delete TINYINT(1) NULL,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_feature (user_id, feature_key),
        INDEX idx_user_id (user_id),
        INDEX idx_feature_key (feature_key)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const features = [
      { feature_key: "administration:companies" },
      { feature_key: "administration:branches" },
      { feature_key: "administration:settings" },
      { feature_key: "administration:workflows" },
      { feature_key: "administration:reports" },
      { feature_key: "administration:access-roles" },
      { feature_key: "administration:access-user-permissions" },
      { feature_key: "administration:access-user-overrides" },
      { feature_key: "sales:sales-orders" },
      { feature_key: "sales:invoices" },
      { feature_key: "inventory:stock-upload" },
      { feature_key: "pos:reports" },
    ];

    console.log("Granting full permissions for ALL features to user id=1...");
    for (const f of features) {
      await query(
        `
        INSERT INTO adm_user_feature_overrides (user_id, feature_key, can_view, can_create, can_edit, can_delete)
        VALUES (1, :featureKey, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
        `,
        { featureKey: f.feature_key },
      );
    }

    console.log("Completed: user id=1 and role id=1 have full access.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to grant full access:", err);
    process.exit(1);
  }
}

run();
