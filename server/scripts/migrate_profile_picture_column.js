import { pool } from "../db/pool.js";

async function migrateProfilePictureColumn() {
  try {
    console.log("Starting migration: profile_picture_url -> profile_picture");

    // Get a connection from the pool
    const connection = await pool.getConnection();

    // Check if old column exists
    const [columns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_NAME = 'adm_users' AND COLUMN_NAME = 'profile_picture_url'`,
    );

    if (columns.length > 0) {
      console.log(
        "Found profile_picture_url column, renaming to profile_picture...",
      );

      // Drop the new column if it exists (from a previous failed migration)
      try {
        await connection.query(
          `ALTER TABLE adm_users DROP COLUMN profile_picture`,
        );
        console.log("Dropped existing profile_picture column");
      } catch (e) {
        // Column doesn't exist, that's fine
      }

      // Rename the column and change data type
      await connection.query(
        `ALTER TABLE adm_users 
         CHANGE COLUMN profile_picture_url profile_picture LONGBLOB NULL`,
      );
      console.log(
        "✓ Column renamed from profile_picture_url to profile_picture",
      );
      console.log("✓ Data type changed to LONGBLOB");
    } else {
      console.log(
        "profile_picture_url column not found, checking for profile_picture...",
      );

      const [newColumns] = await connection.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
         WHERE TABLE_NAME = 'adm_users' AND COLUMN_NAME = 'profile_picture'`,
      );

      if (newColumns.length === 0) {
        console.log("Creating profile_picture column...");
        await connection.query(
          `ALTER TABLE adm_users ADD COLUMN profile_picture LONGBLOB NULL`,
        );
        console.log("✓ Column profile_picture created as LONGBLOB");
      } else {
        console.log("✓ profile_picture column already exists");
      }
    }

    connection.release();
    console.log("\nMigration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error.message);
    throw error;
  }
}

migrateProfilePictureColumn();
