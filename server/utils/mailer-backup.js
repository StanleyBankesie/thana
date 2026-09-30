import nodemailer from "nodemailer";

/**
 * Helper to convert various inputs to a boolean.
 * @param {*} v - The value to check.
 * @returns {boolean} True if the value is truthy/yes/1/true.
 */
function bool(v) {
  // Helper function to safely convert environment variable strings into booleans
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

// Load SMTP configuration from system environment variables
const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM || "";
const secure = bool(process.env.SMTP_SECURE || "false");

console.log(
  "[MAILER_INIT] Configuration loaded: host=" +
    host +
    ", port=" +
    port +
    ", secure=" +
    secure +
    ", from=" +
    from,
);

// Initialize state variables for the Nodemailer transporter connection
let transporter = null;
let configured = false;
let verified = false;

if (host && from) {
  // Attempt to instantiate the mail transporter if basic config is present
  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    configured = true;
    console.log("[MAILER_INIT] ✓ Nodemailer transporter created successfully");
  } catch (err) {
    transporter = null;
    configured = false;
    console.error(
      "[MAILER_INIT] ✗ Failed to create transporter:",
      err?.message,
    );
  }
} else {
  console.warn(
    "[MAILER_INIT] ⚠ Mailer not configured. Missing: " +
      (!host ? "SMTP_HOST " : "") +
      (!from ? "SMTP_FROM" : ""),
  );
}

/**
 * Check if the mailer has been configured successfully.
 * @returns {boolean} True if configured.
 */
export function isMailerConfigured() {
  // Retrieve current mailer configuration status
  return configured;
}

/**
 * Verify the SMTP connection.
 * @returns {Promise<boolean>} True if connection verified.
 */
export async function verifyMailer() {
  // Ping SMTP server to verify connection is active and valid
  if (!transporter) {
    verified = false;
    console.warn("[MAILER_VERIFY] No transporter available");
    return false;
  }
  try {
    await transporter.verify();
    verified = true;
    console.log("[MAILER_VERIFY] ✓ SMTP connection verified");
    return true;
  } catch (e) {
    verified = false;
    console.error("[MAILER_VERIFY] ✗ SMTP verification failed:", e?.message);
    return false;
  }
}

/**
 * Send an email using the configured transporter.
 * @param {Object} param0 - Mail options.
 * @param {string} param0.to - Recipient email.
 * @param {string} param0.subject - Email subject.
 * @param {string} [param0.text] - Plain text content.
 * @param {string} [param0.html] - HTML content.
 * @param {string} [param0.cc] - CC email addresses.
 * @returns {Promise<boolean>} True if email sent successfully.
 */
export async function sendMail({ to, subject, text, html, cc }) {
  // Execute mail sending using configured transporter settings
  if (!configured || !transporter) {
    console.warn(
      "[SENDMAIL] ✗ Mailer not configured. Cannot send to " +
        to +
        ". isConfigured=" +
        configured +
        ", hasTransporter=" +
        !!transporter,
    );
    return false;
  }

  try {
    console.log("[SENDMAIL] Attempting to send email to: " + to);
    const result = await transporter.sendMail({
      from,
      to,
      cc,
      subject,
      text,
      html,
    });
    console.log(
      "[SENDMAIL] ✓ Email sent successfully to " +
        to +
        ". MessageId: " +
        result.messageId,
    );
    return true;
  } catch (err) {
    console.error(
      "[SENDMAIL] ✗ Failed to send email to " + to + ": " + err?.message,
    );
    console.error("[SENDMAIL] Full error:", err);
    throw err;
  }
}
