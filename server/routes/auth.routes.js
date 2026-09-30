import express from "express";
import { query } from "../db/pool.js";
import {
  login,
  logout,
  refreshAccessToken,
  requestPasswordResetOtp,
  resetPasswordWithOtp,
  getCurrentUser,
  updateCurrentUserPhoto,
  changePassword,
  getMyBranches,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// User Login Endpoint
router.post("/login", (req, res, next) => login(req, res, next));
// Token Refresh Endpoint
router.post("/auth/refresh", (req, res, next) => refreshAccessToken(req, res, next));
// User Logout Endpoint
router.post("/auth/logout", (req, res, next) => logout(req, res, next));
// Get Current Authenticated User Information
router.get("/auth/me", requireAuth, (req, res, next) => getCurrentUser(req, res, next));
// Update Current User Profile Photo
router.put("/auth/me/photo", requireAuth, (req, res, next) => updateCurrentUserPhoto(req, res, next));

// Change User Password Endpoint
router.post("/auth/change-password", requireAuth, (req, res, next) =>
  changePassword(req, res, next),
);

// Fetch Branches Assigned to Current User
router.get("/auth/user-branches", requireAuth, (req, res, next) =>
  getMyBranches(req, res, next),
);

// Request Password Reset OTP Endpoint
router.post("/forgot-password/request-otp", (req, res, next) =>
  requestPasswordResetOtp(req, res, next),
);

// Reset Password using OTP Endpoint
router.post("/forgot-password/reset", (req, res, next) =>
  resetPasswordWithOtp(req, res, next),
);


router.get("/public/upcoming-events", async (req, res, next) => {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`key\` VARCHAR(100) NOT NULL UNIQUE,
        value LONGTEXT NULL,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `).catch(() => {});
    // Announcements
    const annRows = await query("SELECT value FROM app_settings WHERE `key` = 'upcoming_announcements' LIMIT 1").catch(() => []);
    let announcements = [];
    if (annRows[0]?.value) {
      try {
        const parsed = JSON.parse(annRows[0].value);
        if (Array.isArray(parsed)) {
          announcements = parsed.filter(Boolean);
        } else {
          announcements = [annRows[0].value];
        }
      } catch (e) {
        announcements = [annRows[0].value];
      }
    }

    // Birthdays
    const bdRows = await query(`
      SELECT full_name, DATE_FORMAT(date_of_birth, '%m-%d') as celebration_date 
      FROM hr_employees 
      WHERE date_of_birth IS NOT NULL 
        AND deleted_at IS NULL 
        AND is_active = 1
        AND (
          (MONTH(date_of_birth) = MONTH(CURDATE()) AND DAY(date_of_birth) >= DAY(CURDATE()) AND DAY(date_of_birth) <= DAY(CURDATE() + INTERVAL 7 DAY))
          OR
          (MONTH(CURDATE()) <> MONTH(CURDATE() + INTERVAL 7 DAY) AND MONTH(date_of_birth) = MONTH(CURDATE() + INTERVAL 7 DAY) AND DAY(date_of_birth) <= DAY(CURDATE() + INTERVAL 7 DAY))
        )
      ORDER BY MONTH(date_of_birth), DAY(date_of_birth)
    `).catch(() => []);

    // Anniversaries
    const anRows = await query(`
      SELECT full_name, DATE_FORMAT(joining_date, '%m-%d') as celebration_date 
      FROM hr_employees 
      WHERE joining_date IS NOT NULL 
        AND deleted_at IS NULL 
        AND is_active = 1
        AND (
          (MONTH(joining_date) = MONTH(CURDATE()) AND DAY(joining_date) >= DAY(CURDATE()) AND DAY(joining_date) <= DAY(CURDATE() + INTERVAL 7 DAY))
          OR
          (MONTH(CURDATE()) <> MONTH(CURDATE() + INTERVAL 7 DAY) AND MONTH(joining_date) = MONTH(CURDATE() + INTERVAL 7 DAY) AND DAY(joining_date) <= DAY(CURDATE() + INTERVAL 7 DAY))
        )
      ORDER BY MONTH(joining_date), DAY(joining_date)
    `).catch(() => []);

    res.json({ announcements, birthdays: bdRows, anniversaries: anRows });
  } catch (err) {
    res.json({ announcements: [], birthdays: [], anniversaries: [] });
  }
});

export default router;
