/**
 * @fileoverview Utility script to describe the schema of the hr_employees table.
 * Written as an ES module.
 * @module scripts/describe-hr-employees
 */

const { pool } = require("../db/pool.js");

/**
 * Executes a DESCRIBE query on the 'hr_employees' table using the connection pool directly
 * and prints out the formatted table schema to the console.
 *
 * @returns {Promise<void>} Resolves when the description is output.
 */
async function describeTable() {
  try {
    const [rows] = await pool.execute("DESCRIBE hr_employees");
    console.log("hr_employees table columns:");
    rows.forEach((row) => {
      console.log(
        `${row.Field.padEnd(25)} ${row.Type.padEnd(20)} ${row.Null} ${row.Key} ${row.Default || ""} ${row.Extra}`,
      );
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    pool.end();
  }
}

describeTable();
