#!/usr/bin/env node

/**
 * Check what happened during document forwarding
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

console.log("\n========== DOCUMENT FORWARDING EMAIL DEBUG ==========\n");

// Database connection configuration
const config = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

// Main asynchronous execution block
(async () => {
  let conn;
  try {
    conn = await mysql.createConnection(config);
    console.log("✓ Connected to database\n");

    // 1. Check admin user (id=1)
    console.log("1. CHECKING ADMIN USER");
    console.log("   " + "=".repeat(50));

    // Fetch admin user details to ensure email is configured
    const [adminUser] = await conn.query(
      `SELECT id, username, email, is_active FROM adm_users WHERE id = 1`,
    );

    if (adminUser.length) {
      const user = adminUser[0];
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email || "✗ NOT SET"}`);
      console.log(`   Active: ${user.is_active ? "Yes" : "No"}`);
    } else {
      console.log("   ✗ User ID 1 not found!");
    }

    // 2. Check workflow logs for recent activity
    console.log("\n2. RECENT WORKFLOW ACTIVITY (Last 20 records)");
    console.log("   " + "=".repeat(50));

    // Query recent document workflows to see if forwarding was triggered
    const [workflows] = await conn.query(
      `SELECT id, document_id, document_type, assigned_to_user_id, status, created_at
       FROM adm_document_workflows 
       ORDER BY created_at DESC 
       LIMIT 20`,
    );

    if (workflows.length) {
      workflows.forEach((wf, i) => {
        console.log(
          `   ${i + 1}. Doc ID: ${wf.document_id}, Type: ${wf.document_type}, Assigned to: ${wf.assigned_to_user_id}, Status: ${wf.status}, Created: ${wf.created_at}`,
        );
      });
    } else {
      console.log("   ✗ No workflows found");
    }

    // 3. Check email logs
    console.log("\n3. EMAIL LOGS - ALL ATTEMPTS (Last 30 records)");
    console.log("   " + "=".repeat(50));

    // Query system logs specifically for email sending activities
    const [emailLogs] = await conn.query(
      `SELECT id, user_id, module_name, action, message, event_time
       FROM adm_system_logs 
       WHERE module_name IN ('Workflow', 'DocumentForward', 'EmailDiagnosis')
       AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED', 'EMAIL_MOCK')
       ORDER BY event_time DESC 
       LIMIT 30`,
    );

    if (emailLogs.length) {
      emailLogs.forEach((log) => {
        const status = log.action === "EMAIL_SENT" ? "✓" : "✗";
        console.log(
          `   ${status} [${log.event_time}] User ${log.user_id}: ${log.action} (${log.module_name})`,
        );
        console.log(`       Message: ${log.message}`);
      });
    } else {
      console.log("   ✗ No email logs found - emails were not attempted!");
    }

    // 4. Check all logs for user ID 1 forwarding
    console.log("\n4. ALL LOGS FOR USER ID 1 (Last 50)");
    console.log("   " + "=".repeat(50));

    // Query all actions performed by or for the admin user
    const [userLogs] = await conn.query(
      `SELECT id, module_name, action, message, event_time
       FROM adm_system_logs 
       WHERE user_id = 1
       ORDER BY event_time DESC 
       LIMIT 50`,
    );

    if (userLogs.length) {
      userLogs.forEach((log) => {
        console.log(`   [${log.event_time}] ${log.module_name}: ${log.action}`);
        if (log.message) console.log(`       → ${log.message}`);
      });
    } else {
      console.log("   ✗ No logs for user 1");
    }

    // 5. Check notification preferences for admin user
    console.log("\n5. NOTIFICATION PREFERENCES FOR ADMIN USER");
    console.log("   " + "=".repeat(50));

    // Query notification preferences to confirm email notifications are enabled
    const [prefs] = await conn.query(
      `SELECT pref_key, email_enabled, push_enabled 
       FROM adm_notification_prefs 
       WHERE user_id = 1`,
    );

    if (prefs.length) {
      prefs.forEach((pref) => {
        console.log(
          `   ${pref.pref_key}: email=${pref.email_enabled}, push=${pref.push_enabled}`,
        );
      });
    } else {
      console.log(
        "   ⚠ No preferences set (will use defaults: email=1, push=1)",
      );
    }

    // 6. SMTP Configuration
    console.log("\n6. SMTP CONFIGURATION STATUS");
    console.log("   " + "=".repeat(50));
    // Output SMTP environment variables for debugging
    console.log(`   SMTP_HOST: ${process.env.SMTP_HOST || "✗ NOT SET"}`);
    console.log(`   SMTP_PORT: ${process.env.SMTP_PORT || "✗ NOT SET"}`);
    console.log(
      `   SMTP_USER: ${process.env.SMTP_USER ? "✓ SET" : "✗ NOT SET"}`,
    );
    console.log(
      `   SMTP_PASS: ${process.env.SMTP_PASS ? "✓ SET" : "✗ NOT SET"}`,
    );
    console.log(`   SMTP_FROM: ${process.env.SMTP_FROM || "✗ NOT SET"}`);
    console.log(`   SMTP_SECURE: ${process.env.SMTP_SECURE || "false"}`);

    // Close database connection
    await conn.end();
  } catch (err) {
    // Catch and report any execution errors
    console.error("\n✗ Error:", err.message);
    process.exit(1);
  }
})();
