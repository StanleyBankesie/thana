import { query } from "../db/pool.js";

async function check() {
  try {
    const tables = await query("SHOW TABLES");
    console.log("Tables in database:");
    const tableNames = tables.map((t) => Object.values(t)[0]);
    console.log(tableNames.join(", "));
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

check();
