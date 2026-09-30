import express from "express";
import { query } from "../db/pool.js";
import { isMailerConfigured, sendMail, verifyMailer } from "../utils/mailer.js";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

/**
 * Test email configuration and send test email
 * POST /email-test/diagnose
 */
router.post(
  "/diagnose",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      console.log("[EMAIL_DIAGNOSE] Starting email diagnosis...");

      const diagnosis = {
        timestamp: new Date().toISOString(),
        configured: isMailerConfigured(),
        environment: {
          SMTP_HOST: process.env.SMTP_HOST ? "SET" : "MISSING",
          SMTP_PORT: process.env.SMTP_PORT || "NOT SET",
          SMTP_USER: process.env.SMTP_USER ? "SET" : "MISSING",
          SMTP_PASS: process.env.SMTP_PASS ? "SET" : "MISSING",
          SMTP_FROM: process.env.SMTP_FROM || "MISSING",
          SMTP_SECURE: process.env.SMTP_SECURE || "NOT SET",
        },
        tests: {},
      };

      // Test 1: Check mailer configuration
      if (!isMailerConfigured()) {
        diagnosis.tests.configuration = {
          status: "FAIL",
          reason: "Mailer not configured",
        };
        return res.json(diagnosis);
      }
      diagnosis.tests.configuration = { status: "PASS" };

      // Test 2: Verify SMTP connection
      try {
        const verified = await verifyMailer();
        diagnosis.tests.smtp_connection = {
          status: verified ? "PASS" : "FAIL",
          message: verified ? "SMTP connection OK" : "Could not verify SMTP",
        };
      } catch (err) {
        diagnosis.tests.smtp_connection = {
          status: "FAIL",
          error: err?.message,
        };
      }

      // Test 3: Get user email
      const userEmail = req.user?.email || (await getUserEmail(req.user?.sub));
      if (!userEmail) {
        diagnosis.tests.user_email = {
          status: "FAIL",
          reason: "User has no email configured",
        };
        return res.json(diagnosis);
      }
      diagnosis.tests.user_email = { status: "PASS", email: userEmail };

      // Test 4: Send test email
      try {
        const testSubject = "[TEST] Email Configuration Test";
        const testText = `
This is a test email from Omnisuite ERP.
If you received this, email configuration is working correctly.
Timestamp: ${new Date().toISOString()}
        `;
        const testHtml = `
<p>This is a test email from <strong>Omnisuite ERP</strong>.</p>
<p>If you received this, email configuration is working correctly.</p>
<p>Timestamp: ${new Date().toISOString()}</p>
        `;

        console.log("[EMAIL_DIAGNOSE] Sending test email to " + userEmail);
        await sendMail({
          to: userEmail,
          subject: testSubject,
          text: testText,
          html: testHtml,
        });

        diagnosis.tests.send_email = {
          status: "PASS",
          message: "Test email sent to " + userEmail,
        };

        // Log success
        try {
          await query(
            `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
             VALUES (:companyId, :userId, 'EmailDiagnosis', 'TEST_SEND_SUCCESS', :message, '/api/email-test/diagnose')`,
            {
              companyId: req.scope.companyId,
              userId: req.user.sub,
              message: "Test email sent successfully to " + userEmail,
            },
          );
        } catch (logErr) {
          console.error(
            "[EMAIL_DIAGNOSE] Failed to log test:",
            logErr?.message,
          );
        }
      } catch (err) {
        diagnosis.tests.send_email = {
          status: "FAIL",
          error: err?.message,
          details: err?.toString(),
        };

        // Log failure
        try {
          await query(
            `INSERT INTO adm_system_logs (company_id, user_id, module_name, action, message, url_path)
             VALUES (:companyId, :userId, 'EmailDiagnosis', 'TEST_SEND_FAIL', :message, '/api/email-test/diagnose')`,
            {
              companyId: req.scope.companyId,
              userId: req.user.sub,
              message: "Test email failed: " + (err?.message || err),
            },
          );
        } catch (logErr) {
          console.error(
            "[EMAIL_DIAGNOSE] Failed to log error:",
            logErr?.message,
          );
        }
      }

      console.log("[EMAIL_DIAGNOSE] Diagnosis complete:", diagnosis);
      res.json(diagnosis);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Send a test email to a specific address
 * POST /email-test/send
 * Body: { to, subject, message }
 */
router.post(
  "/send",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { to, subject, message } = req.body;

      if (!to || !subject || !message) {
        throw httpError(
          400,
          "VALIDATION_ERROR",
          "Missing to, subject, or message",
        );
      }

      if (!isMailerConfigured()) {
        throw httpError(
          503,
          "SERVICE_UNAVAILABLE",
          "Email service not configured",
        );
      }

      await sendMail({
        to,
        subject,
        text: message,
        html: `<p>${message}</p>`,
      });

      res.json({ success: true, message: "Email sent to " + to });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Get current email configuration status
 * GET /email-test/status
 */
router.get("/status", requireAuth, async (req, res, next) => {
  try {
    res.json({
      configured: isMailerConfigured(),
      smtpHost: process.env.SMTP_HOST || "NOT SET",
      smtpPort: process.env.SMTP_PORT || "NOT SET",
      smtpSecure: process.env.SMTP_SECURE || "NOT SET",
      smtpFrom: process.env.SMTP_FROM || "NOT SET",
      hasAuth: !!process.env.SMTP_USER && !!process.env.SMTP_PASS,
    });
  } catch (err) {
    next(err);
  }
});

async function getUserEmail(userId) {
  if (!userId) return null;
  try {
    const rows = await query(
      "SELECT email FROM adm_users WHERE id = :userId LIMIT 1",
      { userId },
    );
    return rows.length ? rows[0].email : null;
  } catch {
    return null;
  }
}

export default router;
