import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { ensureRoleFeaturesTable } from "../utils/dbUtils.js";
import { permissionCache } from "../utils/permissionCache.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../utils/redis.js";

// ROLES CONTROLLER
/**
 * Retrieves all roles from the system, including creation details and the username of the creator.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getRoles(req, res, next) {
  try {
    const cacheKey = "roles:all";
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json(cached);
    }
    const roles = await query(`SELECT id, name, code, is_active, created_at, updated_at,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         ORDER BY name`
    );
    await cacheSet(cacheKey, roles, 86400).catch(() => {});
    res.json(roles);
  } catch (err) {
    next(err);
  }
}

/**
 * Creates a new role in the system. Ensures that the role code is unique before insertion.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function createRole(req, res, next) {
  try {
    // Extract role data from request body
    const { name, code, is_active = true } = req.body;
    
    // Validate required fields
    if (!name || !code) {
      return next(httpError(400, "Name and code are required"));
    }
    
    // Check if role code already exists
    const existing = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE code = :code`,
      { code }
    );
    
    if (existing.length > 0) {
      return next(httpError(400, "Role code already exists"));
    }
    
    const result = await query(`INSERT INTO adm_roles (name, code, is_active) 
       VALUES (:name, :code, :is_active)`,
      { name, code, is_active: is_active ? 1 : 0 }
    );
    
    const newRole = await query(`SELECT id, name, code, is_active, created_at, updated_at,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id`,
      { id: result.insertId }
    );
    
    await cacheDelPattern("roles:*").catch(() => {});
    res.status(201).json(newRole[0]);
  } catch (err) {
    next(err);
  }
}

/**
 * Updates an existing role's details. Verifies that the role exists and that the updated code 
 * doesn't conflict with another existing role.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function updateRole(req, res, next) {
  try {
    // Extract route parameters and request body
    const { id } = req.params;
    const { name, code, is_active } = req.body;
    
    // Validate required fields
    if (!name || !code) {
      return next(httpError(400, "Name and code are required"));
    }
    
    // Check if role exists
    const existing = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id`,
      { id }
    );
    
    if (existing.length === 0) {
      return next(httpError(404, "Role not found"));
    }
    
    // Check if role code already exists (excluding current role)
    const codeCheck = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE code = :code AND id != :id`,
      { code, id }
    );
    
    if (codeCheck.length > 0) {
      return next(httpError(400, "Role code already exists"));
    }
    
    await query(`UPDATE adm_roles 
       SET name = :name, code = :code, is_active = :is_active, updated_at = NOW()
       WHERE id = :id`,
      { name, code, is_active: is_active ? 1 : 0, id }
    );
    
    const updatedRole = await query(`SELECT id, name, code, is_active, created_at, updated_at,
          created_at,
          u.username AS created_by_name
         FROM adm_roles
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id`,
      { id }
    );
    
    await cacheDelPattern("roles:*").catch(() => {});
    res.json(updatedRole[0]);
  } catch (err) {
    next(err);
  }
}

// ROLE MODULES CONTROLLER
/**
 * Retrieves all modules associated with a specific role ID.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getRoleModules(req, res, next) {
  try {
    const { roleId } = req.params;
    
    const modules = await query(`SELECT role_id, module_key,
          created_at,
          u.username AS created_by_name
         FROM adm_role_modules
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE role_id = :roleId`,
      { roleId }
    );
    
    res.json(modules);
  } catch (err) {
    next(err);
  }
}

/**
 * Saves or updates the modules accessible to a specific role.
 * Replaces the existing role modules and updates related permissions in a database transaction.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveRoleModules(req, res, next) {
  try {
    // Extract role ID and module list
    const { role_id, modules } = req.body;
    
    // Validate request data
    if (!role_id || !Array.isArray(modules)) {
      return next(httpError(400, "Role ID and modules array are required"));
    }
    
    const roleId = Number(role_id);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid role_id is required"));
    }

    // Deduplicate and sanitize module keys
    const moduleKeys = Array.from(
      new Set(
        (modules || [])
          .map((m) => String(m || "").trim())
          .filter(Boolean),
      ),
    );

    // Initialize database connection for transaction
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Get company id for the role to verify license
      const [roleInfo] = await conn.query(`SELECT company_id FROM adm_roles WHERE id = ?`, [roleId]);
      if (!roleInfo || roleInfo.length === 0) {
        throw new Error("Role not found");
      }
      const companyId = roleInfo[0].company_id;

      // 2. Fetch active licensed modules for this company
      const [licenseModules] = await conn.query(`
        SELECT lm.module_code 
        FROM adm_license_modules lm
        JOIN adm_company_licenses cl ON lm.license_id = cl.id
        WHERE cl.company_id = ?
      `, [companyId]);
      const allowedModuleCodes = licenseModules.map(m => m.module_code);

      // 3. Filter submitted moduleKeys against allowed license modules
      // Always allow 'administration' and 'dashboard' as they are core modules
      const validModuleKeys = moduleKeys.filter(mk => 
        allowedModuleCodes.includes(mk) || 
        mk === 'administration' || 
        mk === 'dashboard'
      );

      // Replace role modules with the newly validated list
      await conn.query(`DELETE FROM adm_role_modules WHERE role_id = ?`, [roleId]);

      if (validModuleKeys.length > 0) {
        const values = validModuleKeys.map(() => "(?, ?)").join(",");
        const params = [];
        for (const mk of validModuleKeys) {
          params.push(roleId, mk);
        }
        await conn.query(`INSERT INTO adm_role_modules (role_id, module_key) VALUES ${values}`,
          params,
        );
        
        // Auto-add Features and Pages under these modules into their respective tables
        const lowerKeys = validModuleKeys.map(k => String(k).toLowerCase());
        const placeholders = lowerKeys.map(() => '?').join(',');

        // Insert missing features strictly related to the allowed modules
        await conn.query(`
          INSERT IGNORE INTO adm_role_features (role_id, feature_key)
          SELECT ?, feature_key FROM adm_pages 
          WHERE LOWER(module) IN (${placeholders}) AND feature_key IS NOT NULL
        `, [roleId, ...lowerKeys]);

        // Insert missing pages strictly related to the allowed modules
        await conn.query(`
          INSERT IGNORE INTO adm_role_pages (role_id, page_id)
          SELECT ?, id FROM adm_pages 
          WHERE LOWER(module) IN (${placeholders})
        `, [roleId, ...lowerKeys]);
      }

      // IMPORTANT:
      // If a module is unchecked, its feature/dashboard permissions must be removed too.
      // This guarantees sidebar and backend checks reflect the unchecked state.
      if (validModuleKeys.length === 0) {
        await conn.query(`DELETE FROM adm_role_permissions WHERE role_id = ?`, [roleId]);
        await conn.query(`DELETE FROM adm_role_features WHERE role_id = ?`, [roleId]);
        await conn.query(`DELETE FROM adm_role_pages WHERE role_id = ?`, [roleId]);
      } else {
        const placeholders = validModuleKeys.map(() => "?").join(",");
        await conn.query(`DELETE FROM adm_role_permissions
           WHERE role_id = ? AND module_key NOT IN (${placeholders})`,
          [roleId, ...validModuleKeys],
        );
        
        // Scrub adm_role_features of any features that do not belong to the allowed modules
        // Split feature_key by ':' and delete if the prefix is not in validModuleKeys
        const [features] = await conn.query('SELECT feature_key FROM adm_role_features WHERE role_id = ?', [roleId]);
        const badFeatures = features.filter(f => !f.feature_key || !validModuleKeys.includes(f.feature_key.split(':')[0])).map(f => f.feature_key).filter(Boolean);
        if (badFeatures.length > 0) {
          const bfPlaceholders = badFeatures.map(() => '?').join(',');
          await conn.query(`DELETE FROM adm_role_features WHERE role_id = ? AND feature_key IN (${bfPlaceholders})`, [roleId, ...badFeatures]);
          await conn.query(`DELETE FROM adm_role_permissions WHERE role_id = ? AND feature_key IN (${bfPlaceholders})`, [roleId, ...badFeatures]);
        }
        
        // Scrub adm_role_pages of any pages that do not belong to the allowed modules
        await conn.query(`
          DELETE rp FROM adm_role_pages rp
          JOIN adm_pages p ON rp.page_id = p.id
          WHERE rp.role_id = ? AND LOWER(p.module) NOT IN (${placeholders})
        `, [roleId, ...validModuleKeys.map(m => String(m).toLowerCase())]);
      }

      await conn.commit();
      // Invalidate permission cache for all users with this role
      // Best-effort: rely on TTL for users we can't identify here
      res.json({ message: "Role modules saved successfully" });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

// ROLE PERMISSIONS CONTROLLER
/**
 * Retrieves granular permissions for a specific role across modules and features.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getRolePermissions(req, res, next) {
  try {
    const { roleId } = req.params;
    
    const permissions = await query(`SELECT role_id, module_key, feature_key, 
              can_view, can_create, can_edit, can_delete,
          created_at,
          u.username AS created_by_name
         FROM adm_role_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE role_id = :roleId`,
      { roleId }
    );
    
    res.json(permissions);
  } catch (err) {
    next(err);
  }
}

/**
 * Saves detailed permissions (view, create, edit, delete) for a role's modules and features.
 * Overwrites all existing permissions for the role.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveRolePermissions(req, res, next) {
  try {
    const body = req.body || {};
    let permissions = Array.isArray(body.permissions) ? body.permissions : null;
    let roleId = null;

    if (!permissions) {
      const featureKeys = Array.isArray(body.feature_keys)
        ? body.feature_keys
        : Array.isArray(body.featureKeys)
          ? body.featureKeys
          : null;
      roleId = Number(body.role_id || body.roleId || 0);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        return next(httpError(400, "Valid role_id is required"));
      }
      if (!Array.isArray(featureKeys)) {
        return next(httpError(400, "feature_keys array is required"));
      }
      const deduped = Array.from(
        new Set(featureKeys.map((fk) => String(fk || "").trim()).filter(Boolean)),
      );
      permissions = deduped.map((feature_key) => {
        const module_key = feature_key.includes(":")
          ? feature_key.split(":")[0]
          : "";
        return {
          role_id: roleId,
          module_key,
          feature_key,
          can_view: 1,
          can_create: 0,
          can_edit: 0,
          can_delete: 0,
        };
      });
    } else {
      if (permissions.length === 0) {
        return next(httpError(400, "At least one permission is required"));
      }
      roleId = Number(permissions[0]?.role_id || 0);
      if (!Number.isFinite(roleId) || roleId <= 0) {
        return next(httpError(400, "Valid role_id is required"));
      }
    }

    const rowsToInsert = permissions
      .map((p) => {
        const featureKey = String(p?.feature_key || "").trim();
        if (!featureKey) return null;
        const moduleKeyRaw = String(p?.module_key || "").trim();
        const moduleKey = moduleKeyRaw || featureKey.split(":")[0] || "";
        return [
          roleId,
          moduleKey,
          featureKey,
          Number(Boolean(p?.can_view)),
          Number(Boolean(p?.can_create)),
          Number(Boolean(p?.can_edit)),
          Number(Boolean(p?.can_delete)),
        ];
      })
      .filter(Boolean);

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query("DELETE FROM adm_role_permissions WHERE role_id = ?", [
        roleId,
      ]);
      if (rowsToInsert.length > 0) {
        await conn.query(
          "INSERT INTO adm_role_permissions (role_id, module_key, feature_key, can_view, can_create, can_edit, can_delete) VALUES ?",
          [rowsToInsert],
        );
      }
      await conn.commit();
      res.json({ message: "Role permissions saved successfully" });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Fetches all enabled features for a given role.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getRoleFeatures(req, res, next) {
  try {
    // Ensure the required table exists before querying
    await ensureRoleFeaturesTable();
    const roleId = Number(req.params.roleId);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid roleId is required"));
    }
    const rows = await query(`SELECT feature_key,
          created_at,
          u.username AS created_by_name
         FROM adm_role_features
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE role_id = :roleId`,
      { roleId },
    );
    res.json(rows.map((r) => String(r.feature_key)));
  } catch (err) {
    next(err);
  }
}

/**
 * Saves a flat list of feature keys for a role.
 * Updates the database in a transaction to replace old feature mappings.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveRoleFeatures(req, res, next) {
  try {
    // Ensure required table is available
    await ensureRoleFeaturesTable();
    const { role_id, features } = req.body || {};
    const roleId = Number(role_id);
    if (!Number.isFinite(roleId) || !roleId) {
      return next(httpError(400, "Valid role_id is required"));
    }
    if (!Array.isArray(features)) {
      return next(httpError(400, "features array is required"));
    }

    const keys = Array.from(
      new Set(features.map((f) => String(f || "").trim()).filter(Boolean)),
    );

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query(`DELETE FROM adm_role_features WHERE role_id = ?`, [roleId]);
      if (keys.length > 0) {
        const values = keys.map(() => "(?, ?)").join(",");
        const params = [];
        for (const fk of keys) params.push(roleId, fk);
        await conn.query(`INSERT INTO adm_role_features (role_id, feature_key) VALUES ${values}`,
          params,
        );
      }
      await conn.commit();
      res.json({ message: "Role features saved successfully" });
    } catch (err) {
      try {
        await conn.rollback();
      } catch {}
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}
