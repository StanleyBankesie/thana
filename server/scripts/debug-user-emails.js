#!/usr/bin/env node

/**
 * Debug script to check user emails in adm_users table
 */

import mysql from "mysql2/promise";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
let envPath = path.resolve(__dirname, "../.env.production");
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, "../.env");
}
dotenv.config({ path: envPath });

console.log("\n========== USER EMAIL DEBUG ==========\n");
console.log(`Loading config from: ${path.basename(envPath)}\n`);

const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

console.log(`Database: ${config.database}@${config.host}\n`);

(async () => {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("✓ Connected to database\n");

    // Check users with emails
    console.log("1. CHECKING USERS WITH EMAIL ADDRESSES");
    console.log("   " + "=".repeat(40));

    const [users] = await conn.query(`
      SELECT id, username, email, company_id, is_active
      FROM adm_users
      ORDER BY id
      LIMIT 20
    `);

    if (users.length === 0) {
      console.log("   ✗ No users found in adm_users table");
    } else {
      users.forEach((user) => {
        const email = user.email ? "✓" : "✗";
        console.log(
          `   ${email} ID: ${user.id}, Username: ${user.username}, Email: ${user.email || "NOT SET"}, Active: ${user.is_active}`,
        );
      });
    }

    // Check notification preferences
    console.log("\n2. CHECKING NOTIFICATION PREFERENCES");
    console.log("   " + "=".repeat(40));

    const [prefs] = await conn.query(`
      SELECT user_id, pref_key, email_enabled, push_enabled
      FROM adm_notification_prefs
      LIMIT 10
    `);

    if (prefs.length === 0) {
      console.log(
        "   ⚠ No notification preferences found (users may use defaults)",
      );
    } else {
      prefs.forEach((pref) => {
        console.log(
          `   User ${pref.user_id}: key=${pref.pref_key}, email=${pref.email_enabled}, push=${pref.push_enabled}`,
        );
      });
    }

    // Summary
    console.log("\n3. SUMMARY");
    console.log("   " + "=".repeat(40));

    const usersWithEmail = users.filter((u) => u.email).length;
    const usersTotal = users.length;

    console.log(`   Total users: ${usersTotal}`);
    console.log(`   Users with email: ${usersWithEmail}`);
    console.log(`   Users without email: ${usersTotal - usersWithEmail}`);

    if (usersWithEmail === 0) {
      console.log("\n   ⚠ WARNING: No users have email addresses!");
      console.log("   → Need to populate email column in adm_users table");
      console.log("   → Users need: username → email mapping");
    } else if (usersWithEmail < usersTotal) {
      console.log(
        `\n   ⚠ WARNING: Only ${usersWithEmail}/${usersTotal} users have emails`,
      );
      console.log("   → Some users missing email addresses");
    } else {
      console.log("\n   ✓ All users have email addresses configured");
    }

    await conn.end();
  } catch (err) {
    console.error("\n✗ Error:", err.message);
    process.exit(1);
  }
})();
