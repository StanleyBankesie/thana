/**
 * @fileoverview Push notification routes.
 * Provides endpoints for managing web push subscriptions and sending notifications.
 */
import express from "express";
import webpush from "web-push";
import { query } from "../db/pool.js";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { ensurePushTables } from "../utils/dbUtils.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

let VAPID_PUBLIC_KEY = String(process.env.VAPID_PUBLIC_KEY || "");
let VAPID_PRIVATE_KEY = String(process.env.VAPID_PRIVATE_KEY || "");
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  const keys = webpush.generateVAPIDKeys();
  VAPID_PUBLIC_KEY = keys.publicKey;
  VAPID_PRIVATE_KEY = keys.privateKey;
}
const CONTACT = process.env.VAPID_CONTACT || "mailto:admin@localhost";
webpush.setVapidDetails(CONTACT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

try {
  await ensurePushTables();
} catch {}

// Utility function to get the VAPID public key
// Used by the client-side code to subscribe to push notifications.
export function getPublicKey() {
  return VAPID_PUBLIC_KEY;
}

// Utility function to send a push notification to a specific user.
// Iterates through their active subscriptions and uses web-push to send the payload in parallel.
export async function sendPushToUser(userId, payload) {
  try {
    const subs = await query(
      `SELECT endpoint, p256dh, auth
       FROM adm_push_subscriptions
       WHERE user_id = :userId AND is_active = 1 
       ORDER BY last_active_at DESC, created_at DESC 
       LIMIT 10`,
      { userId },
    );
    if (!Array.isArray(subs) || subs.length === 0) return;
    const body = typeof payload === "string" ? payload : JSON.stringify(payload);
    await Promise.allSettled(
      subs.map(async (s) => {
        try {
          const subscription = {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          };
          const sendPromise = webpush.sendNotification(subscription, body, { TTL: 60 });
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Push timeout")), 3000),
          );
          await Promise.race([sendPromise, timeoutPromise]);
          await query(
            `UPDATE adm_push_subscriptions SET last_active_at = NOW() WHERE endpoint = :endpoint`,
            { endpoint: s.endpoint },
          );
        } catch (e) {
          const msg = String(e?.message || "");
          if (msg.includes("410") || msg.includes("404")) {
            await query(
              `UPDATE adm_push_subscriptions SET is_active = 0 WHERE endpoint = :endpoint`,
              { endpoint: s.endpoint },
            );
          }
        }
      }),
    );
  } catch (err) {
    // Non-blocking catch
  }
}

// GET /public-key
// Returns the VAPID public key to authenticated clients.
router.get("/public-key", requireAuth, async (req, res, next) => {
  try {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
  } catch (err) {
    next(err);
  }
});

// POST /subscribe
// Saves a new push subscription object (endpoint, keys) to the database for the current user.
router.post(
  "/subscribe",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePushTables();
      const sub = req.body?.subscription || req.body || {};
      const endpoint = String(sub?.endpoint || "");
      const p256dh = String(sub?.keys?.p256dh || "");
      const auth = String(sub?.keys?.auth || "");
      if (!endpoint || !p256dh || !auth) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid subscription");
      }
      const { companyId, branchId, branchIdsStr = '' } = req.scope;
      const userId =
        Number(req.user?.sub) ||
        Number(req.user?.id) ||
        Number(req.headers["x-user-id"]);
      await query(`INSERT INTO adm_push_subscriptions (company_id, branch_id, user_id, endpoint, p256dh, auth, is_active)
         VALUES (:companyId, :branchId, :userId, :endpoint, :p256dh, :auth, 1)
         ON DUPLICATE KEY UPDATE 
           company_id = VALUES(company_id),
           branch_id = VALUES(branch_id),
           user_id = VALUES(user_id),
           p256dh = VALUES(p256dh),
           auth = VALUES(auth),
           is_active = 1,
           last_active_at = NOW()`,
        { companyId, branchId, userId, endpoint, p256dh, auth },
      );
      res.status(201).json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// DELETE /unsubscribe
// Deactivates an existing push subscription by matching the endpoint URL.
router.delete("/unsubscribe", requireAuth, async (req, res, next) => {
  try {
    await ensurePushTables();
    const sub = req.body?.subscription || req.body || {};
    const endpoint = String(sub?.endpoint || "");
    if (!endpoint) throw httpError(400, "VALIDATION_ERROR", "Invalid endpoint");
    await query(`UPDATE adm_push_subscriptions SET is_active = 0 WHERE endpoint = :endpoint`,
      { endpoint },
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /send-test
// Triggers a test push notification to the currently authenticated user.
router.post("/send-test", requireAuth, async (req, res, next) => {
  try {
    const userId =
      Number(req.user?.sub) ||
      Number(req.user?.id) ||
      Number(req.headers["x-user-id"]);
    const payload = {
      title: "Test Push",
      message: "This is a test push notification",
      link: "/notifications",
    };
    await sendPushToUser(userId, payload);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
