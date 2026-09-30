#!/usr/bin/env node

/**
 * Email Configuration Test Script
 *
 * Standalone script to test SMTP configuration without running the full server
 * Usage: node server/scripts/test-email-config.js
 */

import dotenv from "dotenv";
import nodemailer from "nodemailer";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Environment File Resolution
// Try to load from .env.production first, then .env (both in server directory)
let envPath = path.resolve(__dirname, "../.env.production");
let envFile = ".env.production";

if (!fs.existsSync(envPath)) {
  envPath = path.resolve(__dirname, "../.env");
  envFile = ".env";
}

// Load environment variables
dotenv.config({ path: envPath });

console.log("\n========== EMAIL CONFIGURATION TEST ==========\n");
console.log(`Loading configuration from: server/${envFile}\n`);

// 1. Check environment variables
console.log("1. CHECKING ENVIRONMENT VARIABLES");
console.log("   " + "=".repeat(40));

// Required SMTP Configuration Keys
const required = [
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_USER",
  "SMTP_PASS",
  "SMTP_FROM",
];

// State to hold valid SMTP configuration
const smtpConfig = {};
let configValid = true;

// Validate each required environment variable
required.forEach((key) => {
  const value = process.env[key];
  if (!value) {
    console.log(`   ✗ ${key}: NOT SET`);
    configValid = false;
  } else {
    const display = key === "SMTP_PASS" ? "***hidden***" : value;
    console.log(`   ✓ ${key}: ${display}`);
    smtpConfig[key] = value;
  }
});

const smtpSecure = process.env.SMTP_SECURE === "true";
console.log(`   ✓ SMTP_SECURE: ${smtpSecure}`);
smtpConfig.SMTP_SECURE = smtpSecure;

console.log("\n2. CONFIGURATION SUMMARY");
console.log("   " + "=".repeat(40));
console.log(`   Host:   ${smtpConfig.SMTP_HOST || "NOT SET"}`);
console.log(`   Port:   ${smtpConfig.SMTP_PORT || "NOT SET"}`);
console.log(`   Secure: ${smtpConfig.SMTP_SECURE}`);
console.log(`   User:   ${smtpConfig.SMTP_USER || "NOT SET"}`);
console.log(`   From:   ${smtpConfig.SMTP_FROM || "NOT SET"}`);

if (!configValid) {
  console.log(
    "\n✗ CONFIGURATION INVALID - Missing required environment variables",
  );
  process.exit(1);
}

console.log("\n3. CREATING NODEMAILER TRANSPORTER");
console.log("   " + "=".repeat(40));

let transporter;
try {
  transporter = nodemailer.createTransport({
    host: smtpConfig.SMTP_HOST,
    port: parseInt(smtpConfig.SMTP_PORT),
    secure: smtpConfig.SMTP_SECURE,
    auth: {
      user: smtpConfig.SMTP_USER,
      pass: smtpConfig.SMTP_PASS,
    },
  });
  console.log("   ✓ Transporter created successfully");
} catch (err) {
  console.log(`   ✗ Failed to create transporter: ${err.message}`);
  process.exit(1);
}

console.log("\n4. VERIFYING SMTP CONNECTION");
console.log("   " + "=".repeat(40));

transporter.verify((err, success) => {
  if (err) {
    console.log(`   ✗ SMTP verification failed:`);
    console.log(`      Error: ${err.message}`);
    console.log(`      Code: ${err.code}`);
    if (err.code === "ECONNREFUSED") {
      console.log(
        `      → Cannot connect to ${smtpConfig.SMTP_HOST}:${smtpConfig.SMTP_PORT}`,
      );
      console.log(
        `      → Check: Network connectivity, firewall, SMTP host/port`,
      );
    }
    if (err.responseCode === 535) {
      console.log(`      → SMTP authentication failed (incorrect credentials)`);
    }
    process.exit(1);
  }

  if (success) {
    console.log("   ✓ SMTP connection verified successfully");
    console.log(`   ✓ Server is ready to accept messages`);
  }

  console.log("\n5. SENDING TEST EMAIL");
  console.log("   " + "=".repeat(40));

  // Define Test Email Parameters
  const testEmail = smtpConfig.SMTP_USER; // Send to self

  const mailOptions = {
    from: smtpConfig.SMTP_FROM,
    to: testEmail,
    subject: "✓ Omnisuite ERP - Email Configuration Test",
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #2c3e50;">✓ Email Configuration Working!</h2>
          <p>This is a test email from your Omnisuite ERP system.</p>
          <p><strong>Configuration Details:</strong></p>
          <ul>
            <li>SMTP Host: ${smtpConfig.SMTP_HOST}</li>
            <li>SMTP Port: ${smtpConfig.SMTP_PORT}</li>
            <li>Secure (TLS/SSL): ${smtpConfig.SMTP_SECURE}</li>
            <li>From: ${smtpConfig.SMTP_FROM}</li>
            <li>Sent at: ${new Date().toLocaleString()}</li>
          </ul>
          <p>If you received this email, your SMTP configuration is working correctly!</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">
            Document Forwarding Email Notifications are now enabled.
          </p>
        </body>
      </html>
    `,
    text: `
Email Configuration Test Successful!

This is a test email from your Omnisuite ERP system.

Configuration Details:
- SMTP Host: ${smtpConfig.SMTP_HOST}
- SMTP Port: ${smtpConfig.SMTP_PORT}
- Secure: ${smtpConfig.SMTP_SECURE}
- From: ${smtpConfig.SMTP_FROM}
- Sent at: ${new Date().toLocaleString()}

If you received this email, your SMTP configuration is working correctly!
Document Forwarding Email Notifications are now enabled.
    `,
  };

  console.log(`   Sending test email to: ${testEmail}`);
  console.log(`   Subject: ${mailOptions.subject}`);

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.log(`\n   ✗ Failed to send test email:`);
      console.log(`      Error: ${err.message}`);
      console.log(`      Code: ${err.code}`);

      if (err.message.includes("Invalid login")) {
        console.log(`      → Invalid SMTP credentials`);
        console.log(`      → Check: SMTP_USER and SMTP_PASS`);
      }
      if (err.message.includes("5.7.1")) {
        console.log(`      → SMTP authentication issue`);
        console.log(
          `      → You may need to: Allow SMTP in email provider settings, Use an app-specific password, Enable "Less Secure Apps"`,
        );
      }

      process.exit(1);
    }

    console.log(`\n   ✓ Test email sent successfully!`);
    console.log(`      Message ID: ${info.messageId}`);
    console.log(`      Response: ${info.response}`);

    console.log("\n========== ✓ ALL TESTS PASSED ==========");
    console.log("\nEmail configuration is working correctly!");
    console.log("Document forwarding notifications should now send emails.\n");

    process.exit(0);
  });
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log("\n✗ Test timed out after 30 seconds");
  console.log("SMTP connection may be hanging. Check:");
  console.log("  - Network connectivity");
  console.log("  - Firewall rules");
  console.log("  - SMTP host is reachable");
  process.exit(1);
}, 30000);
