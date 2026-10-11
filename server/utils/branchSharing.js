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

/**
 * Check if a branch data isolation setting is enabled for a given company.
 * @param {number|null} companyId
 * @param {'BRANCH_ISOLATE_REPORTS'|'BRANCH_ISOLATE_EXEC_OVERVIEW'|'BRANCH_ISOLATE_BI'} settingKey
 * @param {boolean} defaultValue Default is false
 * @returns {Promise<boolean>} True if reports/dashboards must isolate to user branch
 */
export async function isBranchIsolationEnabled(companyId, settingKey, defaultValue = false) {
  try {
    let altKey = null;
    if (settingKey.startsWith("BRANCH_ISOLATE_")) {
      altKey = settingKey.replace("BRANCH_ISOLATE_", "BRANCH_SHARE_");
    } else if (settingKey.startsWith("BRANCH_SHARE_")) {
      altKey = settingKey.replace("BRANCH_SHARE_", "BRANCH_ISOLATE_");
    }

    const rows = await query(
      `SELECT setting_key, setting_value 
       FROM adm_system_settings 
       WHERE (company_id = :companyId OR company_id IS NULL) 
         AND setting_key IN (:settingKey, :altKey) 
       ORDER BY company_id DESC`,
      { companyId: companyId ?? null, settingKey, altKey: altKey || settingKey }
    );
    if (!rows || rows.length === 0) return defaultValue;

    const primRow = rows.find(r => r.setting_key === settingKey);
    if (primRow) {
      const val = String(primRow.setting_value ?? "").trim().toLowerCase();
      return val === "1" || val === "true";
    }

    const altRow = rows.find(r => r.setting_key === altKey);
    if (altRow) {
      const val = String(altRow.setting_value ?? "").trim().toLowerCase();
      const isShare = val === "1" || val === "true";
      return !isShare;
    }

    return defaultValue;
  } catch (err) {
    console.error(`[BranchIsolation] Error checking ${settingKey}:`, err?.message || err);
    return defaultValue;
  }
}
