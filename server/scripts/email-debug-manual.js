#!/usr/bin/env node

/**
 * Quick check - email address for user 1 and recent email logs
 * Uses Node's built-in http to test the API if server is running
 */

import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load env
let envPath = path.resolve(__dirname, "../.env.production");
if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, "../.env");
}
dotenv.config({ path: envPath });

console.log("\n========== CHECKING EMAIL DELIVERY STATUS ==========\n");

console.log("Configuration:");
console.log(`  Email from: ${process.env.SMTP_FROM}`);
console.log(`  Admin email should be: stanleyetornam@gmail.com`);
console.log(`  Server port: ${process.env.PORT || 4002}`);

console.log("\n--- Manual Database Check Instructions ---\n");

console.log("Run these SQL commands to diagnose the issue:\n");

console.log("1. CHECK IF ADMIN USER HAS EMAIL SET:");
console.log(
  "   \x1b[36m" +
    `SELECT id, username, email FROM adm_users WHERE id = 1;` +
    "\x1b[0m\n",
);
console.log("   Expected result: email = stanleyetornam@gmail.com\n");

console.log("2. CHECK EMAIL ATTEMPTS FOR USER 1:");
console.log(
  "   \x1b[36m" +
    `SELECT action, message, event_time 
     FROM adm_system_logs 
     WHERE module_name IN ('Workflow', 'DocumentForward') 
     AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED')
     AND user_id = 1
     ORDER BY event_time DESC 
     LIMIT 10;` +
    "\x1b[0m\n",
);
console.log("   Expected: Should see EMAIL_SENT or EMAIL_ERROR entries\n");

console.log("3. CHECK ALL RECENT EMAIL LOGS (ALL USERS):");
console.log(
  "   \x1b[36m" +
    `SELECT user_id, action, message, event_time 
     FROM adm_system_logs 
     WHERE module_name IN ('Workflow', 'DocumentForward')
     AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED', 'EMAIL_MOCK')
     ORDER BY event_time DESC 
     LIMIT 20;` +
    "\x1b[0m\n",
);
console.log("   Expected: Should see recent email attempts\n");

console.log("4. CHECK NOTIFICATION PREFERENCES FOR USER 1:");
console.log(
  "   \x1b[36m" +
    `SELECT pref_key, email_enabled, push_enabled 
     FROM adm_notification_prefs 
     WHERE user_id = 1;` +
    "\x1b[0m\n",
);
console.log(
  "   Expected: email_enabled = 1, or no records (means default enabled)\n",
);

console.log("5. CHECK RECENT WORKFLOWS (to see if document was forwarded):");
console.log(
  "   \x1b[36m" +
    `SELECT id, document_id, document_type, assigned_to_user_id, status, created_at 
     FROM adm_document_workflows 
     ORDER BY created_at DESC 
     LIMIT 10;` +
    "\x1b[0m\n",
);
console.log(
  "   Expected: Should see a recent workflow with assigned_to_user_id = 1\n",
);

console.log("--- Possible Issues & Solutions ---\n");

console.log('✗ Issue: "No EMAIL_SENT or EMAIL_ERROR entries"');
console.log("  Cause: Email sending code was not executed");
console.log(
  "  Action: Check if workflow/performAction() was actually called\n",
);

console.log('✗ Issue: "EMAIL_ERROR with smtp auth error"');
console.log("  Cause: SMTP credentials might be wrong");
console.log("  Action: Run: node scripts/test-email-config.js\n");

console.log('✗ Issue: "EMAIL_ERROR with connection refused"');
console.log("  Cause: SMTP server unreachable");
console.log(
  "  Action: Check firewall, try different port (587 instead of 465)\n",
);

console.log('✗ Issue: "EMAIL_SENT but no email received"');
console.log(
  "  Cause: Email likely in Spam folder or Gmail marked it as promotional",
);
console.log("  Action: Check Gmail spam/promotions folder\n");

console.log('✗ Issue: "User 1 has no email in database"');
console.log("  Cause: Admin user email not set");
console.log(
  "  Action: UPDATE adm_users SET email = 'stanleyetornam@gmail.com' WHERE id = 1;\n",
);

console.log("--- Immediate Steps to Debug ---\n");

console.log("1. Connect to MySQL database for seriana_db");
console.log("   Host: localhost");
console.log("   User: seriana");
console.log("   Database: seriana_db\n");

console.log("2. Run the SQL queries above to find the issue\n");

console.log("3. Share the results:\n");
console.log("   - Does user 1 have stanleyetornam@gmail.com set?");
console.log("   - Is there an EMAIL_SENT entry?");
console.log("   - Is there an EMAIL_ERROR entry (if so, what's the message)?");
console.log("   - Did the workflow get created for user 1?\n");

console.log("\n========== END DEBUG INFO ==========\n");
