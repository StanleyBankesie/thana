/**
 * @file set_admin_password.js
 * @description Utility script to manually reset the admin user's password.
 * Uses bcrypt to securely hash the new password and updates the database
 * for the 'admin' user account.
 */

// Security and Database Dependencies
import bcrypt from "bcryptjs";
import { query } from "../db/pool.js";

/**
 * Main execution function.
 * Fetches the user record for 'admin', hashes the default target password,
 * and updates the database record. Will exit with code 2 if the user doesn't exist.
 * 
 * @returns {Promise<void>} Resolves when the password reset is complete.
 */
async function main() {
  // Default Admin Credentials
  const username = "admin";
  const newPassword = "admin";
  try {
    // Fetch target user details from database
    const rows = await query(
      `SELECT id, is_active FROM adm_users WHERE username = :username LIMIT 1`,
      { username },
    );
    if (!rows.length) {
      console.error(
        `User '${username}' not found in adm_users. Create the user first, then run this script again.`,
      );
      process.exit(2);
    }
    // Generate bcrypt hash for the new password
    const user = rows[0];
    const hash = await bcrypt.hash(newPassword, 10);
    // Update user record with hashed password and set as active
    await query(
      `UPDATE adm_users SET password_hash = :hash, is_active = 1 WHERE id = :id`,
      { hash, id: user.id },
    );
    console.log(`Password reset for '${username}' completed (bcrypt-hashed).`);
    process.exit(0);
  } catch (err) {
    console.error("Failed to set admin password:", err);
    process.exit(1);
  }
}

main();

