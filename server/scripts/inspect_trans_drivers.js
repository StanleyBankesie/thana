import { query } from "../db/pool.js";

async function inspectDriversTable() {
  try {
    const rows = await query("DESCRIBE trans_drivers");
    console.log(JSON.stringify(Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows, null, 2));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

inspectDriversTable();
