import { createConnection } from "mysql2/promise";

async function main() {
  const db = await createConnection({
    host: "localhost",
    user: "root",
    password: "", // Trying root without password, or if demo DB exists, I will try to inspect information_schema.
    database: "demo_db",
  });
  
  // Get all tables
  const [tables] = await db.execute("SHOW TABLES LIKE '%roster%'");
  console.log("Roster tables:", JSON.stringify(tables, null, 2));

  // Get columns for maint_schedules
  const [scheduleCols] = await db.execute("SHOW COLUMNS FROM maint_schedules");
  console.log("maint_schedules columns:", JSON.stringify(scheduleCols.map(c => c.Field), null, 2));
  
  process.exit(0);
}
main().catch(err => {
  console.error("DB Error:", err.message);
  process.exit(1);
});
