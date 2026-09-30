// Database Pool Dependency
const pool = require("c:/Users/stanl/OneDrive/Documents/serianamart/server/db.js");

// Migration script to ensure `created_by` column exists in fin_pdc_postings
async function fixPdcColumns() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log("Connected to the database.");

    // Check if created_by exists in fin_pdc_postings
    const [pdcColumns] = await conn.query(
      "SHOW COLUMNS FROM `fin_pdc_postings` LIKE 'created_by'",
    );

    if (pdcColumns.length > 0) {
      console.log("`created_by` column already exists in `fin_pdc_postings`.");
    } else {
      console.log("Adding `created_by` column to `fin_pdc_postings` table...");
      await conn.query(
        "ALTER TABLE `fin_pdc_postings` ADD COLUMN `created_by` INT NULL DEFAULT NULL",
      );
      console.log("Successfully added the `created_by` column.");
    }
  } catch (err) {
    console.error("Error during migration:", err);
    process.exit(1);
  } finally {
    if (conn) {
      conn.release();
      console.log("Database connection released.");
    }
    process.exit(0);
  }
}

fixPdcColumns();
