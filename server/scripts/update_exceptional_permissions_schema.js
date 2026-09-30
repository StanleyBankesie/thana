import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from server root
dotenv.config({ path: path.join(__dirname, "../../.env") });

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function migrate() {
  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("Connected to database.");

    // Check if columns exist before adding them to avoid errors
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'adm_exceptional_permissions'
    `, [dbConfig.database]);

    const columnNames = columns.map(c => c.COLUMN_NAME);

    const alterations = [];
    if (!columnNames.includes('effective_from')) {
      alterations.push("ADD COLUMN effective_from DATE NULL");
    }
    if (!columnNames.includes('effective_to')) {
      alterations.push("ADD COLUMN effective_to DATE NULL");
    }
    if (!columnNames.includes('approved_by')) {
      alterations.push("ADD COLUMN approved_by INT NULL");
    }
    if (!columnNames.includes('exception_type')) {
      alterations.push("ADD COLUMN exception_type VARCHAR(50) DEFAULT 'TEMPORARY'");
    }

    if (alterations.length > 0) {
      const sql = `ALTER TABLE adm_exceptional_permissions ${alterations.join(", ")}`;
      await connection.query(sql);
      console.log("Updated adm_exceptional_permissions schema.");
    } else {
      console.log("Schema already up to date.");
    }

  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    if (connection) await connection.end();
  }
}

migrate();
