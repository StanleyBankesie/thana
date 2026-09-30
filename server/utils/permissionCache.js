/**
 * @file permissionCache.js
 * @description Redis-backed permission cache for user roles and module/feature permissions.
 * Falls back to no-op when Redis is unavailable.
 */
import { cacheGet, cacheSet, cacheDel } from "./redis.js";

const TTL = 60 * 15; // 15 minutes

const KEYS = {
  roleId: (userId) => `perm:role:${userId}`,
  modules: (userId) => `perm:modules:${userId}`,
  features: (userId) => `perm:features:${userId}`,
};

export const permissionCache = {
  /** Get cached role ID for a user. Returns null if not cached. */
  async getRoleId(userId) {
    return cacheGet(KEYS.roleId(userId));
  },

  /** Cache a user's role ID. */
  async setRoleId(userId, roleId) {
    return cacheSet(KEYS.roleId(userId), roleId, TTL);
  },

  /** Get cached module keys for a user. Returns null if not cached. */
  async getModules(userId) {
    return cacheGet(KEYS.modules(userId));
  },

  /** Cache module keys for a user. */
  async setModules(userId, modules) {
    return cacheSet(KEYS.modules(userId), modules, TTL);
  },

  /** Get cached feature permissions for a user. Returns null if not cached. */
  async getFeatures(userId) {
    return cacheGet(KEYS.features(userId));
  },

  /** Cache feature permissions for a user. */
  async setFeatures(userId, features) {
    return cacheSet(KEYS.features(userId), features, TTL);
  },

  /** Invalidate all cached permission data for a user. */
  async invalidateUser(userId) {
    return cacheDel(
      KEYS.roleId(userId),
      KEYS.modules(userId),
      KEYS.features(userId)
    );
  },
};

export default permissionCache;
