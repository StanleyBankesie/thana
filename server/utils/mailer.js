/**
 * @file mailer.js
 * @description Utility for sending emails using Nodemailer with support for queues and attachments.
 */
import nodemailer from "nodemailer";
import { query } from "../db/pool.js";
import { ensureSystemLogsTable } from "./dbUtils.js";

function bool(v) {
  // Helper function to cast truthy environment variables into true booleans
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.toLowerCase();
  return s === "1" || s === "true" || s === "yes";
}

// Read core SMTP settings from system environment variables
const host = process.env.SMTP_HOST || "";
const port = Number(process.env.SMTP_PORT || 587);
const user = process.env.SMTP_USER || "";
const pass = process.env.SMTP_PASS || "";
const from = process.env.SMTP_FROM || "";
const secure = bool(process.env.SMTP_SECURE || "false");

// Hold Nodemailer instance and connection status in local memory
let transporter = null;
let configured = false;
let verified = false;

if (host && from) {
  // Create the NodeMailer transport object if minimal parameters exist
  try {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
    });
    configured = true;
  } catch {
    transporter = null;
    configured = false;
  }
}

export function isMailerConfigured() {
  // Simple getter to check if the transporter was successfully created
  return configured;
}

export async function verifyMailer() {
  // Validate actual SMTP connectivity to the mail server
  if (!transporter) {
    verified = false;
    return false;
  }
  try {
    await transporter.verify();
    verified = true;
    return true;
  } catch (e) {
    verified = false;
    console.error("Mailer verify failed:", e);
    return false;
  }
}

/**
 * Sends an email or queues it depending on the mailer configuration.
 *
 * @param {Object} params - Email parameters.
 * @param {string} params.to - Recipient email address(es).
 * @param {string} params.subject - Email subject.
 * @param {string} [params.text] - Plain text email content.
 * @param {string} [params.html] - HTML email content.
 * @param {string} [params.cc] - CC email address(es).
 * @param {Array} [params.attachments] - Email attachments.
 * @param {Object} [params.meta] - Additional metadata for the email.
 * @returns {Promise<any>} The result of the mail sending operation.
 */
export async function sendMail({ to, subject, text, html, cc, attachments, meta }) {
  // Orchestrate email transmission or mock queueing based on config
  if (!configured || !transporter) {
    console.warn(
      "[SENDMAIL] Mailer not configured. Host:",
      host,
      "From:",
      from,
    );
    const m = meta || {};
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const ref_no = m.refNo || null;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, 'EMAIL_MOCK', :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            ref_no,
            message:
              m.message ||
              `Mailer not configured; email not sent to ${Array.isArray(to) ? to.join(",") : to || "(unknown)"}`,
            url_path,
          },
        );
      } catch {}
    }
    return false;
  }
  try {
    // Perform actual mail transmission via initialized transporter
    const result = await transporter.sendMail({
      from,
      to,
      cc,
      subject,
      text,
      html,
      attachments,
    });
    console.log(
      `[SENDMAIL] Email sent successfully to ${to}. MessageId: ${result.messageId}`,
    );
    const m = meta || {};
    // Record successful email delivery in the administrative logs
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const action = m.action || "EMAIL_SENT";
        const ref_no = m.refNo || null;
        const message =
          m.message || `Email sent to ${Array.isArray(to) ? to.join(",") : to}`;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, :action, :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            action,
            ref_no,
            message,
            url_path,
          },
        );
      } catch {}
    }
    return true;
  } catch (err) {
    console.error(
      `[SENDMAIL] Failed to send email to ${to}:`,
      err.message,
      err,
    );
    const m = meta || {};
    // Record failed email delivery attempt in administrative logs
    if (!m.suppressLog) {
      try {
        await ensureSystemLogsTable();
        const moduleName = m.moduleName || "Email";
        const ref_no = m.refNo || null;
        const url_path = m.urlPath || null;
        await query(
          `INSERT INTO adm_system_logs (company_id, branch_id, user_id, module_name, action, ref_no, message, url_path)
           VALUES (:company_id, :branch_id, :user_id, :module_name, 'EMAIL_ERROR', :ref_no, :message, :url_path)`,
          {
            company_id: Number(m.companyId) || null,
            branch_id: Number(m.branchId) || null,
            user_id: Number(m.userId) || null,
            module_name: moduleName,
            ref_no,
            message: `Email error: ${err?.message || err}`,
            url_path,
          },
        );
      } catch {}
    }
    throw err;
  }
}
