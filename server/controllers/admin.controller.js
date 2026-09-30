import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  toNumber,
  ensureExceptionalPermissionsTable,
  logError,
  ensurePagesTable,
  ensurePagesSeed,
} from "../utils/dbUtils.js";

export const logErrorController = async (req, res, next) => {
  try {
    const {
      module: moduleName,
      action,
      error_code,
      message,
      details,
    } = req.body ?? {};

    await logError({
      user_id: req.user?.id ?? null,
      module: moduleName ?? null,
      action: action ?? null,
      error_code: error_code ?? null,
      message: message ?? null,
      details: details ? JSON.stringify(details) : null,
    });

    return res.status(201).json({
      success: true,
      message: "Error logged successfully",
      data: null,
    });
  } catch (err) {
    return next(err);
  }
};

export const updateExceptionalPermissionController = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();

    const id = toNumber(req.params.id);
    if (!id) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }

    const {
      username,
      permissionCode,
      effect = "ALLOW",
      reason = null,
      is_active,
    } = req.body ?? {};

    if (!permissionCode) {
      throw httpError(400, "VALIDATION_ERROR", "Permission code is required");
    }

    let user_id;

    // Only resolve user if username is provided
    if (username) {
      const users = await query(
        "SELECT id FROM adm_users WHERE username = :username LIMIT 1",
        { username },
      );

      if (!users.length) {
        throw httpError(404, "NOT_FOUND", "User with this username not found");
      }

      user_id = users[0].id;
    }

    const result = await query(`
      UPDATE adm_exceptional_permissions
      SET
        user_id = COALESCE(:user_id, user_id),
        permission_code = :permissionCode,
        effect = :effect,
        reason = :reason,
        is_active = :is_active
      WHERE id = :id
      `,
      {
        id,
        user_id: user_id ?? null,
        permissionCode,
        effect,
        reason,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );

    if (!result.affectedRows) {
      throw httpError(404, "NOT_FOUND", "Exceptional permission not found");
    }

    return res.json({
      success: true,
      message: "Exceptional permission updated",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    return next(err);
  }
};

export const deleteExceptionalPermissionController = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const id = toNumber(req.params.id);
    if (!id) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    }
    const result = await query(
      "DELETE FROM adm_exceptional_permissions WHERE id = :id",
      { id },
    );
    if (!result.affectedRows) {
      throw httpError(404, "NOT_FOUND", "Exceptional permission not found");
    }
    return res.json({
      success: true,
      message: "Exceptional permission deleted",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    return next(err);
  }
};

export const getMe = async (req, res) => {
  try {
    const id =
      Number(req.user?.id) ||
      Number(req.user?.sub) ||
      Number(req.headers["x-user-id"]) ||
      null;
    let profile_picture_url = null;
    if (Number.isFinite(id) && id > 0) {
      try {
        const rows = await query(`SELECT u.profile_picture,
          u.created_at,
          uc.username AS created_by_name
         FROM adm_users u
        LEFT JOIN adm_users uc ON uc.id = u.created_by
         WHERE u.id = :id LIMIT 1`,
          { id },
        );
        if (rows.length) {
          const blob = rows[0].profile_picture || null;
          if (blob) {
            const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
            const str = b.toString("utf8");
            if (str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:")) {
              profile_picture_url = str;
            } else {
              let mime = "image/jpeg";
            if (
              b.length >= 3 &&
              b[0] === 0xff &&
              b[1] === 0xd8 &&
              b[2] === 0xff
            ) {
              mime = "image/jpeg";
            } else if (
              b.length >= 8 &&
              b[0] === 0x89 &&
              b[1] === 0x50 &&
              b[2] === 0x4e &&
              b[3] === 0x47 &&
              b[4] === 0x0d &&
              b[5] === 0x0a &&
              b[6] === 0x1a &&
              b[7] === 0x0a
            ) {
              mime = "image/png";
            } else if (
              b.length >= 12 &&
              b[0] === 0x52 &&
              b[1] === 0x49 &&
              b[2] === 0x46 &&
              b[3] === 0x46 &&
              b[8] === 0x57 &&
              b[9] === 0x45 &&
              b[10] === 0x42 &&
              b[11] === 0x50
            ) {
              mime = "image/webp";
            }
            profile_picture_url = `data:${mime};base64,${b.toString("base64")}`;
            }
          }
        }
      } catch {}
    }

    const scope = { ...(req.scope || {}) };
    if (scope.companyId) {
      const [compRows] = await query(
        `SELECT c.currency_id, cur.code AS base_currency_code 
         FROM adm_companies c
         LEFT JOIN fin_currencies cur ON cur.id = c.currency_id
         WHERE c.id = :companyId LIMIT 1`,
        { companyId: scope.companyId },
      );
      if (compRows) {
        scope.baseCurrency = compRows.base_currency_code || null;
        scope.baseCurrencyId = compRows.currency_id || null;
      }
    }

    const me = { ...(req.user || {}), profile_picture_url };
    return res.json({
      success: true,
      message: "Context",
      data: { user: me, scope },
    });
  } catch (err) {
    return res.json({
      success: true,
      message: "Context",
      data: { user: req.user, scope: req.scope },
    });
  }
};

export const listPages = async (req, res, next) => {
  try {
    await ensurePagesTable();
    await ensurePagesSeed();
    const items = await query("SELECT * FROM adm_pages ORDER BY module, name");
    res.json({ success: true, message: "Pages fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getDashboardStats = async (req, res, next) => {
  try {
    const [roles] = await query("SELECT COUNT(*) as count FROM adm_roles");
    const [pages] = await query("SELECT COUNT(*) as count FROM adm_pages");
    const [users] = await query("SELECT COUNT(*) as count FROM adm_users");
    const [assignments] = await query(
      "SELECT COUNT(*) as count FROM adm_users WHERE role_id IS NOT NULL",
    );
    const [activeExceptions] = await query(
      "SELECT COUNT(*) as count FROM adm_exceptional_permissions WHERE is_active = 1",
    );
    const [totalExceptions] = await query(
      "SELECT COUNT(*) as count FROM adm_exceptional_permissions",
    );
    let activeSessions = 0;
    let pendingWorkflows = 0;
    try {
      const [sessions] = await query(
        "SELECT COUNT(DISTINCT user_id) as count FROM adm_login_logs WHERE login_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)",
      );
      activeSessions = sessions.count;
    } catch {}
    try {
      const [pending] = await query(
        "SELECT COUNT(*) as count FROM adm_workflow_tasks WHERE action = 'PENDING'",
      );
      pendingWorkflows = pending.count;
    } catch {}
    res.json({
      success: true,
      message: "Dashboard stats",
      data: {
        rolesCount: roles.count,
        pagesCount: pages.count,
        usersCount: users.count,
        assignmentsCount: assignments.count,
        activeExceptionsCount: activeExceptions.count,
        totalExceptionsCount: totalExceptions.count,
        activeSessions,
        pendingWorkflows,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getExceptionalPermissionsForUser = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const userId = toNumber(req.params.id);
    if (!userId) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid user id");
    }
    const items = await query(`SELECT id, user_id, permission_code, effect, is_active, effective_from, effective_to, approved_by, exception_type,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :userId
       ORDER BY permission_code`,
      { userId },
    );
    res.json({
      success: true,
      message: "User exceptional permissions fetched",
      data: { items },
    });
  } catch (err) {
    next(err);
  }
};

export const bulkUpsertExceptionalPermissionsForUser = async (
  req,
  res,
  next,
) => {
  try {
    await ensureExceptionalPermissionsTable();
    const userId = toNumber(req.params.id);
    if (!userId) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid user id");
    }
    const { permissions } = req.body || {};
    if (!Array.isArray(permissions)) {
      throw httpError(400, "VALIDATION_ERROR", "permissions array required");
    }
    for (const p of permissions) {
      const code = String(p?.permission_code || "").trim();
      if (!code) continue;
      const effect =
        String(p?.effect || "ALLOW").toUpperCase() === "DENY"
          ? "DENY"
          : "ALLOW";
      const is_active =
        p?.is_active === undefined
          ? effect === "ALLOW"
            ? 1
            : 0
          : Number(Boolean(p.is_active));
      const reason = p?.reason ? String(p.reason) : null;
      const exception_type = p?.exception_type
        ? String(p.exception_type)
        : "STANDARD";
      const rows = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :userId AND permission_code = :code 
         LIMIT 1`,
        { userId, code },
      );
      if (rows.length) {
        await query(`UPDATE adm_exceptional_permissions
           SET effect = :effect, is_active = :is_active, reason = :reason, exception_type = :exception_type
           WHERE id = :id`,
          {
            id: rows[0].id,
            effect,
            is_active,
            reason,
            exception_type,
          },
        );
      } else {
        await query(`INSERT INTO adm_exceptional_permissions
             (user_id, permission_code, effect, reason, is_active, exception_type)
           VALUES
             (:userId, :code, :effect, :reason, :is_active, :exception_type)`,
          { userId, code, effect, reason, is_active, exception_type },
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const listExceptionalPermissions = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const items = await query(`SELECT ep.*, u.username, u.email as user_email, u.full_name as user_name,
          ep.created_at,
          uc.username AS created_by_name
         FROM adm_exceptional_permissions ep
       JOIN adm_users u ON ep.user_id = u.id
        LEFT JOIN adm_users uc ON uc.id = ep.created_by
         ORDER BY ep.created_at DESC`,
    );
    res.json({
      success: true,
      message: "Exceptional permissions fetched",
      data: { items },
    });
  } catch (err) {
    next(err);
  }
};

export const getExceptionalPermissionById = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(`SELECT ep.*, u.username, u.email as userEmail,
          ep.created_at,
          uc.username AS created_by_name
         FROM adm_exceptional_permissions ep
       JOIN adm_users u ON ep.user_id = u.id
        LEFT JOIN adm_users uc ON uc.id = ep.created_by
         WHERE ep.id = :id LIMIT 1`,
      { id },
    );
    if (!items.length)
      throw httpError(404, "NOT_FOUND", "Permission not found");
    res.json({
      success: true,
      message: "Exceptional permission fetched",
      data: { item: items[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const createExceptionalPermission = async (req, res, next) => {
  try {
    await ensureExceptionalPermissionsTable();
    const {
      username,
      permissionCode,
      effect,
      reason,
      is_active,
      effective_from,
      effective_to,
      approved_by,
      exception_type,
    } = req.body || {};
    if (!username || !permissionCode)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Username and permission code are required",
      );
    const users = await query(
      "SELECT id FROM adm_users WHERE username = :username LIMIT 1",
      { username },
    );
    if (!users.length)
      throw httpError(404, "NOT_FOUND", "User with this username not found");
    const user_id = users[0].id;
    const result = await query(`INSERT INTO adm_exceptional_permissions (
         user_id, permission_code, effect, reason, is_active,
         effective_from, effective_to, approved_by, exception_type
       ) VALUES (
         :user_id, :permissionCode, :effect, :reason, :is_active,
         :effective_from, :effective_to, :approved_by, :exception_type
       )`,
      {
        user_id,
        permissionCode,
        effect: effect || "ALLOW",
        reason: reason || null,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        effective_from: effective_from || null,
        effective_to: effective_to || null,
        approved_by: approved_by || req.user?.id || null,
        exception_type: exception_type || "TEMPORARY",
      },
    );
    res.status(201).json({
      success: true,
      message: "Exceptional permission created",
      data: { id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};
