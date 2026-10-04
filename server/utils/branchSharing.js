import { query } from "../db/pool.js";

/**
 * Check if a branch data sharing setting is enabled for a given company.
 * @param {number|null} companyId
 * @param {'BRANCH_SHARE_CUSTOMERS'|'BRANCH_SHARE_SUPPLIERS'|'BRANCH_SHARE_ITEMS'} settingKey
 * @param {boolean} defaultValue Default is false (isolated per branch)
 * @returns {Promise<boolean>} True if shared across branches, false if isolated per branch
 */
export async function isBranchSharingEnabled(companyId, settingKey, defaultValue = false) {
  try {
    const rows = await query(
      `SELECT setting_value 
       FROM adm_system_settings 
       WHERE (company_id = :companyId OR company_id IS NULL) 
         AND setting_key = :settingKey 
       ORDER BY company_id DESC LIMIT 1`,
      { companyId: companyId ?? null, settingKey }
    );
    if (!rows || rows.length === 0) return defaultValue;
    const val = String(rows[0].setting_value ?? "").trim().toLowerCase();
    return val === "1" || val === "true";
  } catch (err) {
    console.error(`[BranchSharing] Error checking ${settingKey}:`, err?.message || err);
    return defaultValue;
  }
}
