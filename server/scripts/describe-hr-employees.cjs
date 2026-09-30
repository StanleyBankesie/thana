/**
 * @fileoverview Utility script to describe the schema of the hr_employees table.
 * Written as a CommonJS module.
 * @module scripts/describe-hr-employees
 */

const { pool } = require("../db/pool.js");

/**
 * Connects to the database, executes a DESCRIBE query on the 'hr_employees' table,
 * and prints out the formatted table schema to the console.
 *
 * @returns {Promise<void>} Resolves when the description is output.
 */
async function describeTable() {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.execute("DESCRIBE hr_employees");
    console.log("hr_employees table columns:");
    console.log(
      "Field".padEnd(25) +
        "Type".padEnd(20) +
        "Null" +
        " Key" +
        " Default" +
        " Extra",
    );
    rows.forEach((row) => {
      console.log(
        (row.Field || "").padEnd(25) +
          (row.Type || "").padEnd(20) +
          (row.Null || "") +
          " " +
          (row.Key || "") +
          " " +
          (row.Default || "") +
          " " +
          (row.Extra || ""),
      );
    });
  } catch (err) {
    console.error("Error:", err.message);
    if (err.code === "ER_NO_SUCH_TABLE") {
      console.log("Table hr_employees does not exist");
    }
  } finally {
    connection.release();
  }
}

describeTable().catch(console.error);
