/**
 * @fileoverview Banks AI Chat History Retention & Deletion Service.
 * Provides automated background pruning based on system settings and explicit deletion.
 */

import { query } from "../../db/pool.js";

const SETTING_KEY_RETENTION = "ai_chat_retention_days";
const DEFAULT_RETENTION_DAYS = 30; // Default to 30 days if not set

/**
 * Retrieves the configured retention policy in days from adm_system_settings.
 * Returns 0 if retention is disabled (infinite retention).
 *
 * @returns {Promise<number>} Number of retention days.
 */
export async function getChatRetentionDays() {
  try {
    const rows = await query(
      `SELECT setting_value 
       FROM adm_system_settings 
       WHERE setting_key = :key 
       ORDER BY id DESC LIMIT 1`,
      { key: SETTING_KEY_RETENTION }
    );

    if (rows && rows.length > 0 && rows[0].setting_value !== null && rows[0].setting_value !== undefined) {
      const parsed = parseInt(rows[0].setting_value, 10);
      return isNaN(parsed) ? DEFAULT_RETENTION_DAYS : Math.max(0, parsed);
    }
  } catch (err) {
    console.warn("[Banks AI History] Failed to load retention days:", err.message);
  }
  return DEFAULT_RETENTION_DAYS;
}

/**
 * Persists the chat retention policy in days to adm_system_settings.
 *
 * @param {number|string} days - Number of days to retain messages.
 * @returns {Promise<number>} Saved days.
 */
export async function setChatRetentionDays(days) {
  const cleanDays = Math.max(0, parseInt(days, 10) || 0);
  try {
    await query(
      `DELETE FROM adm_system_settings WHERE setting_key = :key`,
      { key: SETTING_KEY_RETENTION }
    ).catch(() => {});

    await query(
      `INSERT INTO adm_system_settings (company_id, setting_key, setting_value)
       VALUES (1, :key, :val)`,
      { key: SETTING_KEY_RETENTION, val: String(cleanDays) }
    );

    return cleanDays;
  } catch (err) {
    console.error("[Banks AI History] Failed to save retention days:", err);
    throw err;
  }
}

/**
 * Automatically deletes chat history records older than the configured retention period.
 * If retentionDays <= 0, no deletion is performed (retention disabled).
 *
 * @param {number} [customDays=null] - Optional override for retention days.
 * @returns {Promise<{success: boolean, purgedCount: number, retentionDays: number, reason?: string}>}
 */
export async function cleanupExpiredAiChatHistory(customDays = null) {
  try {
    const retentionDays = customDays !== null && customDays !== undefined
      ? Math.max(0, parseInt(customDays, 10) || 0)
      : await getChatRetentionDays();

    if (!retentionDays || retentionDays <= 0) {
      return {
        success: true,
        purgedCount: 0,
        retentionDays: 0,
        reason: "Retention disabled (0 days)",
      };
    }

    const result = await query(
      `DELETE FROM adm_ai_chat_history 
       WHERE created_at < DATE_SUB(NOW(), INTERVAL :days DAY)`,
      { days: retentionDays }
    );

    const affected = Number(result?.affectedRows || result?.rowCount || 0);
    if (affected > 0) {
      console.log(`[Banks AI History] Cleaned up ${affected} expired chat message(s) older than ${retentionDays} day(s).`);
    }

    return {
      success: true,
      purgedCount: affected,
      retentionDays,
    };
  } catch (err) {
    console.error("[Banks AI History] Auto-cleanup error:", err.message);
    return {
      success: false,
      purgedCount: 0,
      retentionDays: customDays || 0,
      error: err.message,
    };
  }
}

/**
 * Fetches database statistics for AI chat history.
 *
 * @returns {Promise<{totalMessages: number, oldestMessage: string|null, newestMessage: string|null, retentionDays: number}>}
 */
export async function getChatHistoryStats() {
  try {
    const [countRow] = await query(`SELECT COUNT(*) as total FROM adm_ai_chat_history`).catch(() => [{ total: 0 }]);
    const [rangeRow] = await query(`SELECT MIN(created_at) as oldest, MAX(created_at) as newest FROM adm_ai_chat_history`).catch(() => [{}]);
    const retentionDays = await getChatRetentionDays();

    return {
      totalMessages: Number(countRow?.total || 0),
      oldestMessage: rangeRow?.oldest || null,
      newestMessage: rangeRow?.newest || null,
      retentionDays,
    };
  } catch (err) {
    return {
      totalMessages: 0,
      oldestMessage: null,
      newestMessage: null,
      retentionDays: DEFAULT_RETENTION_DAYS,
    };
  }
}

/**
 * Deletes chat history. If userId is provided, deletes only that user's history.
 * If userId is null, deletes all chat history (admin purge).
 *
 * @param {object} options
 * @param {number|null} [options.userId]
 * @param {number|null} [options.companyId]
 * @returns {Promise<{success: boolean, deletedCount: number}>}
 */
export async function deleteAiChatHistory({ userId = null, companyId = null } = {}) {
  try {
    let sql = `DELETE FROM adm_ai_chat_history`;
    const params = {};
    const conditions = [];

    if (userId) {
      conditions.push(`user_id = :userId`);
      params.userId = userId;
    }
    if (companyId) {
      conditions.push(`company_id = :companyId`);
      params.companyId = companyId;
    }

    if (conditions.length > 0) {
      sql += ` WHERE ` + conditions.join(" AND ");
    }

    const res = await query(sql, params);
    const deletedCount = Number(res?.affectedRows || res?.rowCount || 0);

    return {
      success: true,
      deletedCount,
    };
  } catch (err) {
    console.error("[Banks AI History] Delete error:", err);
    throw err;
  }
}
