import { query } from "../db/pool.js";

async function run() {
  try {
    console.log("Resetting roles and permissions data...");

    // Clear user-specific page overrides
    try {
      await query("DELETE FROM adm_user_permissions");
      console.log("Cleared adm_user_permissions");
    } catch (err) {
      console.error("Skipped adm_user_permissions:", err.message);
    }

    // Clear exceptional permissions
    try {
      await query("DELETE FROM adm_exceptional_permissions");
      console.log("Cleared adm_exceptional_permissions");
    } catch (err) {
      console.error("Skipped adm_exceptional_permissions:", err.message);
    }

    // Clear user-role mapping (many-to-many table)
    try {
      await query("DELETE FROM adm_user_roles");
      console.log("Cleared adm_user_roles");
    } catch (err) {
      console.error("Skipped adm_user_roles:", err.message);
    }

    // Detach any direct role_id on users
    try {
      await query("UPDATE adm_users SET role_id = NULL");
      console.log("Reset adm_users.role_id");
    } catch (err) {
      console.error("Skipped resetting adm_users.role_id:", err.message);
    }

    // Clear role-page mapping
    try {
      await query("DELETE FROM adm_role_pages");
      console.log("Cleared adm_role_pages");
    } catch (err) {
      console.error("Skipped adm_role_pages:", err.message);
    }

    // Clear role-permission mapping (if used)
    try {
      await query("DELETE FROM adm_role_permissions");
      console.log("Cleared adm_role_permissions");
    } catch (err) {
      console.error("Skipped adm_role_permissions:", err.message);
    }

    // Clear role definitions
    try {
      await query("DELETE FROM adm_roles");
      console.log("Cleared adm_roles");
    } catch (err) {
      console.error("Skipped adm_roles:", err.message);
    }

    console.log("Roles and permissions reset complete.");
    process.exit(0);
  } catch (err) {
    console.error("Failed to reset roles and permissions:", err);
    process.exit(1);
  }
}

run();
