// Database Configuration and Dependencies
import * as dotenv from 'dotenv';
dotenv.config({ path: './server/.env' });
import { query } from "../db/pool.js";

// Defined System Modules
const MODULES = [
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
  "service-management"
];

// Main execution function to fix RBAC settings for the super admin user
async function run() {
  try {
    console.log("Starting RBAC Fix for User ID 1...");

    // 1. Ensure Role 1 exists
    console.log("Ensuring Role 1 (Super Admin) exists...");
    await query(`
      INSERT INTO adm_roles (id, company_id, name, code, is_active)
      VALUES (1, 1, 'Super Admin', 'SUPER_ADMIN', 1)
      ON DUPLICATE KEY UPDATE name = VALUES(name), code = VALUES(code), is_active = VALUES(is_active)
    `);

    // 2. Assign User 1 to Role 1
    console.log("Assigning User 1 to Role 1...");
    await query(`
      UPDATE adm_users SET role_id = 1 WHERE id = 1
    `);

    // 3. Grant Modules
    console.log("Granting Modules to Role 1...");
    for (const mk of MODULES) {
      await query(`
        INSERT IGNORE INTO adm_role_modules (role_id, module_key)
        VALUES (1, :mk)
      `, { mk });
    }

    // 4. Grant full permissions at Module level (for backward compatibility)
    console.log("Granting Full Permissions (Module Level) to Role 1...");
    for (const mk of MODULES) {
      await query(`
        INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
        VALUES (1, :mk, :mk, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
      `, { mk });
    }

    // 5. Grant specific features (from adm_role_features)
    console.log("Granting Full Permissions (Feature Level) to Role 1...");
    const features = await query("SELECT feature_key FROM adm_role_features WHERE role_id = 1");
    for (const f of features) {
      const fk = f.feature_key;
      const [mk] = fk.split(":");
      if (!mk) continue;
      
      await query(`
        INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
        VALUES (1, :mk, :fk, 1, 1, 1, 1)
        ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
      `, { mk, fk });
    }

    // 6. Special '*' permission for superuser
    console.log("Adding '*' entry to adm_role_modules and adm_role_permissions...");
    await query(`INSERT IGNORE INTO adm_role_modules (role_id, module_key) VALUES (1, '*')`);
    await query(`
      INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
      VALUES (1, '*', '*', 1, 1, 1, 1)
      ON DUPLICATE KEY UPDATE can_view=1, can_create=1, can_edit=1, can_delete=1
    `);

    console.log("RBAC Fix Completed successfully.");
    process.exit(0);
  } catch (err) {
    console.error("RBAC Fix Failed:", err);
    process.exit(1);
  }
}

run();
