
// Database Connection Utility
import { query } from "../db/pool.js";

/**
 * Executes the migration to set up new permission tables.
 * Creates `adm_role_pages` and `adm_user_permissions` if they don't exist.
 */
async function migrate() {
  try {
    console.log("Starting new permissions schema setup...");

    // 1. Create adm_role_pages
    // This table links a Role to a Page (access only, no CRUD flags here)
    await query(`
      CREATE TABLE IF NOT EXISTS adm_role_pages (
        role_id BIGINT UNSIGNED NOT NULL,
        page_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (role_id, page_id),
        FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE,
        FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
      )
    `);
    console.log("Created adm_role_pages table");

    // 2. Create adm_user_permissions
    // This table links a User to a Page and defines specific CRUD rights
    await query(`
      CREATE TABLE IF NOT EXISTS adm_user_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        page_id BIGINT UNSIGNED NOT NULL,
        can_view TINYINT(1) DEFAULT 0,
        can_create TINYINT(1) DEFAULT 0,
        can_edit TINYINT(1) DEFAULT 0,
        can_delete TINYINT(1) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_user_page (user_id, page_id),
        FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE,
        FOREIGN KEY (page_id) REFERENCES adm_pages(id) ON DELETE CASCADE
      )
    `);
    console.log("Created adm_user_permissions table");

    console.log("Schema setup complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
