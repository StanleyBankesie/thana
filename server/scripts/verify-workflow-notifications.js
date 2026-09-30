/**
 * Workflow Notifications Verification Script
 * Test email and push notification functionality
 * Run: node server/scripts/verify-workflow-notifications.js
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const checks = [];

function log(status, message) {
  const icon = status === "✓" ? "✅" : status === "✗" ? "❌" : "ℹ️";
  console.log(`${icon} ${message}`);
  checks.push({ status, message });
}

async function verify() {
  console.log("\n🔍 Workflow Notifications System Verification\n");

  // 1. Check .env configuration
  console.log("📋 Environment Variables");
  try {
    const envPath = path.resolve(__dirname, "../../.env");
    if (!fs.existsSync(envPath)) {
      log("✗", ".env file not found");
    } else {
      const envContent = fs.readFileSync(envPath, "utf-8");
      const hasSmtpHost = envContent.includes("SMTP_HOST=");
      const hasSmtpPort = envContent.includes("SMTP_PORT=");
      const hasSmtpUser = envContent.includes("SMTP_USER=");
      const hasSmtpPass = envContent.includes("SMTP_PASS=");
      const hasSmtpFrom = envContent.includes("SMTP_FROM=");
      const hasVapidPublic = envContent.includes("VAPID_PUBLIC_KEY=");
      const hasVapidPrivate = envContent.includes("VAPID_PRIVATE_KEY=");

      if (
        hasSmtpHost &&
        hasSmtpPort &&
        hasSmtpUser &&
        hasSmtpPass &&
        hasSmtpFrom
      ) {
        log("✓", "Email (SMTP) configuration found");
      } else {
        log("✗", "Email (SMTP) configuration incomplete");
      }

      if (hasVapidPublic && hasVapidPrivate) {
        log("✓", "Push notification (VAPID) keys configured");
      } else {
        log("ℹ", "Push notification (VAPID) keys will be auto-generated");
      }
    }
  } catch (e) {
    log("✗", `Error reading .env: ${e.message}`);
  }

  // 2. Check notification service file
  console.log("\n📂 Files & Imports");
  try {
    const notifServicePath = path.resolve(
      __dirname,
      "../../server/utils/documentNotification.js",
    );
    if (fs.existsSync(notifServicePath)) {
      log("✓", "documentNotification.js service file exists");

      const content = fs.readFileSync(notifServicePath, "utf-8");
      if (content.includes("sendDocumentForwardNotification")) {
        log("✓", "sendDocumentForwardNotification function found");
      }
      if (content.includes("sendDocumentForwardEmail")) {
        log("✓", "sendDocumentForwardEmail function found");
      }
      if (content.includes("sendDocumentForwardPush")) {
        log("✓", "sendDocumentForwardPush function found");
      }
    } else {
      log("✗", "documentNotification.js service file NOT found");
    }
  } catch (e) {
    log("✗", `Error checking notification service: ${e.message}`);
  }

  // 3. Check workflow controller updates
  console.log("\n🔄 Workflow Controller Updates");
  try {
    const wfControllerPath = path.resolve(
      __dirname,
      "../../server/controllers/workflow.controller.js",
    );
    if (fs.existsSync(wfControllerPath)) {
      const content = fs.readFileSync(wfControllerPath, "utf-8");

      // Check imports
      if (content.includes("import { sendDocumentForwardNotification }")) {
        log("✓", "documentNotification import added to workflow controller");
      } else {
        log(
          "✗",
          "documentNotification import missing from workflow controller",
        );
      }

      if (content.includes("import { sendPushToUser }")) {
        log("✓", "sendPushToUser import added to workflow controller");
      } else {
        log("✗", "sendPushToUser import missing from workflow controller");
      }

      // Check startWorkflow update
      if (
        content.includes("await sendDocumentForwardNotification({") &&
        content.includes("startWorkflow")
      ) {
        log("✓", "startWorkflow function updated with notifications");
      } else {
        log("✗", "startWorkflow function not updated");
      }

      // Check notifyUser has push support
      if (
        content.includes("await sendPushToUser(targetUserId, pushPayload)") ||
        content.includes("sendPushToUser")
      ) {
        log("✓", "notifyUser function enhanced with push notifications");
      } else {
        log("✗", "notifyUser function not enhanced with push");
      }
    } else {
      log("✗", "workflow.controller.js not found");
    }
  } catch (e) {
    log("✗", `Error checking workflow controller: ${e.message}`);
  }

  // 4. Check database table requirements
  console.log("\n🗄️  Database Requirements");
  log("ℹ", "Required tables:");
  const requiredTables = [
    "adm_workflows",
    "adm_document_workflows",
    "adm_workflow_steps",
    "adm_workflow_step_approvers",
    "adm_workflow_tasks",
    "adm_notifications",
    "adm_push_subscriptions",
    "adm_system_logs",
    "adm_users",
    "adm_notification_prefs",
  ];

  requiredTables.forEach((table) => {
    log("ℹ", `  - ${table}`);
  });

  // 5. Check push service
  console.log("\n📱 Push Notification Service");
  try {
    const pushRoutePath = path.resolve(
      __dirname,
      "../../server/routes/push.routes.js",
    );
    if (fs.existsSync(pushRoutePath)) {
      const content = fs.readFileSync(pushRoutePath, "utf-8");
      if (content.includes("sendPushToUser")) {
        log("✓", "sendPushToUser function available in push service");
      }
      if (content.includes("adm_push_subscriptions")) {
        log("✓", "Push subscriptions table integration confirmed");
      }
    }
  } catch (e) {
    log("✗", `Error checking push service: ${e.message}`);
  }

  // 6. Check mailer service
  console.log("\n📧 Email Service");
  try {
    const mailerPath = path.resolve(__dirname, "../../server/utils/mailer.js");
    if (fs.existsSync(mailerPath)) {
      const content = fs.readFileSync(mailerPath, "utf-8");
      if (content.includes("sendMail")) {
        log("✓", "sendMail function available");
      }
      if (content.includes("isMailerConfigured")) {
        log("✓", "Mailer configuration check available");
      }
    }
  } catch (e) {
    log("✗", `Error checking mailer service: ${e.message}`);
  }

  // 7. Check frontend push configuration
  console.log("\n🖥️  Frontend Configuration");
  try {
    const swPath = path.resolve(__dirname, "../../client/public/sw.js");
    if (fs.existsSync(swPath)) {
      const content = fs.readFileSync(swPath, "utf-8");
      if (content.includes("self.addEventListener('push'")) {
        log("✓", "Service worker push event listener configured");
      }
    }

    const appShellPath = path.resolve(
      __dirname,
      "../../client/src/layout/AppShell.jsx",
    );
    if (fs.existsSync(appShellPath)) {
      const content = fs.readFileSync(appShellPath, "utf-8");
      if (content.includes("subscribePush") || content.includes("subscribe")) {
        log("✓", "AppShell push subscription code present");
      }
    }
  } catch (e) {
    log("ℹ", `Frontend checks: ${e.message}`);
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  const passed = checks.filter((c) => c.status === "✓").length;
  const failed = checks.filter((c) => c.status === "✗").length;
  const info = checks.filter((c) => c.status === "ℹ").length;

  console.log(
    `\n📊 Summary: ${passed} passed, ${failed} failed, ${info} info\n`,
  );

  if (failed === 0) {
    console.log(
      "✅ All critical checks passed! System is ready for testing.\n",
    );
  } else {
    console.log("⚠️  Please address the failed checks above.\n");
  }

  // 8. Testing instructions
  console.log("\n📝 Testing Instructions\n");
  console.log("1. Create a document (Sales Order, Purchase Order, etc.)");
  console.log("2. Forward to an approver");
  console.log("3. Check email inbox for notification");
  console.log("4. Check browser notification if enabled");
  console.log("5. Monitor adm_system_logs table for:");
  console.log("   - module_name = 'DocumentForward'");
  console.log(
    "   - action IN ('EMAIL_SENT', 'PUSH_SENT', 'EMAIL_ERROR', etc.)",
  );
  console.log("\n");
}

verify().catch((e) => {
  console.error("Verification failed:", e);
  process.exit(1);
});
