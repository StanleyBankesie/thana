/**
 * @file smtp.js
 * @description Provides a reusable NodeMailer SMTP transporter for sending
 * workflow-related email notifications. Pulls configuration from environment variables.
 */

import nodemailer from "nodemailer";

let transporter = null;
let configured = false;

/**
 * Converts a string or boolean value to a strict boolean.
 * Handles common truthy string values like '1', 'true', 'yes', 'on'.
 * 
 * @param {string|boolean} v - The value to check.
 * @returns {boolean} True if the value is truthy, false otherwise.
 */
function bool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return false;
  const s = v.toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

/**
 * Initializes the SMTP mail transporter using environment variables.
 * Sets the 'configured' flag based on whether a valid host is provided.
 * 
 * @returns {boolean} True if successfully configured, false if missing host.
 */
export function initWorkflowMailer() {
  const host = process.env.SMTP_HOST || "";
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER || "";
  const pass = process.env.SMTP_PASS || "";
  const secure = bool(process.env.SMTP_SECURE || "false");
  if (!host) {
    configured = false;
    transporter = null;
    return false;
  }
  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
  configured = true;
  return true;
}

/**
 * Checks if the workflow mailer has been properly configured.
 * 
 * @returns {boolean} True if configured and ready to send, false otherwise.
 */
export function isWorkflowMailerConfigured() {
  return configured;
}

/**
 * Sends a workflow notification email using the configured SMTP transporter.
 * 
 * @param {Object} options - Email options.
 * @param {string} options.to - Recipient email address(es).
 * @param {string} options.subject - Subject line of the email.
 * @param {string} [options.text] - Plain text body.
 * @param {string} [options.html] - HTML formatted body.
 * @param {string} [options.cc] - CC email address(es).
 * @returns {Promise<boolean>} True if the email was sent and received a messageId, false otherwise.
 */
export async function sendWorkflowEmail({ to, subject, text, html, cc }) {
  if (!configured || !transporter) {
    return false;
  }
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "";
  const info = await transporter.sendMail({ from, to, cc, subject, text, html });
  return !!info?.messageId;
}

