import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
  });

  console.log("Connected to database.");

  try {
    // Read schema.sql
    const schemaPath = path.resolve(__dirname, "../../../db/schema.sql");
    console.log(`Reading schema from ${schemaPath}...`);
    const schemaSql = await fs.readFile(schemaPath, "utf8");

    // Read seed.sql
    const seedPath = path.resolve(__dirname, "../../../db/seed.sql");
    console.log(`Reading seed from ${seedPath}...`);
    const seedSql = await fs.readFile(seedPath, "utf8");

    // Drop all tables to ensure clean state
    console.log("Dropping all tables...");
    await connection.query("SET FOREIGN_KEY_CHECKS = 0");
    const [tables] = await connection.query("SHOW TABLES");
    if (tables.length > 0) {
      const dbName = process.env.DB_NAME;
      const key = `Tables_in_${dbName}`;
      const dropQueries = tables
        .map(
          (row) =>
            `DROP TABLE IF EXISTS \`${row[key] || Object.values(row)[0]}\``
        )
        .join("; ");
      await connection.query(dropQueries);
      console.log(`Dropped ${tables.length} tables.`);
    }
    await connection.query("SET FOREIGN_KEY_CHECKS = 1");

    // Execute Schema
    console.log("Executing schema.sql...");
    await connection.query(schemaSql);
    console.log("Schema executed successfully.");

    // Execute Seed
    console.log("Executing seed.sql...");
    await connection.query(seedSql);
    console.log("Seed executed successfully.");
  } catch (err) {
    console.error("Error executing SQL scripts:", err);
  } finally {
    await connection.end();
  }
}

run();
