/**
 * @fileoverview Utility script to diagnose database connectivity and credentials.
 * @module scripts/db_doctor
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import fs from "fs";
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

const cfg = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

/**
 * Formats a string with ANSI red color.
 *
 * @param {string} s - The string to format.
 * @returns {string} The formatted string.
 */
function red(s) {
  return `\x1b[31m${s}\x1b[0m`;
}
/**
 * Formats a string with ANSI green color.
 *
 * @param {string} s - The string to format.
 * @returns {string} The formatted string.
 */
function green(s) {
  return `\x1b[32m${s}\x1b[0m`;
}
/**
 * Formats a string with ANSI yellow color.
 *
 * @param {string} s - The string to format.
 * @returns {string} The formatted string.
 */
function yellow(s) {
  return `\x1b[33m${s}\x1b[0m`;
}

/**
 * Main execution function for the database diagnostic check.
 * Connects to the database and runs a simple query to verify access and functionality.
 * Prints diagnostic information or error instructions on failure.
 *
 * @returns {Promise<void>} Resolves when the check is complete.
 */
async function main() {
  console.log("Checking DB connectivity with:");
  console.log(` - HOST: ${cfg.host}`);
  console.log(` - PORT: ${cfg.port}`);
  console.log(` - USER: ${cfg.user}`);
  console.log(` - DB:   ${cfg.database}`);
  try {
    const conn = await mysql.createConnection({
      host: cfg.host,
      port: cfg.port,
      user: cfg.user,
      password: cfg.password,
      database: cfg.database,
      rowsAsArray: false,
    });
    const [rows] = await conn.query(
      "SELECT USER() AS user, CURRENT_USER() AS current_user, DATABASE() AS db, VERSION() AS version",
    );
    const info = rows && rows[0] ? rows[0] : {};
    console.log(green("DB OK"));
    console.log(` - USER(): ${info.user}`);
    console.log(` - CURRENT_USER(): ${info.current_user}`);
    console.log(` - DATABASE(): ${info.db}`);
    console.log(` - VERSION(): ${info.version}`);
    try {
      const [test] = await conn.query("SELECT 1 AS ok");
      console.log(` - SELECT 1: ${test[0]?.ok}`);
    } catch (e) {
      console.log(yellow(` - SELECT 1 error: ${e.message}`));
    }
    await conn.end();
  } catch (err) {
    console.error(red("DB ERROR"));
    console.error(red(err && err.message ? err.message : String(err)));
    console.error(
      yellow(
        "If this is 'Access denied', ensure the MySQL user exists for the exact host and has privileges on the database.\n" +
          "Example fixes (run in MySQL as admin):\n" +
          `  CREATE USER '${cfg.user}'@'${cfg.host === "localhost" ? "localhost" : "%"}' IDENTIFIED BY '<PASSWORD>'; \n` +
          `  GRANT ALL PRIVILEGES ON \`${cfg.database}\`.* TO '${cfg.user}'@'${cfg.host === "localhost" ? "localhost" : "%"}'; \n` +
          "  FLUSH PRIVILEGES;",
      ),
    );
    process.exit(1);
  }
}

main();

