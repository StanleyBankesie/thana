#!/usr/bin/env node

/**
 * Email Delivery Diagnostic - Traces the complete flow
 * Doesn't require database connection
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log("\n========== EMAIL DELIVERY DIAGNOSTIC ==========\n");

// 1. Check if all required files exist
console.log("1. CHECKING REQUIRED FILES");
console.log("   " + "=".repeat(50));

const requiredFiles = [
  "../utils/documentNotification.js",
  "../utils/mailer.js",
  "../controllers/workflow.controller.js",
  "../routes/push.routes.js",
  "../.env.production",
  "../.env",
];

requiredFiles.forEach((file) => {
  const fullPath = path.resolve(__dirname, file);
  const exists = fs.existsSync(fullPath);
  const status = exists ? "✓" : "✗";
  console.log(`   ${status} ${file}`);

  if (!exists && file.includes(".env")) {
    console.log(`       → ${file} is missing!`);
  }
});

// 2. Check env variables
console.log("\n2. CHECKING ENVIRONMENT VARIABLES");
console.log("   " + "=".repeat(50));

const envFile = fs.existsSync(path.resolve(__dirname, "../.env.production"))
  ? "../.env.production"
  : "../.env";

const envPath = path.resolve(__dirname, envFile);
const envContent = fs.readFileSync(envPath, "utf-8");
const envLines = envContent
  .split("\n")
  .filter((line) => !line.startsWith("#") && line.trim());

const smtpVars = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
  "SMTP_SECURE",
];
const dbVars = ["DB_HOST", "DB_USER", "DB_NAME"];

console.log(`   Using .env file: ${envFile}`);
console.log("\n   SMTP Variables:");
smtpVars.forEach((varName) => {
  const line = envLines.find((l) => l.startsWith(varName + "="));
  if (line) {
    const value = line.split("=")[1];
    const display = varName === "SMTP_PASS" ? "***hidden***" : value;
    console.log(`   ✓ ${varName}=${display}`);
  } else {
    console.log(`   ✗ ${varName} - NOT SET`);
  }
});

console.log("\n   Database Variables:");
dbVars.forEach((varName) => {
  const line = envLines.find((l) => l.startsWith(varName + "="));
  if (line) {
    const value = line.split("=")[1];
    console.log(`   ✓ ${varName}=${value}`);
  } else {
    console.log(`   ✗ ${varName} - NOT SET`);
  }
});

// 3. Check if notifyUser function has proper email handling
console.log("\n3. CHECKING WORKFLOW CODE - notifyUser() FUNCTION");
console.log("   " + "=".repeat(50));

const workflowPath = path.resolve(
  __dirname,
  "../controllers/workflow.controller.js",
);
const workflowContent = fs.readFileSync(workflowPath, "utf-8");

if (workflowContent.includes("await sendMail(")) {
  console.log("   ✓ Uses await sendMail() - proper error handling");
} else if (workflowContent.includes("Promise.resolve().then(() => sendMail")) {
  console.log("   ✗ Uses Promise.then() - BROKEN error handling!");
} else {
  console.log("   ⚠ Email sending code not found");
}

if (workflowContent.includes("[notifyUser]")) {
  console.log("   ✓ Has [notifyUser] logging");
} else {
  console.log("   ⚠ No [notifyUser] logging found");
}

if (workflowContent.includes("isMailerConfigured()")) {
  console.log("   ✓ Checks if mailer is configured");
} else {
  console.log("   ✗ No mailer configuration check");
}

// 4. Check documentNotification.js
console.log("\n4. CHECKING DOCUMENT NOTIFICATION SERVICE");
console.log("   " + "=".repeat(50));

const docNotifPath = path.resolve(
  __dirname,
  "../utils/documentNotification.js",
);
const docNotifContent = fs.readFileSync(docNotifPath, "utf-8");

if (docNotifContent.includes("sendDocumentForwardEmail")) {
  console.log("   ✓ Has sendDocumentForwardEmail() function");
} else {
  console.log("   ✗ Missing sendDocumentForwardEmail()");
}

if (docNotifContent.includes("sendDocumentForwardPush")) {
  console.log("   ✓ Has sendDocumentForwardPush() function");
} else {
  console.log("   ✗ Missing sendDocumentForwardPush()");
}

if (docNotifContent.includes("[DocumentNotification]")) {
  console.log("   ✓ Has [DocumentNotification] logging");
} else {
  console.log("   ⚠ No [DocumentNotification] logging found");
}

// 5. Summary of the flow
console.log("\n5. DOCUMENT FORWARD EMAIL FLOW");
console.log("   " + "=".repeat(50));

console.log(`
When a document is forwarded to user ID=1 (admin):

1. performAction() in workflow.controller.js is called
2. For APPROVE action:
   a. notifyUser() is called with message about approval
      → User gets DB notification
      → User gets PUSH notification
      → User gets EMAIL (if enabled)
   
   b. sendDocumentForwardNotification() is called
      → User gets another PUSH notification
      → User gets EMAIL (if enabled)

3. notifyUser() email path:
   - Checks if email notifications enabled
   - Fetches user email from adm_users
   - Calls await sendMail() with message
   - Logs result to adm_system_logs

4. sendDocumentForwardNotification() email path:
   - Checks if email notifications enabled
   - Fetches user email from adm_users
   - Calls await sendMail() with formatted message
   - Logs result to adm_system_logs
`);

// 6. What to check if email isn't received
console.log("\n6. TROUBLESHOOTING CHECKLIST");
console.log("   " + "=".repeat(50));

console.log(`
If admin@example.com (user id=1) doesn't get email:

□ Check adm_users table:
  SELECT email FROM adm_users WHERE id=1;
  → Email should be: stanleyetornam@gmail.com

□ Check adm_system_logs for email attempts:
  SELECT action, message FROM adm_system_logs 
  WHERE module_name IN ('Workflow', 'DocumentForward')
  AND action IN ('EMAIL_SENT', 'EMAIL_ERROR', 'EMAIL_SKIPPED')
  ORDER BY event_time DESC LIMIT 10;
  
  → Should see EMAIL_SENT or EMAIL_ERROR
  → If nothing: notifyUser was not called

□ Check server logs for [notifyUser] messages:
  → Should see: [notifyUser] Sending email to stanleyetornam@gmail.com
  → If not: Email code path not reached

□ Check server logs for [DocumentNotification] messages:
  → Should see: [DocumentNotification] ✓ Sending email
  → If not: sendDocumentForwardNotification not called

□ Verify SMTP is working:
  node scripts/test-email-config.js
  → Should complete successfully

□ Check notification preferences:
  SELECT * FROM adm_notification_prefs WHERE user_id=1;
  → email_enabled should be 1 (or no record = default)

□ Check Gmail account:
  → Look in Inbox
  → Check Spam/Promotions folder
  → Check if Gmail blocked the email
`);

// 7. Test email configuration directly
console.log("\n7. TO TEST EMAIL DELIVERY:");
console.log("   " + "=".repeat(50));

console.log(`
1. Run email configuration test:
   cd server
   node scripts/test-email-config.js

2. Start the server:
   npm run dev

3. Forward a document to admin user (id=1):
   - Watch server console for [notifyUser] logs
   - Document should trigger email

4. Check database:
   SELECT * FROM adm_system_logs 
   WHERE action IN ('EMAIL_SENT', 'EMAIL_ERROR')
   AND user_id = 1
   ORDER BY event_time DESC;

5. Check inbox:
   stanleyetornam@gmail.com should have 1-2 emails
   (one from notifyUser, one from sendDocumentForwardNotification)
`);

console.log("\n========== END DIAGNOSTIC ==========\n");
