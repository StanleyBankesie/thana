import { query } from "../db/pool.js";

async function migrate() {
  try {
    console.log("Starting migration...");

    // Check if columns exist to avoid errors, or just use ADD COLUMN IF NOT EXISTS (MySQL 8.0+)
    // Or just try/catch each add.

    const columns = [
      "ADD COLUMN profile_picture LONGBLOB NULL",
      "ADD COLUMN is_employee TINYINT(1) DEFAULT 0",
      "ADD COLUMN user_type VARCHAR(50) DEFAULT 'Employee'",
      "ADD COLUMN valid_from DATETIME NULL",
      "ADD COLUMN valid_to DATETIME NULL",
      "ADD COLUMN role_id BIGINT UNSIGNED NULL",
    ];

    for (const col of columns) {
      try {
        await query(`ALTER TABLE adm_users ${col}`);
        console.log(`Executed: ${col}`);
      } catch (err) {
        if (err.code === "ER_DUP_FIELDNAME") {
          console.log(`Skipping ${col} (already exists)`);
        } else {
          console.error(`Error executing ${col}:`, err.message);
        }
      }
    }

    // Add Foreign Key separately
    try {
      await query(
        "ALTER TABLE adm_users ADD CONSTRAINT fk_user_role FOREIGN KEY (role_id) REFERENCES adm_roles(id)",
      );
      console.log("Added Foreign Key fk_user_role");
    } catch (err) {
      if (err.code === "ER_DUP_KEY" || err.message.includes("duplicate")) {
        console.log("Skipping FK (already exists)");
      } else {
        console.error("Error adding FK:", err.message);
      }
    }

    console.log("Migration complete.");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
