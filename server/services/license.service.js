import { query } from "../db/pool.js";
import { cacheGet, cacheSet, cacheDel } from "../utils/redis.js";
import crypto from "crypto";

const CACHE_TTL_SECONDS = 3600; // 1 hour

// In-memory fallback cache for when Redis is not configured.
// Prevents 2+ DB queries per request from the license middleware.
const memCache = new Map();
const MEM_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function memCacheGet(key) {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memCache.delete(key);
    return null;
  }
  return entry.value;
}

function memCacheSet(key, value, ttlMs = MEM_CACHE_TTL_MS) {
  memCache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function memCacheDel(key) {
  memCache.delete(key);
}

/**
 * Generate a standard ERP license key
 */
export function generateLicenseKey() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    parts.push(crypto.randomBytes(2).toString('hex').toUpperCase());
  }
  return `OMNI-${parts.join('-')}`;
}

/**
 * Get full license data from cache or DB
 */
export async function getCompanyLicense(companyId) {
  const cacheKey = `omnisuite:license:${companyId}`;

  // 1. Try Redis
  let licenseData = await cacheGet(cacheKey).catch(() => null);

  // 2. Fall back to in-memory cache (used when Redis is not configured)
  if (!licenseData) {
    licenseData = memCacheGet(cacheKey);
  }

  if (!licenseData) {
    const licenses = await query(
      `SELECT * FROM adm_company_licenses WHERE company_id = ? ORDER BY id DESC LIMIT 1`,
      [companyId]
    );

    if (!licenses || licenses.length === 0) {
      licenseData = { exists: false };
    } else {
      const license = licenses[0];
      const modules = await query(
        `SELECT module_code FROM adm_license_modules WHERE license_id = ?`,
        [license.id]
      );

      licenseData = {
        exists: true,
        ...license,
        modules: modules.map(m => m.module_code)
      };
    }

    // Write to both Redis and in-memory cache
    cacheSet(cacheKey, licenseData, CACHE_TTL_SECONDS).catch(() => {});
    memCacheSet(cacheKey, licenseData);
  }

  return licenseData;
}

/**
 * Clear license cache
 */
export async function invalidateLicenseCache(companyId) {
  const cacheKey = `omnisuite:license:${companyId}`;
  await cacheDel(cacheKey).catch(() => {});
  memCacheDel(cacheKey);
}

/**
 * Validate company license status, expiry, and grace period
 */
export async function validateCompanyLicense(companyId) {
  const companyCacheKey = `omnisuite:company_active:${companyId}`;
  let isActive = memCacheGet(companyCacheKey);
  if (isActive === null) {
    const companies = await query(
      `SELECT is_active FROM adm_companies WHERE id = ? LIMIT 1`,
      [companyId]
    );
    isActive = (companies && companies.length > 0) ? companies[0].is_active : 0;
    memCacheSet(companyCacheKey, isActive, 2 * 60 * 1000); // 2 minute cache
  }

  if (isActive !== 1) {
    return { valid: false, reason: "Company is inactive or does not exist." };
  }

  const license = await getCompanyLicense(companyId);

  if (!license || !license.exists) {
    return { valid: false, reason: "No license found." };
  }

  if (license.status !== 'ACTIVE' && license.status !== 'INACTIVE') {
    return { valid: false, reason: `License status is ${license.status}.` };
  }

  const now = new Date();
  const startDate = new Date(license.start_date);
  const expiryDate = new Date(license.expiry_date);
  
  if (now < startDate) {
    return { valid: false, reason: "License start date is in the future." };
  }

  const graceEndDate = new Date(expiryDate);
  graceEndDate.setDate(graceEndDate.getDate() + (license.grace_days || 0));

  if (now > graceEndDate) {
    // If we're past the grace period, update DB status asynchronously to EXPIRED
    query(
      `UPDATE adm_company_licenses SET status = 'EXPIRED' WHERE id = ?`,
      [license.id]
    ).then(() => invalidateLicenseCache(companyId)).catch(() => {});
    
    return { valid: false, reason: "License expired past grace period." };
  }

  if (now >= expiryDate && license.status === 'ACTIVE') {
    // If past expiry date but still in grace period, change status to INACTIVE
    query(
      `UPDATE adm_company_licenses SET status = 'INACTIVE' WHERE id = ?`,
      [license.id]
    ).then(() => invalidateLicenseCache(companyId)).catch(() => {});
    license.status = 'INACTIVE';
  }

  const msToExpiry = expiryDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msToExpiry / (1000 * 60 * 60 * 24)));

  return {
    valid: true,
    licenseType: license.license_type,
    daysRemaining,
    inGracePeriod: now > expiryDate,
    maxUsers: license.max_users,
    modules: license.modules
  };
}

/**
 * Check if the company has reached its user limit
 */
export async function checkUserLimit(companyId) {
  const license = await getCompanyLicense(companyId);
  if (!license || !license.exists) {
    return { allowed: false, current: 0, max: 0, reason: "No license found." };
  }

  const result = await query(
    `SELECT COUNT(*) as count FROM adm_users WHERE company_id = ? AND is_active = 1`,
    [companyId]
  );

  const currentUsers = result[0].count;
  const maxUsers = license.max_users;

  if (currentUsers >= maxUsers) {
    return { allowed: false, current: currentUsers, max: maxUsers, reason: "User limit exceeded. Please upgrade your subscription." };
  }

  return { allowed: true, current: currentUsers, max: maxUsers };
}

/**
 * Check if a company has access to a specific module
 */
export async function checkModuleAccess(companyId, moduleCode) {
  const license = await getCompanyLicense(companyId);
  if (!license || !license.exists) {
    return false;
  }
  return license.modules.includes(moduleCode);
}
