/**
 * @file access.routes.js
 * @description Routes for role-based access control, user permissions, and dashboards.
 */
import express from "express";
import { query } from "../db/pool.js";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import {
  ensureCol,
  ensurePagesSeed,
  ensurePagesTable,
  hasColumn,
  toNumber,
  verifiedTables,
} from "../utils/dbUtils.js";
import { getAllFeatures } from "../data/featuresRegistry.js";
import { getUserPermissions as rbacGetUserPermissions } from "../middleware/rbac.middleware.js";

const router = express.Router();

function listDefaultModules() {
  return [
    "administration",
    "sales",
    "inventory",
    "purchase",
    "finance",
    "human-resources",
    "maintenance",
    "project-management",
    "production",
    "pos",
    "business-intelligence",
    "service-management",
  ];
}

async function ensureAccessTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_roles (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NULL,
      name VARCHAR(100) NOT NULL,
      code VARCHAR(100) NOT NULL UNIQUE,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_modules (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module (role_id, module_key),
      INDEX idx_role_id (role_id),
      INDEX idx_module_key (module_key),
      CONSTRAINT fk_rm_role FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      role_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      feature_key VARCHAR(100) NOT NULL,
      can_view TINYINT(1) DEFAULT 0,
      can_create TINYINT(1) DEFAULT 0,
      can_edit TINYINT(1) DEFAULT 0,
      can_delete TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_role_module_feature (role_id, module_key, feature_key),
      INDEX idx_role_id (role_id),
      INDEX idx_module_key (module_key),
      CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  // Feature-level permissions (strict RBAC)
  // Deprecated tables intentionally removed:
  // - adm_role_feature_permissions
  // - adm_user_permission_overrides
  // - adm_user_feature_overrides
  // - adm_role_disabled_features
}

async function ensureDashboardPermissionsTable() {
  if (verifiedTables.has("adm_dashboard_permissions")) return;
  await query(`
    CREATE TABLE IF NOT EXISTS adm_dashboard_permissions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id BIGINT UNSIGNED NOT NULL,
      module_key VARCHAR(100) NOT NULL,
      dashboard_key VARCHAR(150) NULL,
      card_key VARCHAR(150) NULL,
      ticker_key VARCHAR(150) NULL,
      can_view TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_user_scope (user_id, module_key, dashboard_key, card_key, ticker_key),
      INDEX idx_user (user_id),
      INDEX idx_module (module_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await ensureCol(
    "adm_dashboard_permissions",
    "updated_at",
    "DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
  verifiedTables.add("adm_dashboard_permissions");
}

async function ensureNotificationPrefsTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_notification_prefs (
      user_id BIGINT UNSIGNED NOT NULL,
      pref_key VARCHAR(100) NOT NULL,
      push_enabled TINYINT(1) NOT NULL DEFAULT 0,
      email_enabled TINYINT(1) NOT NULL DEFAULT 0,
      sms_enabled TINYINT(1) NOT NULL DEFAULT 0,
      whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, pref_key),
      INDEX idx_pref_key (pref_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn("adm_notification_prefs", "sms_enabled"))) {
    await query("ALTER TABLE adm_notification_prefs ADD COLUMN sms_enabled TINYINT(1) NOT NULL DEFAULT 0");
  }
  if (!(await hasColumn("adm_notification_prefs", "whatsapp_enabled"))) {
    await query("ALTER TABLE adm_notification_prefs ADD COLUMN whatsapp_enabled TINYINT(1) NOT NULL DEFAULT 0");
  }
}

// Get notification preference for a user/key (or all users if no user_id)
router.get(
  "/notification-prefs",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureNotificationPrefsTable();
      const { companyId } = req.scope || {};
      const key = String(req.query?.key || "low-stock").trim();
      const userId = toNumber(req.query?.user_id || 0) || null;
      if (userId) {
        const rows = await query(
          `SELECT user_id, pref_key, push_enabled, email_enabled, sms_enabled, whatsapp_enabled, created_at, updated_at
           FROM adm_notification_prefs
           WHERE user_id = :userId AND pref_key = :key
           LIMIT 1`,
          { userId, key },
        );
        if (!rows.length)
          return res.json({
            item: {
              user_id: userId,
              pref_key: key,
              push_enabled: 0,
              email_enabled: 0,
              sms_enabled: 0,
              whatsapp_enabled: 0,
            },
          });
        return res.json({ item: rows[0] });
      } else {
        const rows = await query(
          `SELECT np.user_id, np.pref_key, np.push_enabled, np.email_enabled, np.sms_enabled, np.whatsapp_enabled, np.updated_at,
                  u.username, u.full_name, u.email, COALESCE(u.telephone, '') AS telephone,
                  b.name AS branch_name
           FROM adm_notification_prefs np
           JOIN adm_users u ON u.id = np.user_id
           LEFT JOIN adm_branches b ON u.branch_id = b.id
           WHERE np.pref_key = :key
             AND (:companyId IS NULL OR u.company_id IS NULL OR u.company_id = 0 OR u.company_id = :companyId)
             AND (np.push_enabled = 1 OR np.email_enabled = 1 OR np.sms_enabled = 1 OR np.whatsapp_enabled = 1)
           ORDER BY u.username ASC`,
          { key, companyId: companyId || null },
        );
        return res.json({ items: rows });
      }
    } catch (err) {
      next(err);
    }
  },
);

// Upsert notification preference for a user/key
router.put(
  "/notification-prefs/:key",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureNotificationPrefsTable();
      const key = String(req.params.key || "low-stock").trim();
      const { user_id, push_enabled, email_enabled, sms_enabled, whatsapp_enabled } = req.body || {};
      const userId = toNumber(user_id);
      if (!userId) return res.status(400).json({ message: "Invalid user_id" });
      await query(
        `INSERT INTO adm_notification_prefs (user_id, pref_key, push_enabled, email_enabled, sms_enabled, whatsapp_enabled)
         VALUES (:userId, :key, :push, :email, :sms, :whatsapp)
         ON DUPLICATE KEY UPDATE push_enabled = VALUES(push_enabled), email_enabled = VALUES(email_enabled), sms_enabled = VALUES(sms_enabled), whatsapp_enabled = VALUES(whatsapp_enabled)`,
        {
          userId,
          key,
          push: Number(Boolean(push_enabled)),
          email: Number(Boolean(email_enabled)),
          sms: Number(Boolean(sms_enabled)),
          whatsapp: Number(Boolean(whatsapp_enabled)),
        },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Delete/reset notification preference for a user/key
router.delete(
  "/notification-prefs/:key/:userId",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureNotificationPrefsTable();
      const key = String(req.params.key || "low-stock").trim();
      const userId = toNumber(req.params.userId);
      if (!userId) return res.status(400).json({ message: "Invalid user_id" });
      await query(
        `DELETE FROM adm_notification_prefs WHERE user_id = :userId AND pref_key = :key`,
        { userId, key },
      );
      res.json({ ok: true });
    } catch (err) {
      next(err);
    }
  },
);

// Get dashboard permissions for user (current if user_id omitted)
router.get(
  "/dashboard-permissions",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureDashboardPermissionsTable();
      const me = Number(req.user?.sub || req.user?.id);
      const userId = Number(req.query?.user_id || me);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.json({ items: [] });
      }
      const rows = await query(
        `SELECT user_id, module_key, dashboard_key, card_key, ticker_key, can_view, created_at, updated_at
         FROM adm_dashboard_permissions
         WHERE user_id = :userId
         ORDER BY module_key ASC, dashboard_key ASC, card_key ASC, ticker_key ASC`,
        { userId },
      );
      res.json({ items: rows || [] });
    } catch (err) {
      next(err);
    }
  },
);

// Get latest dashboard permission update time for user (current if user_id omitted)
router.get(
  "/dashboard-permissions/version",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureDashboardPermissionsTable();
      const me = Number(req.user?.sub || req.user?.id);
      const userId = Number(req.query?.user_id || me);
      if (!Number.isFinite(userId) || userId <= 0) {
        return res.json({ updated_at: null });
      }
      const rows = await query(
        `SELECT MAX(updated_at) AS updated_at
         FROM adm_dashboard_permissions
         WHERE user_id = :userId`,
        { userId },
      );
      res.json({ updated_at: rows?.[0]?.updated_at || null });
    } catch (err) {
      next(err);
    }
  },
);

// Bulk upsert dashboard permissions for user
router.put(
  "/dashboard-permissions",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureDashboardPermissionsTable();
      const me = Number(req.user?.sub || req.user?.id);
      const { user_id, permissions } = req.body || {};
      const targetUserId = Number(user_id || me);
      if (!Array.isArray(permissions))
        return res.status(400).json({ message: "permissions must be array" });
      for (const p of permissions) {
        const payload = {
          user_id: targetUserId,
          module_key: String(p.module_key || "").trim(),
          dashboard_key: p.dashboard_key ? String(p.dashboard_key) : null,
          card_key: p.card_key ? String(p.card_key) : null,
          ticker_key: p.ticker_key ? String(p.ticker_key) : null,
          can_view: Number(Boolean(p.can_view)),
        };
        if (!payload.module_key) continue;
        await query(
          `DELETE FROM adm_dashboard_permissions
           WHERE user_id = :user_id
             AND module_key = :module_key
             AND dashboard_key <=> :dashboard_key
             AND card_key <=> :card_key
             AND ticker_key <=> :ticker_key`,
          payload,
        );
        await query(
          `INSERT INTO adm_dashboard_permissions (user_id, module_key, dashboard_key, card_key, ticker_key, can_view)
           VALUES (:user_id, :module_key, :dashboard_key, :card_key, :ticker_key, :can_view)`,
          payload,
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/context",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      await ensureAccessTables();
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId) return res.status(401).json({ message: "Unauthorized" });
      const roleRows = await query(
        "SELECT role_id FROM adm_users WHERE id = :id LIMIT 1",
        { id: userId },
      );
      const roleId = toNumber(roleRows?.[0]?.role_id);
      if (!roleId)
        return res.json({
          roleId: null,
          roleModules: [],
          rolePermissions: [],
          userOverrides: [],
        });
      const roleModules = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :roleId",
        { roleId },
      );
      const rolePermissions = await query(
        "SELECT module_key, can_view, can_create, can_edit, can_delete FROM adm_role_permissions WHERE role_id = :roleId",
        { roleId },
      );
      res.json({
        roleId,
        roleModules,
        rolePermissions,
        userOverrides: [],
      });
    } catch (err) {
      next(err);
    }
  },
);

// Role feature allowlist
async function ensureRoleFeaturesTable() {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_role_features (
      role_id BIGINT UNSIGNED NOT NULL,
      feature_key VARCHAR(150) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (role_id, feature_key),
      INDEX idx_role_id (role_id),
      INDEX idx_feature_key (feature_key),
      FOREIGN KEY (role_id) REFERENCES adm_roles(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

router.get(
  "/roles/:id/features",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureRoleFeaturesTable();
      const id = toNumber(req.params.id);
      const rows = await query(
        "SELECT feature_key FROM adm_role_features WHERE role_id = :id",
        { id },
      );
      res.json({ features: rows.map((r) => String(r.feature_key)) });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/features",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureRoleFeaturesTable();
      const id = toNumber(req.params.id);
      const { features } = req.body || {};
      if (!Array.isArray(features))
        return res.status(400).json({ message: "features must be array" });

      // In neutralized RBAC environment, allow all features without module assignment check
      const valid = features.filter((fk) => String(fk || ""));

      // Original validation logic (commented out for neutralized RBAC)
      // const assigned = await query(
      //   "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
      //   { id },
      // );
      // const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      // const valid = [];
      // for (const fkRaw of features) {
      //   const fk = String(fkRaw || "");
      //   if (!fk) continue;
      //   const mk = fk.includes(":") ? fk.split(":")[0] : "";
      //   if (!assignedSet.has(mk))
      //     return res
      //       .status(400)
      //       .json({ message: `module not assigned for feature: ${fk}` });
      //   valid.push(fk);
      // }
      await query("DELETE FROM adm_role_features WHERE role_id = :id", { id });
      for (const fk of valid) {
        await query(
          "INSERT INTO adm_role_features (role_id, feature_key) VALUES (:id, :fk)",
          { id, fk },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Modules enumeration
router.get(
  "/modules",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const modules = [
        "administration",
        "sales",
        "inventory",
        "purchase",
        "finance",
        "human-resources",
        "maintenance",
        "project-management",
        "production",
        "pos",
        "business-intelligence",
        "service-management",
      ];
      res.json({ modules });
    } catch (err) {
      next(err);
    }
  },
);

function normalizeModuleName(name) {
  const s = String(name || "")
    .toLowerCase()
    .trim();
  return s.replace(/\s+/g, "-");
}
function featureKeyFromPath(path, moduleKey) {
  const p = String(path || "").replace(/^\/+/, "");
  const parts = p.split("/").filter(Boolean);
  if (!parts.length) return `${moduleKey}:${p || "root"}`;
  const withoutModule = parts[0] === moduleKey ? parts.slice(1) : parts;
  const slug = withoutModule.join("-");
  return `${moduleKey}:${slug || "root"}`;
}
router.get(
  "/features",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const features = getAllFeatures();
      res.json({ features });
    } catch (err) {
      next(err);
    }
  },
);

async function requireSuperAdmin(req, res, next) {
  try {
    const userId = toNumber(req.user?.sub || req.user?.id);
    if (!userId) return res.status(401).json({ message: "Unauthorized" });
    const rows = await query(
      "SELECT role_id FROM adm_users WHERE id = ? LIMIT 1",
      [userId],
    );
    const roleId = toNumber(rows?.[0]?.role_id);
    if (roleId === 1) return next();

    // Check RBAC feature permissions
    let featureKey = null;
    if (req.path.startsWith('/roles')) featureKey = 'roles';
    else if (req.path.includes('permissions')) featureKey = 'user-permissions';
    else if (req.path.includes('overrides')) featureKey = 'user-overrides';

    if (featureKey) {
      // Check if user has the feature in their JWT permissions (handles exceptional user permissions)
      const hasPermission = req.user?.permissions?.some(p => p.endsWith(`:${featureKey}`) || p === featureKey || p === '*');
      if (hasPermission) return next();

      const perm = await query(
        "SELECT 1 FROM adm_role_permissions WHERE role_id = ? AND feature_key = ? LIMIT 1",
        [roleId, featureKey]
      );
      if (perm.length > 0) return next();
      console.log(`[requireSuperAdmin] Forbidden: roleId=${roleId}, featureKey=${featureKey}, perm.length=0. Path=${req.path}`);
    } else {
      console.log(`[requireSuperAdmin] Forbidden: roleId=${roleId}, no featureKey matched for Path=${req.path}`);
    }

    return res.status(403).json({ message: "Forbidden: Access restricted" });
  } catch (err) {
    next(err);
  }
}

// Roles CRUD
router.get(
  "/roles",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const items = await query(
        "SELECT id, company_id, name, code, is_active FROM adm_roles ORDER BY name ASC",
        {},
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/roles",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const companyId = toNumber(req.scope?.companyId) || 1;
      const { name, code, is_active } = req.body || {};
      if (!name || !code)
        return res.status(400).json({ message: "name and code required" });
      const r = await query(
        "INSERT INTO adm_roles (company_id, name, code, is_active) VALUES (:companyId, :name, :code, :is_active)",
        {
          companyId,
          name,
          code,
          is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        },
      );
      res.status(201).json({ id: r.insertId });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      if (!id) return res.status(400).json({ message: "Invalid role ID" });
      const rows = await query(
        "SELECT id, company_id, name, code, is_active FROM adm_roles WHERE id = :id LIMIT 1",
        { id },
      );
      const role = rows[0] || null;
      if (!role) return res.status(404).json({ message: "Role not found" });
      res.json({ role });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const { name, code, is_active } = req.body || {};
      if (!id || !name || !code)
        return res.status(400).json({ message: "invalid payload" });
      await query(
        "UPDATE adm_roles SET name = :name, code = :code, is_active = :is_active WHERE id = :id",
        {
          id,
          name,
          code,
          is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        },
      );
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      return res.status(405).json({ message: "Roles cannot be deleted" });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/roles/:id",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      return res.status(405).json({ message: "Roles cannot be deleted" });
    } catch (err) {
      next(err);
    }
  },
);

// Role modules
router.get(
  "/roles/:id/modules",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const rows = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      res.json({ modules: rows.map((r) => r.module_key) });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/modules",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      const id = toNumber(req.params.id);
      const { modules } = req.body || {};
      if (!Array.isArray(modules))
        return res.status(400).json({ message: "modules must be array" });
      await query("DELETE FROM adm_role_modules WHERE role_id = :id", { id });
      for (const mk of modules) {
        await query(
          "INSERT INTO adm_role_modules (role_id, module_key) VALUES (:id, :mk)",
          { id, mk: String(mk) },
        );
      }
      // Cascade: remove permission and feature rows for modules no longer assigned
      await query("DELETE FROM adm_role_permissions WHERE role_id = :id", {
        id,
      });
      await query("DELETE FROM adm_role_features WHERE role_id = :id", { id });
      // Re-insert features for remaining modules (handled by the features endpoint)
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

// Role permissions
router.get(
  "/roles/:id/permissions",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureAccessTables();
      const id = toNumber(req.params.id);
      const assigned = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      const perms = await query(
        `SELECT module_key,
                MAX(can_view) AS can_view,
                MAX(can_create) AS can_create,
                MAX(can_edit) AS can_edit,
                MAX(can_delete) AS can_delete
           FROM adm_role_permissions
          WHERE role_id = :id
          GROUP BY module_key`,
        { id },
      );
      const filtered = perms.filter((p) =>
        assignedSet.has(String(p.module_key)),
      );
      res.json({ permissions: filtered });
    } catch (err) {
      next(err);
    }
  },
);

router.put(
  "/roles/:id/permissions",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureAccessTables();
      const id = toNumber(req.params.id);
      const { permissions } = req.body || {};
      if (!Array.isArray(permissions))
        return res.status(400).json({ message: "permissions must be array" });
      const assigned = await query(
        "SELECT module_key FROM adm_role_modules WHERE role_id = :id",
        { id },
      );
      const assignedSet = new Set(assigned.map((r) => String(r.module_key)));
      for (const p of permissions) {
        const mk = String(p.module_key || "");
        // Skip permissions for modules not assigned to this role (don't error)
        if (!assignedSet.has(mk)) continue;
        const featureKey = String(
          p.feature_key || p.featureKey || `${mk}:*`,
        ).trim();
        const payload = {
          can_view: Number(Boolean(p.can_view)),
          can_create: Number(Boolean(p.can_create)),
          can_edit: Number(Boolean(p.can_edit)),
          can_delete: Number(Boolean(p.can_delete)),
        };
        await query(
          `INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete)
         VALUES (:id, :mk, :featureKey, :can_view, :can_create, :can_edit, :can_delete)
         ON DUPLICATE KEY UPDATE can_view=VALUES(can_view), can_create=VALUES(can_create), can_edit=VALUES(can_edit), can_delete=VALUES(can_delete)`,
          { id, mk, featureKey, ...payload },
        );
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * Get module configuration (for frontend reference)
 */
router.get(
  "/modules/config",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      // This would typically come from a configuration file
      // For now, return a basic structure that matches our client-side config
      const modules = [
        {
          key: "purchase",
          name: "Purchase",
          icon: "🛒",
          path: "/purchase",
          features: [
            {
              key: "purchase-order",
              name: "Purchase Order",
              path: "/purchase/purchase-orders",
            },
            { key: "grn", name: "GRN", path: "/purchase/grn" },
            {
              key: "purchase-bill",
              name: "Purchase Bill",
              path: "/purchase/purchase-bills",
            },
            {
              key: "direct-purchase",
              name: "Direct Purchase",
              path: "/purchase/direct-purchase",
            },
            {
              key: "purchase-return",
              name: "Purchase Return",
              path: "/purchase/purchase-returns",
            },
            { key: "rfq", name: "RFQ", path: "/purchase/rfq" },
          ],
          dashboards: [
            {
              key: "purchase-dashboard",
              name: "Purchase Dashboard",
              path: "/purchase/dashboard",
            },
          ],
        },
        {
          key: "sales",
          name: "Sales",
          icon: "💰",
          path: "/sales",
          features: [
            {
              key: "sales-order",
              name: "Sales Order",
              path: "/sales/sales-orders",
            },
            {
              key: "sales-invoice",
              name: "Sales Invoice",
              path: "/sales/sales-invoices",
            },
            {
              key: "sales-return",
              name: "Sales Return",
              path: "/sales/sales-returns",
            },
            { key: "quotation", name: "Quotation", path: "/sales/quotations" },
            {
              key: "customer-payment",
              name: "Customer Payment",
              path: "/sales/customer-payments",
            },
          ],
          dashboards: [
            {
              key: "sales-dashboard",
              name: "Sales Dashboard",
              path: "/sales/dashboard",
            },
          ],
        },
        {
          key: "inventory",
          name: "Inventory",
          icon: "📦",
          path: "/inventory",
          features: [
            {
              key: "stock-management",
              name: "Stock Management",
              path: "/inventory/stock",
            },
            {
              key: "stock-transfer",
              name: "Stock Transfer",
              path: "/inventory/stock-transfer",
            },
            {
              key: "stock-adjustment",
              name: "Stock Adjustment",
              path: "/inventory/stock-adjustment",
            },
            {
              key: "item-master",
              name: "Item Master",
              path: "/inventory/items",
            },
          ],
          dashboards: [
            {
              key: "inventory-dashboard",
              name: "Inventory Dashboard",
              path: "/inventory/dashboard",
            },
          ],
        },
        {
          key: "accounts",
          name: "Accounts",
          icon: "📊",
          path: "/accounts",
          features: [
            {
              key: "chart-of-accounts",
              name: "Chart of Accounts",
              path: "/accounts/chart-of-accounts",
            },
            {
              key: "journal-entry",
              name: "Journal Entry",
              path: "/accounts/journal-entries",
            },
            { key: "ledger", name: "Ledger", path: "/accounts/ledger" },
            {
              key: "trial-balance",
              name: "Trial Balance",
              path: "/accounts/trial-balance",
            },
            {
              key: "balance-sheet",
              name: "Balance Sheet",
              path: "/accounts/balance-sheet",
            },
            {
              key: "profit-loss",
              name: "Profit & Loss",
              path: "/accounts/profit-loss",
            },
          ],
          dashboards: [
            {
              key: "accounts-dashboard",
              name: "Accounts Dashboard",
              path: "/accounts/dashboard",
            },
          ],
        },
        {
          key: "admin",
          name: "Admin",
          icon: "⚙️",
          path: "/admin",
          features: [
            {
              key: "user-management",
              name: "User Management",
              path: "/admin/users",
            },
            {
              key: "role-management",
              name: "Role Management",
              path: "/admin/roles",
            },
            {
              key: "company-settings",
              name: "Company Settings",
              path: "/admin/company",
            },
            {
              key: "system-settings",
              name: "System Settings",
              path: "/admin/settings",
            },
          ],
          dashboards: [
            {
              key: "admin-dashboard",
              name: "Admin Dashboard",
              path: "/admin/dashboard",
            },
          ],
        },
        {
          key: "transport",
          name: "Transport",
          icon: "🚚",
          path: "/transport",
          features: [
            { key: "trips", name: "Trips", path: "/transport/trips" },
            { key: "trip_management", name: "Trip Management", path: "/transport/trip-management" },
            { key: "trip_returns", name: "Trip Returns", path: "/transport/trip-returns" },
            { key: "tracking", name: "Tracking", path: "/transport/tracking" },
            { key: "vehicles", name: "Vehicles", path: "/transport/vehicles" },
            { key: "compliance", name: "Compliance", path: "/transport/compliance" },
            { key: "servicing", name: "Servicing", path: "/transport/servicing" },
            { key: "logbooks", name: "Logbooks", path: "/transport/logbooks" },
            { key: "drivers", name: "Drivers", path: "/transport/drivers" },
            { key: "fuel", name: "Fuel Logs", path: "/transport/fuel" },
            { key: "fuel_expenses", name: "Fuel Expenses", path: "/transport/fuel-expenses" },
            { key: "fuel_bills", name: "Fuel Bills", path: "/transport/fuel-bills" },
            { key: "transportation_bills", name: "Transportation Bills", path: "/transport/transportation-bills" },
            { key: "billing", name: "Billing", path: "/transport/billing" },
            { key: "routes", name: "Routes", path: "/transport/routes" },
            { key: "inspections", name: "Inspections", path: "/transport/inspections" },
            { key: "maintenance", name: "Maintenance", path: "/transport/maintenance" },
            { key: "breakdowns", name: "Breakdowns", path: "/transport/breakdowns" },
            { key: "settings", name: "Settings", path: "/transport/settings" },
            { key: "reports", name: "Reports", path: "/transport/reports" },
            { key: "income", name: "Income", path: "/transport/income" },
            { key: "expenses", name: "Transportation Expenses", path: "/transport/expenses" },
            { key: "expense_log", name: "Expense Logs", path: "/transport/expense-logs" },
          ],
          dashboards: [
            { key: "transport-dashboard", name: "Transport Dashboard", path: "/transport/dashboard" },
          ],
        },
      ];

      res.json({ modules });
    } catch (err) {
      next(err);
    }
  },
);

// RBAC: Get user modules and permissions (frontend guard usage)
router.get(
  "/permissions",
  requireAuth,
  requireCompanyScope,
  rbacGetUserPermissions,
);

router.get(
  "/diagnostics/permissions",
  requireAuth,
  requireCompanyScope,
  requireSuperAdmin,
  async (req, res, next) => {
    try {
      await ensureAccessTables();
      await ensureRoleFeaturesTable();
      const userId = toNumber(
        req.query?.user_id || req.user?.sub || req.user?.id,
      );
      if (!userId) {
        return res.status(400).json({ message: "Invalid user_id" });
      }

      const userRows = await query(
        `SELECT id, role_id, is_active
           FROM adm_users
          WHERE id = :id
          LIMIT 1`,
        { id: userId },
      );
      if (!userRows.length) {
        return res.status(404).json({ message: "User not found" });
      }

      const roleId = toNumber(userRows[0].role_id);
      const modules = roleId
        ? await query(
            "SELECT module_key FROM adm_role_modules WHERE role_id = :roleId",
            { roleId },
          )
        : [];
      const permissions = roleId
        ? await query(
            `SELECT module_key, feature_key, can_view, can_create, can_edit, can_delete
               FROM adm_role_permissions
              WHERE role_id = :roleId
              ORDER BY module_key, feature_key`,
            { roleId },
          )
        : [];
      const features = roleId
        ? await query(
            `SELECT feature_key
               FROM adm_role_features
              WHERE role_id = :roleId
              ORDER BY feature_key`,
            { roleId },
          )
        : [];

      res.json({
        ok: true,
        user: {
          id: userId,
          role_id: roleId || null,
          is_active: Number(userRows[0].is_active) === 1,
        },
        counts: {
          modules: modules.length,
          permissions: permissions.length,
          role_features: features.length,
        },
        modules: modules.map((m) => String(m.module_key || "")),
        sample_permissions: permissions.slice(0, 50),
        sample_role_features: features
          .slice(0, 50)
          .map((f) => String(f.feature_key)),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.get(
  "/diagnostics/status",
  requireAuth,
  requireCompanyScope,
  async (req, res) => {
    const startedAt = Date.now();
    const payload = {
      ok: true,
      status: "healthy",
      checks: {
        database: { ok: false, detail: null },
        rbac_tables: { ok: false, detail: null },
        current_user_role: { ok: false, detail: null },
      },
      response_time_ms: null,
    };

    try {
      await query("SELECT 1");
      payload.checks.database.ok = true;
      payload.checks.database.detail = "Database reachable";
    } catch (err) {
      payload.ok = false;
      payload.status = "degraded";
      payload.checks.database.detail = String(
        err?.message || "DB check failed",
      );
    }

    try {
      await ensureAccessTables();
      await ensureRoleFeaturesTable();
      payload.checks.rbac_tables.ok = true;
      payload.checks.rbac_tables.detail = "RBAC tables are accessible";
    } catch (err) {
      payload.ok = false;
      payload.status = "degraded";
      payload.checks.rbac_tables.detail = String(
        err?.message || "RBAC table check failed",
      );
    }

    try {
      const userId = toNumber(req.user?.sub || req.user?.id);
      if (!userId) {
        payload.ok = false;
        payload.status = "degraded";
        payload.checks.current_user_role.detail = "Invalid current user id";
      } else {
        const rows = await query(
          `SELECT role_id, is_active
             FROM adm_users
            WHERE id = :id
            LIMIT 1`,
          { id: userId },
        );
        if (!rows.length) {
          payload.ok = false;
          payload.status = "degraded";
          payload.checks.current_user_role.detail = "Current user not found";
        } else {
          const roleId = toNumber(rows[0].role_id, 0);
          payload.checks.current_user_role.ok = roleId > 0;
          payload.checks.current_user_role.detail =
            roleId > 0 ? `Role assigned (#${roleId})` : "No role assigned";
          if (roleId <= 0) {
            payload.ok = false;
            payload.status = "degraded";
          }
        }
      }
    } catch (err) {
      payload.ok = false;
      payload.status = "degraded";
      payload.checks.current_user_role.detail = String(
        err?.message || "User role check failed",
      );
    }

    payload.response_time_ms = Date.now() - startedAt;
    return res.status(200).json(payload);
  },
);

export default router;
