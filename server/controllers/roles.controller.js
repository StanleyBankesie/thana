/**
 * @file roles.controller.js
 * @description Manages user roles and their associated permissions and access control pages.
 */
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  toNumber,
  ensurePagesTable,
  ensurePagesSeed,
  ensureRolePagesTable,
  ensureUserPermissionsTable,
} from "../utils/dbUtils.js";
/**
 * Fetches the role assigned to a specific user. Checks user_roles mapping table first,
 * and falls back to the role_id on the user record if no mapping exists.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getUserRole = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    let items = [];
    try {
      // First attempt: Fetch role from user_roles mapping table (adm_user_roles)
      items = await query(`
        SELECT r.id, r.company_id, r.name, r.code, r.is_active,
          ur.created_at,
          u.username AS created_by_name
         FROM adm_user_roles ur
        JOIN adm_roles r ON r.id = ur.role_id
        LEFT JOIN adm_users u ON u.id = ur.created_by
         WHERE ur.user_id = :id AND r.is_active = 1
        ORDER BY r.name ASC
        `,
        { id },
      );
    } catch (err) {
      // Fallback: Fetch direct role_id from user table (adm_users) if mapping query fails or isn't available
      items = await query(`
        SELECT r.id, r.company_id, r.name, r.code, r.is_active,
          u.created_at,
          uc.username AS created_by_name
         FROM adm_users u
        JOIN adm_roles r ON r.id = u.role_id
        LEFT JOIN adm_users uc ON uc.id = u.created_by
         WHERE u.id = :id
        LIMIT 1
        `,
        { id },
      );
    }
    res.json({ success: true, message: "User roles fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

/**
 * Lists all roles within a specific company context, sorted by name.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listRoles = async (req, res, next) => {
  try {
    const companyId = req.query.company_id || req.scope?.companyId;
    
    // Define base query and parameters
    let queryStr =
      "SELECT id, company_id, name, code, is_active, created_at FROM adm_roles";
    const params = {};
    
    // Apply company context filtering if applicable
    if (companyId) {
      queryStr += " WHERE company_id = :companyId";
      params.companyId = companyId;
    }
    queryStr += " ORDER BY name ASC";
    const items = await query(queryStr, params);
    res.json({ success: true, message: "Roles fetched", data: { items } });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the details of a single role along with the IDs of all pages associated with it.
 * Ensures necessary tables exist before executing the query.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getRoleById = async (req, res, next) => {
  try {
    const { companyId, branchIdsStr } = req.scope;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();
    
    // Fetch the base role document
    const items = await query(
      "SELECT id, company_id, name, code, is_active FROM adm_roles WHERE id = :id AND company_id = :companyId LIMIT 1",
      { id, companyId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Role not found");
    const role = items[0];
    
    // Fetch associated access pages
    const pages = await query(
      "SELECT page_id FROM adm_role_pages WHERE role_id = :id",
      { id },
    );
    role.pages = pages.map((p) => p.page_id);
    res.json({ success: true, message: "Role fetched", data: { item: role } });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a new role for a company and automatically maps the provided page access rights to it.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createRole = async (req, res, next) => {
  try {
    // Extract base context and request body parameters
    const scope = req.scope || {};
    const companyId = scope.companyId || 1;
    const { name, code, is_active, pages } = req.body || {};
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");
    const result = await query(
      "INSERT INTO adm_roles (company_id, name, code, is_active) VALUES (:companyId, :name, :code, :is_active)",
      {
        companyId,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    const roleId = result.insertId;
    if (Array.isArray(pages) && pages.length > 0) {
      for (const pageId of pages) {
        await query(
          "INSERT INTO adm_role_pages (role_id, page_id) VALUES (:roleId, :pageId)",
          { roleId, pageId },
        );
      }
    }
    res.status(201).json({
      success: true,
      message: "Role created",
      data: { id: roleId },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates an existing role's basic details and replaces its entire set of associated pages.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const updateRole = async (req, res, next) => {
  try {
    // Extract base context and parameters
    const scope = req.scope || {};
    const companyId = scope.companyId || 1;
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensurePagesTable();
    await ensurePagesSeed();
    await ensureRolePagesTable();
    await ensureUserPermissionsTable();

    const { name, code, is_active, pages } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      "UPDATE adm_roles SET name = :name, code = :code, is_active = :is_active WHERE id = :id AND company_id = :companyId",
      {
        id,
        companyId,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );

    // Update pages: Delete all and re-insert
    if (Array.isArray(pages)) {
      await query("DELETE FROM adm_role_pages WHERE role_id = :id", { id });
      for (const pageId of pages) {
        await query(
          "INSERT INTO adm_role_pages (role_id, page_id) VALUES (:roleId, :pageId)",
          { roleId: id, pageId },
        );
      }
    }

    res.json({
      success: true,
      message: "Role updated",
      data: { affectedRows: result.affectedRows },
    });
  } catch (err) {
    next(err);
  }
};
