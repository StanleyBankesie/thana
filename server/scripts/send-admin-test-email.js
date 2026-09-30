#!/usr/bin/env node

/**
 * Send Direct Test Email to Admin User
 * Tests if stanleyetornam@gmail.com is the correct email address
 */

import nodemailer from "nodemailer";
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

console.log("\n========== DIRECT TEST EMAIL TO ADMIN ==========\n");

const config = {
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
};

const from = process.env.SMTP_FROM;
const to = "stanleyetornam@gmail.com";

console.log("Configuration:");
console.log(`  From: ${from}`);
console.log(`  To: ${to}`);
console.log(`  SMTP Host: ${config.host}:${config.port}`);
console.log(`  Secure: ${config.secure}\n`);

let transporter = null;

try {
  console.log("1. Creating transporter...");
  transporter = nodemailer.createTransport(config);
  console.log("   ✓ Transporter created\n");
} catch (err) {
  console.error("   ✗ Failed to create transporter:", err.message);
  process.exit(1);
}

console.log("2. Verifying SMTP connection...");
transporter.verify((err, success) => {
  if (err) {
    console.error("   ✗ SMTP verification failed:", err.message);
    process.exit(1);
  }

  if (success) {
    console.log("   ✓ SMTP connection verified\n");
  }

  console.log("3. Sending test email...");

  const mailOptions = {
    from,
    to,
    subject: "✓ Omnisuite ERP - Direct Admin Test Email",
    html: `
      <html>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #0066cc;">✓ Email Delivery Test - SUCCESS!</h2>
          
          <p>This is a direct test email sent to verify that <strong>${to}</strong> is the correct email address for the admin user.</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3>Test Details:</h3>
            <ul>
              <li><strong>Test Date:</strong> ${new Date().toLocaleString()}</li>
              <li><strong>Email System:</strong> Omnisuite ERP</li>
              <li><strong>Sender:</strong> ${from}</li>
              <li><strong>Recipient:</strong> ${to}</li>
              <li><strong>Test Type:</strong> Direct Admin Verification</li>
            </ul>
          </div>
          
          <p>If you received this email, the email system is working correctly!</p>
          
          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            This is an automated test message. You may delete this email safely.
          </p>
        </body>
      </html>
    `,
    text: `
Omnisuite ERP - Email System Test

This is a direct test email to verify that ${to} is the correct email address.

Test Date: ${new Date().toLocaleString()}
Email System: Omnisuite ERP
Sender: ${from}
Recipient: ${to}

If you received this email, the email system is working correctly!

This is an automated test message. You may delete this email safely.
    `,
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      console.error("   ✗ Failed to send email:", err.message);
      console.error("\n   Full error:", err);
      process.exit(1);
    }

    console.log("   ✓ Email sent successfully!\n");
    console.log("Email Details:");
    console.log(`  Message ID: ${info.messageId}`);
    console.log(`  Response: ${info.response}`);
    console.log(`  Time Sent: ${new Date().toLocaleString()}\n`);

    console.log("========== TEST SUCCESSFUL ==========\n");
    console.log("✓ Email was sent to: stanleyetornam@gmail.com\n");
    console.log("Next steps:");
    console.log("  1. Check your Gmail inbox (wait 1-2 seconds for delivery)");
    console.log("  2. If not in inbox, check Spam/Promotions folder");
    console.log("  3. Open the email from: Omnisuite ERP");
    console.log("  4. Subject: ✓ Omnisuite ERP - Direct Admin Test Email\n");
    console.log("If email received → Email address is CORRECT ✓");
    console.log(
      "If email NOT received → Issue with Gmail access or filtering\n",
    );

    process.exit(0);
  });
});

// Timeout after 30 seconds
setTimeout(() => {
  console.error("\n✗ Test timed out after 30 seconds");
  process.exit(1);
}, 30000);
