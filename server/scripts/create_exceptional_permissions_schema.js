import { query } from "../db/pool.js";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root (two levels up from scripts)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function migrate() {
  try {
    console.log("Starting exceptional permissions migration...");

    // Create adm_exceptional_permissions table
    await query(`
      CREATE TABLE IF NOT EXISTS adm_exceptional_permissions (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        user_id BIGINT UNSIGNED NOT NULL,
        permission_code VARCHAR(150) NOT NULL,
        effect ENUM('ALLOW', 'DENY') NOT NULL DEFAULT 'ALLOW',
        reason VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_ep_user (user_id),
        KEY idx_ep_code (permission_code),
        CONSTRAINT fk_ep_user FOREIGN KEY (user_id) REFERENCES adm_users(id) ON DELETE CASCADE
      )
    `);
    console.log("Created adm_exceptional_permissions table");

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
