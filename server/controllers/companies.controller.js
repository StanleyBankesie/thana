/**
 * @file companies.controller.js
 * @description Manages organizational structures including companies, branches, and departments.
 * Handles related configuration, logos, and dynamic schema migrations for companies.
 */
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { hasColumn, toNumber, ensureBranchColumns } from "../utils/dbUtils.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../utils/redis.js";

/**
 * Ensures the 'adm_companies' table and its required columns exist.
 * Performs dynamic schema updates if columns are missing.
 *
 * @returns {Promise<void>}
 */
export const ensureCompanyColumns = async () => {
  const table = "adm_companies";
  await query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) NOT NULL,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_company_code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  if (!(await hasColumn(table, "address"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN address VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "city"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN city VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "state"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN state VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "postal_code"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN postal_code VARCHAR(20) NULL`);
  }
  if (!(await hasColumn(table, "country"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN country VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "telephone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN telephone VARCHAR(50) NULL`);
  }
  if (!(await hasColumn(table, "email"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN email VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "website"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN website VARCHAR(255) NULL`);
  }
  if (!(await hasColumn(table, "tax_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN tax_id VARCHAR(100) NULL`);
  }
  if (!(await hasColumn(table, "registration_no"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN registration_no VARCHAR(100) NULL`,
    );
  }
  if (!(await hasColumn(table, "fiscal_year_start_month"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN fiscal_year_start_month TINYINT UNSIGNED DEFAULT 1`,
    );
  }
  if (!(await hasColumn(table, "timezone"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN timezone VARCHAR(64) NULL`);
  }
  if (!(await hasColumn(table, "currency_id"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN currency_id BIGINT UNSIGNED NULL`,
    );
  }
  if (!(await hasColumn(table, "logo"))) {
    await query(`ALTER TABLE ${table} ADD COLUMN logo LONGBLOB NULL`);
  }
};

/**
 * Creates a new company in the database.
 * (Note: Function name kept as mangeCompanies for backward compatibility).
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const mangeCompanies = async (req, res, next) => {
  try {
    const { name, code, is_active } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    await ensureCompanyColumns();
    const result = await query(
      "INSERT INTO adm_companies (name, code, is_active) VALUES (:name, :code, :is_active)",
      {
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates an existing company's profile and synchronizes the base currency configuration.
 * Uses a database transaction for consistency.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const updateCompanies = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    await ensureCompanyColumns();
    const {
      name,
      code,
      is_active,
      address,
      city,
      state,
      postal_code,
      country,
      telephone,
      email,
      website,
      tax_id,
      registration_no,
      fiscal_year_start_month,
      timezone,
      currency_id,
    } = req.body || {};
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const conn = await query.pool.getConnection();
    try {
      await conn.beginTransaction();
      const baseParams = {
        id,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      };
      const optional = {
        address,
        city,
        state,
        postal_code,
        country,
        telephone,
        email,
        website,
        tax_id,
        registration_no,
        fiscal_year_start_month:
          fiscal_year_start_month !== undefined
            ? toNumber(fiscal_year_start_month, 1)
            : undefined,
        timezone,
        currency_id:
          currency_id !== undefined ? toNumber(currency_id, null) : undefined,
      };
      const setClauses = [
        "name = ?",
        "code = ?",
        "is_active = ?",
      ];
      const paramArray = [
        baseParams.name,
        baseParams.code,
        baseParams.is_active
      ];
      for (const [key, val] of Object.entries(optional)) {
        if (val !== undefined) {
          setClauses.push(`${key} = ?`);
          paramArray.push(val);
        }
      }
      const sql = `UPDATE adm_companies SET ${setClauses.join(
        ", ",
      )} WHERE id = ?`;
      paramArray.push(id);
      await conn.execute(sql, paramArray);

      // Sync base currency
      const cid = toNumber(currency_id, null);
      if (cid) {
        await conn.execute(
          "UPDATE fin_currencies SET is_base = 0 WHERE company_id = ?",
          [id],
        );
        await conn.execute(
          "UPDATE fin_currencies SET is_base = 1 WHERE id = ? AND company_id = ?",
          [cid, id],
        );
      }

      await conn.commit();
      res.json({ affectedRows: 1 });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
};

export const getCompanies = async (req, res, next) => {
  try {
    try {
      await ensureCompanyColumns();
    } catch {}
    const companyIds = Array.isArray(req.user?.companyIds)
      ? req.user.companyIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    const { active } = req.query || {};
    const filters = [];
    const params = {};
    if (companyIds.length) {
      const keys = companyIds.map((_, i) => `:cid${i}`);
      filters.push(`id IN (${keys.join(",")})`);
      companyIds.forEach((v, i) => (params[`cid${i}`] = v));
    }
    if (typeof active !== "undefined" && active !== "") {
      filters.push("is_active = :is_active");
      params.is_active = Number(Boolean(active));
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const items = await query(`SELECT id, name, code, is_active, created_at,
          created_at,
          u.username AS created_by_name
         FROM adm_companies ${where}
        LEFT JOIN adm_users u ON u.id = created_by
         ORDER BY name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getCompanyById = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const cacheKey = `companies:id:${id}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ item: cached });
    }

    try {
      await ensureCompanyColumns();
    } catch {}

    let items = [];
    try {
      items = await query(`SELECT id, name, code, is_active, created_at,
                address, city, state, postal_code, country,
                telephone, email, website, tax_id, registration_no,
                fiscal_year_start_month, timezone, currency_id,
                CASE WHEN logo IS NULL THEN 0 ELSE 1 END AS has_logo,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id LIMIT 1`,
        { id },
      );
    } catch (err) {
      items = await query(`SELECT id, name, code, is_active, created_at,
                address, city, state, postal_code, country,
                telephone, email, website, tax_id, registration_no,
                fiscal_year_start_month, timezone, currency_id,
          created_at,
          u.username AS created_by_name
         FROM adm_companies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id LIMIT 1`,
        { id },
      );
      if (items.length) {
        items[0].has_logo = 0;
      }
    }
    if (!items.length) throw httpError(404, "NOT_FOUND", "Company not found");

    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Uploads and saves the company logo as a binary blob in the database.
 * Returns a versioned URL to bypass browser caching.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const uploadCompanyLogo = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    if (!req.file) throw httpError(400, "VALIDATION_ERROR", "No file uploaded");
    await ensureCompanyColumns();
    console.log("Uploading logo for company:", id, "File size:", req.file.size);
    const result = await query(
      "UPDATE adm_companies SET logo = :blob WHERE id = :id",
      {
        blob: req.file.buffer,
        id,
      },
    );
    console.log("Logo upload result:", result);
    // Return a versioned URL so clients can immediately render the new image
    // without being affected by any intermediate browser/proxy caches.
    const version = Date.now();
    const logoUrl = `/api/admin/companies/${id}/logo?v=${encodeURIComponent(String(version))}`;
    res.json({
      success: true,
      message: "Logo uploaded successfully",
      logoUrl,
      version,
    });
  } catch (err) {
    next(err);
  }
};

export const getCompanyLogo = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    await ensureCompanyColumns();
    console.log("Fetching logo for company:", id);
    const rows = await query(
      "SELECT logo FROM adm_companies WHERE id = :id LIMIT 1",
      { id },
    );
    console.log(
      "Logo query result - rows:",
      rows.length,
      "has logo:",
      rows.length ? !!rows[0].logo : false,
    );
    if (!rows.length || !rows[0].logo) {
      throw httpError(404, "NOT_FOUND", "Company logo not found");
    }
    const logoData = rows[0].logo;
    const logoBuffer = Buffer.isBuffer(logoData)
      ? logoData
      : Buffer.from(logoData);
    // Detect mime type from magic bytes to ensure correct rendering (color fidelity)
    let mime = "application/octet-stream";
    if (
      logoBuffer.length >= 8 &&
      logoBuffer[0] === 0x89 &&
      logoBuffer[1] === 0x50 &&
      logoBuffer[2] === 0x4e &&
      logoBuffer[3] === 0x47 &&
      logoBuffer[4] === 0x0d &&
      logoBuffer[5] === 0x0a &&
      logoBuffer[6] === 0x1a &&
      logoBuffer[7] === 0x0a
    ) {
      mime = "image/png";
    } else if (
      logoBuffer.length >= 3 &&
      logoBuffer[0] === 0xff &&
      logoBuffer[1] === 0xd8 &&
      logoBuffer[2] === 0xff
    ) {
      mime = "image/jpeg";
    } else if (
      logoBuffer.length >= 6 &&
      logoBuffer[0] === 0x47 &&
      logoBuffer[1] === 0x49 &&
      logoBuffer[2] === 0x46 &&
      logoBuffer[3] === 0x38 &&
      (logoBuffer[4] === 0x39 || logoBuffer[4] === 0x37) &&
      logoBuffer[5] === 0x61
    ) {
      mime = "image/gif";
    }
    res.setHeader("Content-Type", mime);
    res.setHeader("Content-Length", logoBuffer.length);
    // Disable caching to avoid stale logo responses; a versioned query param
    // is already used by clients for optimal cache busting.
    res.setHeader("Cache-Control", "no-store, max-age=0, must-revalidate");
    res.send(logoBuffer);
  } catch (err) {
    next(err);
  }
};

/**
 * Fetches a list of branches, filtered by the authenticated user's allowed company and branch context.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getBranches = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    const companyIds = Array.isArray(req.user?.companyIds)
      ? req.user.companyIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    const { active } = req.query || {};
    const filters = [];
    const params = {};
    if (companyIds.length) {
      const keys = companyIds.map((_, i) => `:cid${i}`);
      filters.push(`b.company_id IN (${keys.join(",")})`);
      companyIds.forEach((v, i) => (params[`cid${i}`] = v));
    }
    if (typeof active !== "undefined" && active !== "") {
      filters.push("b.is_active = :is_active");
      params.is_active = Number(Boolean(active));
    }
    const { branchIdsStr } = req.scope || {};
    if (branchIdsStr) {
      filters.push("(:branchIdsStr = '' OR FIND_IN_SET(b.id, :branchIdsStr))");
      params.branchIdsStr = branchIdsStr;
    }
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const items = await query(`SELECT b.*, c.name as company_name,
          b.created_at,
          u.username AS created_by_name
         FROM adm_branches b
         JOIN adm_companies c ON b.company_id = c.id
         ${where}
        LEFT JOIN adm_users u ON u.id = b.created_by
         ORDER BY c.name ASC, b.name ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getBranchById = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const branchIds = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    if (branchIds.length && !branchIds.includes(id)) {
      throw httpError(403, "FORBIDDEN", "Branch access denied");
    }

    const items = await query(
      "SELECT * FROM adm_branches WHERE id = :id LIMIT 1",
      { id },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Branch not found");

    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a new branch under a specified company, storing its contact and hierarchical details.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createBranch = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    // const { companyId = null } = req.scope || {};
    // We expect company_id in body now for global setup
    const {
      company_id,
      name,
      code,
      is_active,
      is_superbranch,
      parent_branch_id,
      address,
      city,
      state,
      postal_code,
      country,
      location,
      telephone,
      email,
      remarks,
      stock_upload_user_id,
    } = req.body || {};

    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(`INSERT INTO adm_branches (
          company_id, name, code, is_active, is_superbranch, parent_branch_id,
          address, city, state, postal_code, country,
          location, telephone, email, remarks, stock_upload_user_id
        ) VALUES (
          :company_id, :name, :code, :is_active, :is_superbranch, :parent_branch_id,
          :address, :city, :state, :postal_code, :country,
          :location, :telephone, :email, :remarks, :stock_upload_user_id
        )`,
      {
        company_id,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        is_superbranch: is_superbranch ? 1 : 0,
        parent_branch_id: parent_branch_id ? Number(parent_branch_id) : null,
        address: address || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || null,
        location: location || null,
        telephone: telephone || null,
        email: email || null,
        remarks: remarks || null,
        stock_upload_user_id: stock_upload_user_id ? Number(stock_upload_user_id) : null,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateBranch = async (req, res, next) => {
  try {
    await ensureBranchColumns();
    // const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const {
      company_id,
      name,
      code,
      is_active,
      is_superbranch,
      parent_branch_id,
      address,
      city,
      state,
      postal_code,
      country,
      location,
      telephone,
      email,
      remarks,
      stock_upload_user_id,
    } = req.body || {};

    if (!company_id)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(`UPDATE adm_branches
         SET company_id = :company_id,
             name = :name,
             code = :code,
             is_active = :is_active,
             is_superbranch = :is_superbranch,
             parent_branch_id = :parent_branch_id,
             address = :address,
             city = :city,
             state = :state,
             postal_code = :postal_code,
             country = :country,
             location = :location,
             telephone = :telephone,
             email = :email,
             remarks = :remarks,
             stock_upload_user_id = :stock_upload_user_id
         WHERE id = :id`,
      {
        id,
        company_id,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
        is_superbranch: is_superbranch ? 1 : 0,
        parent_branch_id: parent_branch_id ? Number(parent_branch_id) : null,
        address: address || null,
        city: city || null,
        state: state || null,
        postal_code: postal_code || null,
        country: country || null,
        location: location || null,
        telephone: telephone || null,
        email: email || null,
        remarks: remarks || null,
        stock_upload_user_id: stock_upload_user_id ? Number(stock_upload_user_id) : null,
      },
    );
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves departments associated with a company or branch, subject to user access restrictions.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getDepartments = async (req, res, next) => {
  try {
    const { company_id, branch_id } = req.query;
    const userBranchIds = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];
    let queryStr = `
        SELECT d.id, d.company_id, d.branch_id, d.name, d.code, d.is_active, d.created_at,
               c.name as company_name, b.name as branch_name
        FROM adm_departments d
        JOIN adm_companies c ON d.company_id = c.id
        LEFT JOIN adm_branches b ON d.branch_id = b.id
        WHERE 1=1
      `;
    const params = {};

    const companyId = company_id || req.scope?.companyId;
    if (companyId) {
      queryStr += " AND d.company_id = :companyId";
      params.companyId = companyId;
    }
    const effectiveBranchId = branch_id
      ? Number(branch_id)
      : req.scope?.branchId;
    if (Number.isFinite(effectiveBranchId)) {
      if (userBranchIds.length && !userBranchIds.includes(effectiveBranchId)) {
        throw httpError(403, "FORBIDDEN", "Branch access denied");
      }
      queryStr += " AND ((:branchId = '' OR FIND_IN_SET(d.branch_id, :branchId)) OR d.branch_id IS NULL)";
      params.branchId = effectiveBranchId;
    } else if (userBranchIds.length) {
      const keys = userBranchIds.map((_, i) => `:bid${i}`);
      queryStr += ` AND (d.branch_id IN (${keys.join(
        ",",
      )}) OR d.branch_id IS NULL)`;
      userBranchIds.forEach((v, i) => (params[`bid${i}`] = v));
    } else {
      queryStr += " AND d.branch_id IS NULL";
    }

    queryStr += " AND d.is_active = 1";
    queryStr += " ORDER BY c.name ASC, b.name ASC, d.name ASC";

    const items = await query(queryStr, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const updateDepartment = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");

    const { company_id, branch_id, name, code, is_active } = req.body || {};
    const effectiveCompanyId = company_id || req.scope?.companyId;

    if (!effectiveCompanyId)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");

    const result = await query(
      "UPDATE adm_departments SET company_id = :company_id, branch_id = :branch_id, name = :name, code = :code, is_active = :is_active WHERE id = :id",
      {
        id,
        company_id: effectiveCompanyId,
        branch_id: branch_id || null,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.json({ affectedRows: result.affectedRows });
  } catch (err) {
    next(err);
  }
};

export const getDepartmentById = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const items = await query(
      "SELECT * FROM adm_departments WHERE id = :id LIMIT 1",
      { id },
    );
    if (!items.length)
      throw httpError(404, "NOT_FOUND", "Department not found");
    res.json({
      success: true,
      message: "Department fetched",
      data: { item: items[0] },
    });
  } catch (err) {
    next(err);
  }
};

export const createDepartment = async (req, res, next) => {
  try {
    const { company_id, branch_id, name, code, is_active } = req.body || {};
    const effectiveCompanyId = company_id || req.scope?.companyId;

    if (!effectiveCompanyId)
      throw httpError(400, "VALIDATION_ERROR", "company_id is required");
    if (!name || !code)
      throw httpError(400, "VALIDATION_ERROR", "name and code are required");
    const result = await query(
      "INSERT INTO adm_departments (company_id, branch_id, name, code, is_active) VALUES (:company_id, :branch_id, :name, :code, :is_active)",
      {
        company_id: effectiveCompanyId,
        branch_id: branch_id || null,
        name,
        code,
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    res.status(201).json({
      success: true,
      message: "Department created",
      data: { id: result.insertId },
    });
  } catch (err) {
    next(err);
  }
};

export const getCurrentCompany = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    if (!companyId) throw httpError(401, "UNAUTHORIZED", "Company scope not found");

    const items = await query(
      `SELECT id, name, code, is_active, address, city, state, postal_code, country,
              telephone, email, website, tax_id, registration_no,
              fiscal_year_start_month, timezone, currency_id
         FROM adm_companies
        WHERE id = :id LIMIT 1`,
      { id: companyId },
    );
    if (!items.length) throw httpError(404, "NOT_FOUND", "Company not found");
    res.json({ item: items[0] });
  } catch (err) {
    next(err);
  }
};

