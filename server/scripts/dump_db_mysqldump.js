/**
 * @file dump_db_mysqldump.js
 * @description Script to create a MySQL database dump using mysqldump.
 * Loads environment variables and executes the dump process, saving the output
 * to the `backups` directory.
 */

import mysqldump from "mysqldump";
import dotenv from "dotenv";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(serverRoot, ".env") });
const localEnv = path.join(serverRoot, ".env.local");
const prodEnv = path.join(serverRoot, ".env.production");
const isProd = String(process.env.NODE_ENV || "").toLowerCase() === "production";
if (isProd && fs.existsSync(prodEnv)) {
  dotenv.config({ path: prodEnv, override: true });
} else if (fs.existsSync(localEnv)) {
  dotenv.config({ path: localEnv, override: true });
}

/**
 * Generates a formatted timestamp string for the backup filename.
 * Format: YYYYMMDD_HHMMSS
 * 
 * @returns {string} The formatted timestamp string.
 */
function ts() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const y = d.getFullYear();
  const m = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  const ss = pad(d.getSeconds());
  return `${y}${m}${day}_${hh}${mm}${ss}`;
}

/**
 * Main execution function.
 * Reads database credentials from environment variables and triggers
 * the database dump process. Exits the process on failure.
 * 
 * @returns {Promise<void>} Resolves when the backup is complete.
 */
async function run() {
  const host = process.env.DB_HOST;
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD ?? "";
  const database = process.env.DB_NAME;
  if (!host || !user || password === undefined || !database) {
    process.stderr.write("Missing DB env vars. Check server/.env or .env.local\n");
    process.exit(1);
  }
  const outDir = path.join(serverRoot, "backups");
  if (!fs.existsSync(outDir)) {
    await fsPromises.mkdir(outDir, { recursive: true });
  }
  const fname = `${database}_${ts()}.sql`;
  const outPath = path.join(outDir, fname);
  await mysqldump({
    connection: { host, port, user, password, database },
    dumpToFile: outPath,
  });
  process.stdout.write(outPath);
}

run().catch((e) => {
  process.stderr.write((e && e.message) || String(e));
  process.exit(1);
});
