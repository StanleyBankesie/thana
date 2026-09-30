// Database Pool Dependency
import { query } from "../db/pool.js";

// Script to grant all system features and modules to Role 1 (Super Admin)
async function run() {
  try {
    const roleId = 1;
    console.log(
      "Ensuring role id=1 has full module and feature visibility with actions...",
    );

    // Ensure role exists
    await query(
      `INSERT INTO adm_roles (id, company_id, name, code, is_active)
       VALUES (1, 1, 'Super Admin', 'SUPER_ADMIN', 1)
       ON DUPLICATE KEY UPDATE name=VALUES(name), code=VALUES(code), is_active=VALUES(is_active)`,
      {},
    );

    // Ensure tables exist
    await query(`
      CREATE TABLE IF NOT EXISTS adm_role_features (
        role_id BIGINT UNSIGNED NOT NULL,
        feature_key VARCHAR(150) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, feature_key),
        INDEX idx_role_id (role_id),
        INDEX idx_feature_key (feature_key),
        FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await query(`
      CREATE TABLE IF NOT EXISTS adm_role_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        role_id BIGINT UNSIGNED NOT NULL,
        module_key VARCHAR(100) NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY uq_role_module_perm (role_id, module_key),
        INDEX idx_role_id (role_id),
        INDEX idx_module_key (module_key),
        FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // List of core Server module keys
    const MODULES = [
      "administration",
      "finance",
      "inventory",
      "purchase",
      "sales",
      "human-resources",
      "maintenance",
      "project-management",
      "production",
      "pos",
      "business-intelligence",
      "service-management",
    ];

    // Build feature keys from registry if available, else fallback to module roots
    let FEATURES = [];
    try {
      const { getAllFeatures } = await import("../data/featuresRegistry.js");
      FEATURES = getAllFeatures().map((f) => f.feature_key);
    } catch {
      FEATURES = MODULES.map((mk) => `${mk}:root`);
    }

    // Grant modules in role modules using server keys
    for (const mk of MODULES) {
      await query(
        `INSERT IGNORE INTO adm_role_modules (role_id, module_key)
         VALUES (:roleId, :moduleKey)`,
        { roleId, moduleKey: mk },
      );
    }

    // Grant feature allowlist
    for (const fk of FEATURES) {
      await query(
        `INSERT IGNORE INTO adm_role_features (role_id, feature_key)
         VALUES (:roleId, :featureKey)`,
        { roleId, featureKey: fk },
      );
    }

    // Grant full module-level permissions
    for (const mk of MODULES) {
      await query(
        `INSERT INTO adm_role_permissions (role_id, module_key, can_view, can_create, can_edit, can_delete)
         VALUES (:roleId, :moduleKey, 1, 1, 1, 1)
         ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1`,
        { roleId, moduleKey: mk },
      );
    }

    console.log("Completed: role id=1 has all modules, features, and actions.");

    process.exit(0);
  } catch (err) {
    console.error("Failed to grant modules/features/actions:", err);
    process.exit(1);
  }
}

run();
