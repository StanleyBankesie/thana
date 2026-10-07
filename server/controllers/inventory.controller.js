/**
 * @file inventory.controller.js
 * @description Manages inventory items, stock balances, warehouses, and related configurations.
 * Handles item creation, updates, and bulk stock adjustments.
 */
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { isBranchSharingEnabled } from "../utils/branchSharing.js";
import { cacheGet, cacheSet, cacheDelPattern } from "../utils/redis.js";

async function hasColumn(tableName, columnName) {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function ensureItemFlagColumns() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === 'true') return;
  if (!(await hasColumn("inv_items", "service_item"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN service_item CHAR(1) NOT NULL DEFAULT 'N'",
    );
  }
  if (!(await hasColumn("inv_items", "is_stockable"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN is_stockable CHAR(1) NOT NULL DEFAULT 'Y'",
    );
  }
  if (!(await hasColumn("inv_items", "is_sellable"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN is_sellable CHAR(1) NOT NULL DEFAULT 'Y'",
    );
  }
  if (!(await hasColumn("inv_items", "is_purchasable"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN is_purchasable CHAR(1) NOT NULL DEFAULT 'Y'",
    );
  }
  if (!(await hasColumn("inv_items", "category_id"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN category_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_items", "item_group_id"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN item_group_id BIGINT UNSIGNED NULL",
    );
  }
  if (!(await hasColumn("inv_items", "min_stock_level"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN min_stock_level DECIMAL(18,3) NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("inv_items", "max_stock_level"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN max_stock_level DECIMAL(18,3) NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("inv_items", "reorder_level"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN reorder_level DECIMAL(18,3) NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("inv_items", "safety_stock"))) {
    await query(
      "ALTER TABLE inv_items ADD COLUMN safety_stock DECIMAL(18,3) NOT NULL DEFAULT 0",
    );
  }
  if (!(await hasColumn("inv_items", "description"))) {
    await query("ALTER TABLE inv_items ADD COLUMN description TEXT NULL");
  }
}

async function resolveCategoryId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const code = v.toUpperCase();
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_item_categories
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND (UPPER(category_code) = :code OR UPPER(category_name) = :code)
    LIMIT 1
    `,
    { companyId, code },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolveGroupId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const code = v.toUpperCase();
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_item_groups
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND (UPPER(group_code) = :code OR UPPER(group_name) = :code)
    LIMIT 1
    `,
    { companyId, code },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolveCurrencyId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const code = v.toUpperCase();
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_currencies
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND (UPPER(code) = :code OR UPPER(name) = :code)
    LIMIT 1
    `,
    { companyId, code },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolvePriceTypeId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const name = v;
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM sal_price_types
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND UPPER(name) = UPPER(:name)
    LIMIT 1
    `,
    { companyId, name },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolveTaxCodeId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const code = v.toUpperCase();
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_tax_codes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND (UPPER(code) = :code OR UPPER(name) = :code)
    LIMIT 1
    `,
    { companyId, code },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolveAccountId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  // Prefer code match; fallback to name
  const asNum = Number(v);
  if (Number.isFinite(asNum) && asNum > 0) {
    const rows = await query(`
      SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_accounts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND id = :id
      LIMIT 1
      `,
      { companyId, id: asNum },
    ).catch(() => []);
    return Number(rows?.[0]?.id || 0) || null;
  }
  const rows = await query(`
    SELECT id,
          created_at,
          u.username AS created_by_name
         FROM fin_accounts
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND (UPPER(code) = UPPER(:v) OR UPPER(name) = UPPER(:v))
    LIMIT 1
    `,
    { companyId, v },
  ).catch(() => []);
  return Number(rows?.[0]?.id || 0) || null;
}

async function resolveOrCreateCategoryId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const existing =
    (await query(`
      SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_item_categories
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
        AND (UPPER(category_code) = :code OR UPPER(category_name) = :code)
      LIMIT 1
      `,
      { companyId, code: v.toUpperCase() },
    ).catch(() => [])) || [];
  if (existing.length) return Number(existing[0].id) || null;
  const code = v
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 30);
  const name = v.slice(0, 150);
  try {
    const ins = await query(`
      INSERT INTO inv_item_categories (company_id, category_code, category_name, is_active)
      VALUES (:companyId, :code, :name, 1)
      `,
      { companyId, code, name },
    );
    return Number(ins.insertId) || null;
  } catch {
    return null;
  }
}

async function resolveOrCreateGroupId(companyId, raw) {
  const v = String(raw || "").trim();
  if (!v) return null;
  const existing =
    (await query(`
      SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_item_groups
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
        AND (UPPER(group_code) = :code OR UPPER(group_name) = :code)
      LIMIT 1
      `,
      { companyId, code: v.toUpperCase() },
    ).catch(() => [])) || [];
  if (existing.length) return Number(existing[0].id) || null;
  const code = v
    .toUpperCase()
    .replace(/\s+/g, "_")
    .replace(/[^A-Z0-9_]/g, "_")
    .slice(0, 30);
  const name = v.slice(0, 150);
  try {
    const ins = await query(`
      INSERT INTO inv_item_groups (company_id, group_code, group_name, is_active)
      VALUES (:companyId, :code, :name, 1)
      `,
      { companyId, code, name },
    );
    return Number(ins.insertId) || null;
  } catch {
    return null;
  }
}

/**
 * Retrieves a list of all inventory items for a company, including their current stock balances and categorization.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listItems = async (req, res, next) => {
  try {
    await ensureItemFlagColumns();
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const groupCol = (await hasColumn("inv_items", "group_id"))
      ? "group_id"
      : "item_group_id";
    const hasBranchCol = await hasColumn("inv_items", "branch_id");
    const shareItems = await isBranchSharingEnabled(companyId, "BRANCH_SHARE_ITEMS");
    const rows = await query(`
      SELECT i.id,
             i.item_code,
             i.item_name,
             ${hasBranchCol ? "i.branch_id," : ""}
             i.uom,
             i.item_type,
             t.type_name AS item_type_name,
             i.barcode,
             i.cost_price,
             i.selling_price,
             i.currency_id,
             i.price_type_id,
             i.image_url,
             i.vat_on_purchase_id,
             i.vat_on_sales_id,
             i.purchase_account_id,
             i.sales_account_id,
             i.category_id,
             i.${groupCol} AS item_group_id,
             c.category_name,
             g.group_name,
             i.service_item,
             i.is_stockable,
             i.is_sellable,
             i.is_purchasable,
             i.is_active,
             COALESCE(sb.qty, 0) AS avail_qty,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
      LEFT JOIN inv_item_types t
        ON t.company_id = i.company_id
       AND t.type_code = i.item_type
      LEFT JOIN inv_item_categories c
        ON c.id = i.category_id
      LEFT JOIN inv_item_groups g
        ON g.id = i.${groupCol}
      LEFT JOIN (
        SELECT company_id, branch_id, item_id, SUM(qty) AS qty
        FROM inv_stock_balances
        GROUP BY company_id, branch_id, item_id
      ) sb
        ON sb.company_id = i.company_id
       AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
       AND sb.item_id = i.id
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.company_id = :companyId
           ${hasBranchCol && branchIdsStr && !shareItems ? "AND (:branchIdsStr = '' OR i.branch_id IS NULL OR FIND_IN_SET(i.branch_id, :branchIdsStr))" : ""}
           ${req.query.all !== "1" && req.query.all !== "true" ? "AND i.is_active = 1" : ""}
      ORDER BY i.item_name ASC
      `,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves a list of active warehouses associated with the current company and allowed branch contexts.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const listWarehouses = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    
    const cacheKey = `warehouses:company:${companyId}:branches:${branchIdsStr}`;
    const cached = await cacheGet(cacheKey);
    if (cached) {
      return res.json({ items: cached });
    }
    
    const rows = await query(`
      SELECT w.id, w.warehouse_code, w.warehouse_name, w.location, w.is_active, w.branch_id,
          w.created_at,
          u.username AS created_by_name
         FROM inv_warehouses w
        LEFT JOIN adm_users u ON u.id = w.created_by
         WHERE w.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(w.branch_id, :branchIdsStr))
      ORDER BY w.warehouse_name ASC
      `,
      { companyId, branchId, branchIdsStr },
    );
    
    await cacheSet(cacheKey, rows, 86400).catch(() => {});
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates stock balances for multiple items simultaneously in a specific warehouse and branch.
 * Resolves item IDs dynamically via codes if explicit IDs are not provided.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const bulkUpdateStockBalances = async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const body = req.body || {};
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const warehouseId =
      Number(body.warehouseId || 0) > 0 ? Number(body.warehouseId) : null;
    if (!rows.length) throw httpError(400, "VALIDATION_ERROR", "No rows");

    // Resolve optional warehouse by code if provided
    let resolvedWarehouseId = warehouseId;
    const warehouseCode = String(body.warehouseCode || "").trim();
    if (!resolvedWarehouseId && warehouseCode) {
      const wRows = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_warehouses
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) 
           AND UPPER(warehouse_code) = :code 
         LIMIT 1`,
        { companyId, branchId, code: warehouseCode.toUpperCase() },
      ).catch(() => []);
      resolvedWarehouseId = Number(wRows?.[0]?.id || 0) || null;
    }

    // Build item_code -> id map for efficient resolve
    const codes = Array.from(
      new Set(
        rows
          .map((r) => String(r.item_code || r.ITEM_CODE || "").trim())
          .filter(Boolean),
      ),
    );
    const placeholders = codes.map((_, i) => `:c${i}`).join(", ");
    const params = { companyId };
    codes.forEach((c, i) => (params[`c${i}`] = c));
    let codeToId = new Map();
    if (codes.length) {
      const items = await query(`SELECT id, item_code,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId 
           AND item_code IN (${placeholders})`,
        params,
      ).catch(() => []);
      for (const it of items || []) {
        codeToId.set(String(it.item_code || "").trim(), Number(it.id));
      }
    }

    let ok = 0;
    let fail = 0;
    for (const r of rows) {
      const code = String(r.item_code || r.ITEM_CODE || "").trim();
      const explicitItemId = Number(r.item_id || r.ITEM_ID || 0) || null;
      const qty = Number(r.qty ?? r.NEW_QTY ?? r.QTY ?? 0);
      if ((!code && !explicitItemId) || !Number.isFinite(qty)) {
        fail += 1;
        continue;
      }
      const itemId =
        explicitItemId ||
        codeToId.get(code) ||
        // Try case-insensitive lookup if not found
        null;
      if (!itemId) {
        fail += 1;
        continue;
      }
      try {
        // Upsert with replacement (set absolute quantity)
        await query(`INSERT INTO inv_stock_balances (company_id, branch_id, warehouse_id, item_id, qty)
           VALUES (:companyId, :branchId, :warehouseId, :itemId, :qty)
           ON DUPLICATE KEY UPDATE qty = :qty`,
          {
            companyId,
            branchId, branchIdsStr,
            warehouseId: resolvedWarehouseId,
            itemId,
            qty,
          },
        );
        ok += 1;
      } catch {
        fail += 1;
      }
    }
    res.json({ updated: ok, failed: fail });
  } catch (err) {
    next(err);
  }
};

/**
 * Retrieves the details of a single inventory item by its ID.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const getItemById = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(`
      SELECT i.*,
          i.created_at,
          u.username AS created_by_name
         FROM inv_items i
        LEFT JOIN adm_users u ON u.id = i.created_by
         WHERE i.id = :id AND i.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

/**
 * Creates a new inventory item and resolves missing related entities (like category, group, currency)
 * on the fly if auto-creation or bulk-import modes are active.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const createItem = async (req, res, next) => {
  try {
    await ensureItemFlagColumns();
    const { companyId = null } = req.scope || {};
    const body = req.body || {};
    const groupCol = (await hasColumn("inv_items", "group_id"))
      ? "group_id"
      : "item_group_id";
    const yn = (v, def = "N") => {
      if (v === undefined || v === null) return def;
      const s = String(v).toUpperCase();
      if (s === "Y") return "Y";
      if (s === "N") return "N";
      return Boolean(v) ? "Y" : "N";
    };
    const itemCode = String(body.item_code || "").trim();
    const itemName = String(body.item_name || "").trim();
    const uom = String(body.uom || "PCS").trim() || "PCS";
    const itemType = body.item_type ? String(body.item_type).trim() : null;
    const barcode = body.barcode ? String(body.barcode).trim() : null;
    const costPrice = Number(body.cost_price || 0);
    const sellingPrice = Number(body.selling_price || 0);
    let currencyId = Number(body.currency_id || 0) || null;
    let priceTypeId = Number(body.price_type_id || 0) || null;
    const imageUrl = body.image_url ? String(body.image_url).trim() : null;
    let vatOnPurchaseId = Number(body.vat_on_purchase_id || 0) || null;
    let vatOnSalesId = Number(body.vat_on_sales_id || 0) || null;
    let purchaseAccountId = Number(body.purchase_account_id || 0) || null;
    let salesAccountId = Number(body.sales_account_id || 0) || null;
    let categoryId = Number(body.category_id || 0) || null;
    let itemGroupId = Number(body.item_group_id || body.group_id || 0) || null;
    // Fallback server-side resolution if IDs not provided
    if (!categoryId) {
      categoryId =
        (await resolveCategoryId(companyId, body.category_label)) ||
        (await resolveCategoryId(companyId, body.category_name)) ||
        (await resolveCategoryId(companyId, body.category_code));
      if (!categoryId && (body.auto_create_missing || body.bulk_import)) {
        categoryId =
          (await resolveOrCreateCategoryId(companyId, body.category_label)) ||
          (await resolveOrCreateCategoryId(companyId, body.category_name)) ||
          (await resolveOrCreateCategoryId(companyId, body.category_code));
      }
    }
    if (!itemGroupId) {
      itemGroupId =
        (await resolveGroupId(companyId, body.group_label)) ||
        (await resolveGroupId(companyId, body.group_name)) ||
        (await resolveGroupId(companyId, body.group_code));
      if (!itemGroupId && (body.auto_create_missing || body.bulk_import)) {
        itemGroupId =
          (await resolveOrCreateGroupId(companyId, body.group_label)) ||
          (await resolveOrCreateGroupId(companyId, body.group_name)) ||
          (await resolveOrCreateGroupId(companyId, body.group_code));
      }
    }
    // Fallbacks for finance-related IDs
    if (!currencyId) {
      currencyId =
        (await resolveCurrencyId(companyId, body.currency_code)) ||
        (await resolveCurrencyId(companyId, body.currency_name));
    }
    if (!priceTypeId) {
      priceTypeId =
        (await resolvePriceTypeId(companyId, body.price_type)) ||
        (await resolvePriceTypeId(companyId, body.price_type_name));
    }
    if (!vatOnPurchaseId) {
      vatOnPurchaseId =
        (await resolveTaxCodeId(companyId, body.vat_on_purchase_code)) ||
        (await resolveTaxCodeId(companyId, body.vat_on_purchase_name)) ||
        (await resolveTaxCodeId(companyId, body.vat_purchase)) ||
        (await resolveTaxCodeId(companyId, body.vat_on_purchase));
    }
    if (!vatOnSalesId) {
      vatOnSalesId =
        (await resolveTaxCodeId(companyId, body.vat_on_sales_code)) ||
        (await resolveTaxCodeId(companyId, body.vat_on_sales_name)) ||
        (await resolveTaxCodeId(companyId, body.vat_sales)) ||
        (await resolveTaxCodeId(companyId, body.vat_on_sales));
    }
    if (!purchaseAccountId) {
      purchaseAccountId =
        (await resolveAccountId(companyId, body.purchase_account_code)) ||
        (await resolveAccountId(companyId, body.purchase_account_name)) ||
        (await resolveAccountId(companyId, body.purchase_account));
    }
    if (!salesAccountId) {
      salesAccountId =
        (await resolveAccountId(companyId, body.sales_account_code)) ||
        (await resolveAccountId(companyId, body.sales_account_name)) ||
        (await resolveAccountId(companyId, body.sales_account));
    }
    const serviceItem = yn(body.service_item, "N");
    const isStockable = yn(body.is_stockable, "Y");
    const isSellable = yn(body.is_sellable, "Y");
    const isPurchasable = yn(body.is_purchasable, "Y");
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!itemCode || !itemName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_code and item_name are required",
      );
    // Prevent duplicate item_name within the same company (case-insensitive)
    const dup = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND UPPER(item_name) = UPPER(:itemName) 
       LIMIT 1`,
      { companyId, itemName },
    );
    if (dup.length) {
      throw httpError(409, "DUPLICATE_ITEM_NAME", "Item name already exists");
    }
    const hasBranchCol = await hasColumn("inv_items", "branch_id");
    const targetBranchId = body.branch_id !== undefined
      ? (Number(body.branch_id) || null)
      : (req.scope?.branchId ? Number(req.scope.branchId) : null);

    const cols = `company_id, ${hasBranchCol ? "branch_id, " : ""}item_code, item_name, uom, item_type, barcode, cost_price, selling_price, currency_id, price_type_id, image_url, vat_on_purchase_id, vat_on_sales_id, purchase_account_id, sales_account_id, category_id, ${groupCol}, service_item, is_stockable, is_sellable, is_purchasable, is_active`;
    const vals = `:companyId, ${hasBranchCol ? ":branchId, " : ""}:itemCode, :itemName, :uom, :itemType, :barcode, :costPrice, :sellingPrice, :currencyId, :priceTypeId, :imageUrl, :vatOnPurchaseId, :vatOnSalesId, :purchaseAccountId, :salesAccountId, :categoryId, :itemGroupId, :serviceItem, :isStockable, :isSellable, :isPurchasable, :isActive`;

    const result = await query(`
      INSERT INTO inv_items (${cols})
      VALUES (${vals})
      `,
      {
        companyId,
        branchId: targetBranchId,
        itemCode,
        itemName,
        uom,
        itemType,
        barcode,
        costPrice,
        sellingPrice,
        currencyId,
        priceTypeId,
        imageUrl,
        vatOnPurchaseId,
        vatOnSalesId,
        purchaseAccountId,
        salesAccountId,
        categoryId,
        itemGroupId,
        serviceItem,
        isStockable,
        isSellable,
        isPurchasable,
        isActive,
      },
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
};

/**
 * Updates an existing inventory item's properties, preventing naming collisions.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const updateItem = async (req, res, next) => {
  try {
    await ensureItemFlagColumns();
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    const groupCol = (await hasColumn("inv_items", "group_id"))
      ? "group_id"
      : "item_group_id";
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const yn = (v, def = "N") => {
      if (v === undefined || v === null) return def;
      const s = String(v).toUpperCase();
      if (s === "Y") return "Y";
      if (s === "N") return "N";
      return Boolean(v) ? "Y" : "N";
    };
    const itemCode = String(body.item_code || "").trim();
    const itemName = String(body.item_name || "").trim();
    const uom = String(body.uom || "PCS").trim() || "PCS";
    const itemType = body.item_type ? String(body.item_type).trim() : null;
    const barcode = body.barcode ? String(body.barcode).trim() : null;
    const costPrice = Number(body.cost_price || 0);
    const sellingPrice = Number(body.selling_price || 0);
    const currencyId = Number(body.currency_id || 0) || null;
    const priceTypeId = Number(body.price_type_id || 0) || null;
    const imageUrl = body.image_url ? String(body.image_url).trim() : null;
    const vatOnPurchaseId = Number(body.vat_on_purchase_id || 0) || null;
    const vatOnSalesId = Number(body.vat_on_sales_id || 0) || null;
    const purchaseAccountId = Number(body.purchase_account_id || 0) || null;
    const salesAccountId = Number(body.sales_account_id || 0) || null;
    const categoryId = Number(body.category_id || 0) || null;
    const itemGroupId =
      Number(body.item_group_id || body.group_id || 0) || null;
    const serviceItem = yn(body.service_item, "N");
    const isStockable = yn(body.is_stockable, "Y");
    const isSellable = yn(body.is_sellable, "Y");
    const isPurchasable = yn(body.is_purchasable, "Y");
    const isActive =
      body.is_active === undefined ? 1 : Number(Boolean(body.is_active));
    if (!itemCode || !itemName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_code and item_name are required",
      );
    // Prevent duplicate item_name on rename (case-insensitive)
    const exists = await query(`SELECT id,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND UPPER(item_name) = UPPER(:itemName) AND id <> :id
       LIMIT 1`,
      { companyId, itemName, id },
    );
    if (exists.length) {
      throw httpError(409, "DUPLICATE_ITEM_NAME", "Item name already exists");
    }
    const hasBranchCol = await hasColumn("inv_items", "branch_id");
    const updateBranchClause = hasBranchCol && body.branch_id !== undefined ? ", branch_id = :branchId" : "";
    const upd = await query(`
      UPDATE inv_items
      SET item_code = :itemCode,
          item_name = :itemName,
          uom = :uom,
          item_type = :itemType,
          barcode = :barcode,
          cost_price = :costPrice,
          selling_price = :sellingPrice,
          currency_id = :currencyId,
          price_type_id = :priceTypeId,
          image_url = :imageUrl,
          vat_on_purchase_id = :vatOnPurchaseId,
          vat_on_sales_id = :vatOnSalesId,
          purchase_account_id = :purchaseAccountId,
          sales_account_id = :salesAccountId,
          category_id = :categoryId,
          ${groupCol} = :itemGroupId,
          service_item = :serviceItem,
          is_stockable = :isStockable,
          is_sellable = :isSellable,
          is_purchasable = :isPurchasable,
          is_active = :isActive
          ${updateBranchClause}
      WHERE id = :id AND company_id = :companyId
      `,
      {
        id,
        companyId,
        branchId: body.branch_id !== undefined ? (Number(body.branch_id) || null) : null,
        itemCode,
        itemName,
        uom,
        itemType,
        barcode,
        costPrice,
        sellingPrice,
        currencyId,
        priceTypeId,
        imageUrl,
        vatOnPurchaseId,
        vatOnSalesId,
        purchaseAccountId,
        salesAccountId,
        categoryId,
        itemGroupId,
        serviceItem,
        isStockable,
        isSellable,
        isPurchasable,
        isActive,
      },
    );
    if (!upd.affectedRows) throw httpError(404, "NOT_FOUND", "Item not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

/**
 * Inserts new or updates existing inventory items from an array of payloads.
 * Automatically generates missing item codes sequentially if necessary.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export const linkWarehouseBranch = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const targetBranchId = Number(body.branch_id);
    if (!Number.isFinite(targetBranchId) || targetBranchId <= 0)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "branch_id is required to link warehouse",
      );
    const branchRow = await query(
      `SELECT id, company_id FROM adm_branches WHERE id = :targetBranchId LIMIT 1`,
      { targetBranchId },
    );
    const branch = branchRow?.[0];
    if (!branch) throw httpError(404, "NOT_FOUND", "Target branch not found");
    if (Number(branch.company_id) !== Number(companyId))
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Branch belongs to a different company",
      );
    const whRow = await query(
      `SELECT id, company_id, branch_id FROM inv_warehouses WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id, companyId },
    );
    const warehouse = whRow?.[0];
    if (!warehouse) throw httpError(404, "NOT_FOUND", "Warehouse not found");
    const allowedBranches = Array.isArray(req.user?.branchIds)
      ? req.user.branchIds.map(Number)
      : [];
    if (allowedBranches.length && !allowedBranches.includes(targetBranchId))
      throw httpError(403, "FORBIDDEN", "Branch access denied");
    const upd = await query(
      `UPDATE inv_warehouses SET branch_id = :targetBranchId WHERE id = :id AND company_id = :companyId`,
      { id, companyId, targetBranchId },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Warehouse not found");
    res.json({ ok: true, branch_id: targetBranchId });
  } catch (err) {
    next(err);
  }
};

export const getNextItemCode = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(`
      SELECT item_code,
          created_at,
          u.username AS created_by_name
         FROM inv_items
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId AND item_code REGEXP '^[0-9]+$'
      ORDER BY CAST(item_code AS UNSIGNED) DESC
      LIMIT 1
      `,
      { companyId },
    );
    let nextNum = 1;
    if (rows.length > 0) nextNum = parseInt(rows[0].item_code, 10) + 1;
    const nextCode = String(nextNum).padStart(6, "0");
    res.json({ nextCode });
  } catch (err) {
    next(err);
  }
};

export const listItemGroups = async (req, res, next) => {
  try {
    const { companyId = null, branchIdsStr = '' } = req.scope || {};
    const hasBranchCol = await hasColumn("inv_item_groups", "branch_id");
    const rows = await query(`
      SELECT g.id,
             g.group_code,
             g.group_name,
             ${hasBranchCol ? "g.branch_id," : ""}
             g.parent_group_id,
             pg.group_name AS parent_group_name,
             g.is_active,
          g.created_at,
          u.username AS created_by_name
         FROM inv_item_groups g
      LEFT JOIN inv_item_groups pg ON pg.id = g.parent_group_id
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.company_id = :companyId
           ${hasBranchCol && branchIdsStr ? "AND (:branchIdsStr = '' OR g.branch_id IS NULL OR FIND_IN_SET(g.branch_id, :branchIdsStr))" : ""}
      ORDER BY g.group_name ASC, g.id ASC
      `,
      { companyId, branchIdsStr },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemGroupById = async (req, res, next) => {
  try {
    const { companyId = null, branchIdsStr = '' } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const hasBranchCol = await hasColumn("inv_item_groups", "branch_id");
    const rows = await query(`
      SELECT g.*,
          g.created_at,
          u.username AS created_by_name
         FROM inv_item_groups g
        LEFT JOIN adm_users u ON u.id = g.created_by
         WHERE g.id = :id AND g.company_id = :companyId
           ${hasBranchCol && branchIdsStr ? "AND (:branchIdsStr = '' OR g.branch_id IS NULL OR FIND_IN_SET(g.branch_id, :branchIdsStr))" : ""}
      LIMIT 1
      `,
      { id, companyId, branchIdsStr },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item group not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemGroup = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const body = req.body || {};
    const groupCode = String(body.group_code || "").trim();
    const groupName = String(body.group_name || "").trim();
    const parentGroupId = Number(body.parent_group_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!groupCode || !groupName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "group_code and group_name are required",
      );
    const hasBranchCol = await hasColumn("inv_item_groups", "branch_id");
    const targetBranchId = body.branch_id !== undefined
      ? (Number(body.branch_id) || null)
      : (req.scope?.branchId ? Number(req.scope.branchId) : null);
    const cols = `company_id, ${hasBranchCol ? "branch_id, " : ""}group_code, group_name, parent_group_id, is_active`;
    const vals = `:companyId, ${hasBranchCol ? ":branchId, " : ""}:groupCode, :groupName, :parentGroupId, :isActive`;
    const ins = await query(`
      INSERT INTO inv_item_groups (${cols})
      VALUES (${vals})
      `,
      { companyId, branchId: targetBranchId, groupCode, groupName, parentGroupId, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemGroup = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const groupCode = String(body.group_code || "").trim();
    const groupName = String(body.group_name || "").trim();
    const parentGroupId = Number(body.parent_group_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!groupCode || !groupName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "group_code and group_name are required",
      );
    if (parentGroupId && parentGroupId === id)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "parent_group_id cannot be the same as id",
      );
    const hasBranchCol = await hasColumn("inv_item_groups", "branch_id");
    const updateBranchClause = hasBranchCol && body.branch_id !== undefined ? ", branch_id = :branchId" : "";
    const upd = await query(`
      UPDATE inv_item_groups
      SET group_code = :groupCode,
          group_name = :groupName,
          parent_group_id = :parentGroupId,
          is_active = :isActive
          ${updateBranchClause}
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, branchId: body.branch_id !== undefined ? (Number(body.branch_id) || null) : null, groupCode, groupName, parentGroupId, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item group not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listItemCategories = async (req, res, next) => {
  try {
    const { companyId = null, branchIdsStr = '' } = req.scope || {};
    const hasBranchCol = await hasColumn("inv_item_categories", "branch_id");
    const rows = await query(`
      SELECT c.id,
             c.category_code,
             c.category_name,
             ${hasBranchCol ? "c.branch_id," : ""}
             c.parent_category_id,
             pc.category_name AS parent_category_name,
             c.is_active,
          c.created_at,
          u.username AS created_by_name
         FROM inv_item_categories c
      LEFT JOIN inv_item_categories pc ON pc.id = c.parent_category_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
           ${hasBranchCol && branchIdsStr ? "AND (:branchIdsStr = '' OR c.branch_id IS NULL OR FIND_IN_SET(c.branch_id, :branchIdsStr))" : ""}
      ORDER BY c.category_name ASC, c.id ASC
      `,
      { companyId, branchIdsStr },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemCategoryById = async (req, res, next) => {
  try {
    const { companyId = null, branchIdsStr = '' } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const hasBranchCol = await hasColumn("inv_item_categories", "branch_id");
    const rows = await query(`
      SELECT c.*,
          c.created_at,
          u.username AS created_by_name
         FROM inv_item_categories c
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.id = :id AND c.company_id = :companyId
           ${hasBranchCol && branchIdsStr ? "AND (:branchIdsStr = '' OR c.branch_id IS NULL OR FIND_IN_SET(c.branch_id, :branchIdsStr))" : ""}
      LIMIT 1
      `,
      { id, companyId, branchIdsStr },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Item category not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemCategory = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const body = req.body || {};
    const categoryCode = String(body.category_code || "").trim();
    const categoryName = String(body.category_name || "").trim();
    const parentCategoryId = Number(body.parent_category_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!categoryCode || !categoryName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "category_code and category_name are required",
      );
    const hasBranchCol = await hasColumn("inv_item_categories", "branch_id");
    const targetBranchId = body.branch_id !== undefined
      ? (Number(body.branch_id) || null)
      : (req.scope?.branchId ? Number(req.scope.branchId) : null);
    const cols = `company_id, ${hasBranchCol ? "branch_id, " : ""}category_code, category_name, parent_category_id, is_active`;
    const vals = `:companyId, ${hasBranchCol ? ":branchId, " : ""}:categoryCode, :categoryName, :parentCategoryId, :isActive`;
    const ins = await query(`
      INSERT INTO inv_item_categories (${cols})
      VALUES (${vals})
      `,
      { companyId, branchId: targetBranchId, categoryCode, categoryName, parentCategoryId, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemCategory = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const categoryCode = String(body.category_code || "").trim();
    const categoryName = String(body.category_name || "").trim();
    const parentCategoryId = Number(body.parent_category_id || 0) || null;
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!categoryCode || !categoryName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "category_code and category_name are required",
      );
    if (parentCategoryId && parentCategoryId === id)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "parent_category_id cannot be the same as id",
      );
    const hasBranchCol = await hasColumn("inv_item_categories", "branch_id");
    const updateBranchClause = hasBranchCol && body.branch_id !== undefined ? ", branch_id = :branchId" : "";
    const upd = await query(`
      UPDATE inv_item_categories
      SET category_code = :categoryCode,
          category_name = :categoryName,
          parent_category_id = :parentCategoryId,
          is_active = :isActive
          ${updateBranchClause}
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, branchId: body.branch_id !== undefined ? (Number(body.branch_id) || null) : null, categoryCode, categoryName, parentCategoryId, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item category not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const deleteItemCategory = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    try {
      const del = await query(`DELETE FROM inv_item_categories WHERE id = :id AND company_id = :companyId`,
        { id, companyId },
      );
      if (!del.affectedRows)
        throw httpError(404, "NOT_FOUND", "Item category not found");
      res.json({ ok: true });
    } catch (err) {
      if (err.code === "ER_ROW_IS_REFERENCED_2") {
        return next(
          httpError(
            400,
            "CONSTRAINT_ERROR",
            "Cannot delete Category because it is in use.",
          ),
        );
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
};

export const listItemTypes = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(`
      SELECT t.id, t.type_code, t.type_name, t.is_active,
          t.created_at,
          u.username AS created_by_name
         FROM inv_item_types t
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.company_id = :companyId
      ORDER BY t.type_name ASC, t.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getItemTypeById = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(`
      SELECT t.*,
          t.created_at,
          u.username AS created_by_name
         FROM inv_item_types t
        LEFT JOIN adm_users u ON u.id = t.created_by
         WHERE t.id = :id AND t.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createItemType = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const body = req.body || {};
    const typeCode = String(body.type_code || "").trim();
    const typeName = String(body.type_name || "").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!typeCode || !typeName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "type_code and type_name are required",
      );
    const ins = await query(`
      INSERT INTO inv_item_types (company_id, type_code, type_name, is_active)
      VALUES (:companyId, :typeCode, :typeName, :isActive)
      `,
      { companyId, typeCode, typeName, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateItemType = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const typeCode = String(body.type_code || "").trim();
    const typeName = String(body.type_name || "").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!typeCode || !typeName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "type_code and type_name are required",
      );
    const upd = await query(`
      UPDATE inv_item_types
      SET type_code = :typeCode,
          type_name = :typeName,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, typeCode, typeName, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const deleteItemType = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const del = await query(`DELETE FROM inv_item_types WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!del.affectedRows)
      throw httpError(404, "NOT_FOUND", "Item type not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listUnitConversions = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(`
      SELECT c.id,
             c.item_id,
             i.item_code,
             i.item_name,
             c.from_uom,
             c.to_uom,
             c.conversion_factor,
             c.is_active,
          c.created_at,
          u.username AS created_by_name
         FROM inv_unit_conversions c
      JOIN inv_items i ON i.id = c.item_id
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.company_id = :companyId
      ORDER BY i.item_name ASC, c.from_uom ASC, c.to_uom ASC, c.id ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const getUnitConversionById = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const rows = await query(`
      SELECT c.*,
          c.created_at,
          u.username AS created_by_name
         FROM inv_unit_conversions c
        LEFT JOIN adm_users u ON u.id = c.created_by
         WHERE c.id = :id AND c.company_id = :companyId
      LIMIT 1
      `,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Unit conversion not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createUnitConversion = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || null;
    const body = req.body || {};
    const itemId = Number(body.item_id || 0);
    const fromUom = String(body.from_uom || "").trim();
    const toUom = String(body.to_uom || "").trim();
    const conversionFactor = Number(body.conversion_factor);
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (
      !itemId ||
      !fromUom ||
      !toUom ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_id, from_uom, to_uom, conversion_factor (positive number) are required",
      );
    }
    const ins = await query(`
      INSERT INTO inv_unit_conversions (company_id, item_id, from_uom, to_uom, conversion_factor, is_active, created_by)
      VALUES (:companyId, :itemId, :fromUom, :toUom, :conversionFactor, :isActive, :userId)
      `,
      { companyId, itemId, fromUom, toUom, conversionFactor, isActive, userId },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

export const updateUnitConversion = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const id = Number(req.params.id);
    if (!Number.isFinite(id) || id <= 0)
      throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const body = req.body || {};
    const itemId = Number(body.item_id || 0);
    const fromUom = String(body.from_uom || "").trim();
    const toUom = String(body.to_uom || "").trim();
    const conversionFactor = Number(body.conversion_factor);
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (
      !itemId ||
      !fromUom ||
      !toUom ||
      !Number.isFinite(conversionFactor) ||
      conversionFactor <= 0
    ) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "item_id, from_uom, to_uom, conversion_factor (positive number) are required",
      );
    }
    const upd = await query(`
      UPDATE inv_unit_conversions
      SET item_id = :itemId,
          from_uom = :fromUom,
          to_uom = :toUom,
          conversion_factor = :conversionFactor,
          is_active = :isActive
      WHERE id = :id AND company_id = :companyId
      `,
      { id, companyId, itemId, fromUom, toUom, conversionFactor, isActive },
    );
    if (!upd.affectedRows)
      throw httpError(404, "NOT_FOUND", "Unit conversion not found");
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
};

export const listUoms = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(`
      SELECT u.*,
          u.created_at,
          uc.username AS created_by_name
         FROM inv_uoms u
        LEFT JOIN adm_users uc ON uc.id = u.created_by
         WHERE u.company_id = :companyId
      ORDER BY u.uom_name ASC
      `,
      { companyId },
    );
    res.json({ items: rows });
  } catch (err) {
    next(err);
  }
};

export const createUom = async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const body = req.body || {};
    const uomCode = String(body.uom_code || "").trim();
    const uomName = String(body.uom_name || "").trim();
    const uomType = String(body.uom_type || "COUNT").trim();
    const isActive = body.is_active === 0 || body.is_active === false ? 0 : 1;
    if (!uomCode || !uomName)
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "uom_code and uom_name are required",
      );
    const ins = await query(`
      INSERT INTO inv_uoms (company_id, uom_code, uom_name, uom_type, is_active)
      VALUES (:companyId, :uomCode, :uomName, :uomType, :isActive)
      `,
      { companyId, uomCode, uomName, uomType, isActive },
    );
    res.status(201).json({ id: ins.insertId });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getStockBalances
 * Fetches comprehensive item stock balances with warehouse breakdowns,
 * inventory valuation, batch information, and status levels.
 */
export const inv_getStockBalances = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { 
      warehouse_id, 
      warehouseId, 
      warehouse_type, 
      warehouseType, 
      item_type,
      itemType, 
      group_id,
      groupId,
      status, 
      search, 
      q,
      module
    } = req.query;

    const finalWhId = warehouse_id || warehouseId || null;
    const finalWhType = (warehouse_type || warehouseType || '').toUpperCase();
    const finalItemType = item_type || itemType || null;
    const finalGroupId = group_id || groupId || null;
    const finalSearch = String(search || q || '').trim().toLowerCase();
    const finalStatus = (status || '').toUpperCase();
    const finalModule = (module || '').toLowerCase();

    let sql = `
      SELECT 
        sb.id as balance_id,
        sb.item_id,
        sb.warehouse_id,
        sb.qty,
        COALESCE(sb.reserved_qty, 0) as reserved_qty,
        GREATEST(COALESCE(sb.qty, 0) - COALESCE(sb.reserved_qty, 0), 0) as available_qty,
        sb.batch_no,
        sb.serial_no,
        sb.expiry_date,
        sb.entry_date,
        sb.updated_at,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') as uom,
        COALESCE(i.cost_price, 0) as cost_price,
        COALESCE(i.selling_price, 0) as selling_price,
        COALESCE(i.reorder_level, 0) as reorder_level,
        COALESCE(i.min_stock_level, 0) as min_stock_level,
        COALESCE(i.max_stock_level, 0) as max_stock_level,
        i.item_type,
        i.is_production_item,
        ig.group_name,
        COALESCE(w.warehouse_name, pw.warehouse_name, 'General Warehouse') as warehouse_name,
        COALESCE(w.warehouse_code, pw.code, 'WH-GEN') as warehouse_code,
        CASE 
          WHEN pw.id IS NOT NULL THEN 'PRODUCTION'
          ELSE 'INVENTORY'
        END as warehouse_type,
        (COALESCE(sb.qty, 0) * COALESCE(i.cost_price, 0)) as total_stock_value
      FROM inv_stock_balances sb
      JOIN inv_items i ON sb.item_id = i.id
      LEFT JOIN inv_warehouses w ON sb.warehouse_id = w.id
      LEFT JOIN prod_warehouses pw ON sb.warehouse_id = pw.id
      LEFT JOIN inv_item_groups ig ON i.item_group_id = ig.id
      WHERE (sb.company_id = :companyId OR sb.company_id IS NULL)
    `;

    const params = { companyId };

    if (finalWhId) {
      sql += " AND sb.warehouse_id = :finalWhId";
      params.finalWhId = finalWhId;
    }

    if (finalWhType === 'PRODUCTION' || finalModule === 'production') {
      sql += " AND (pw.id IS NOT NULL OR i.is_production_item = 1 OR i.item_type IN ('RAW_MATERIAL', 'WIP', 'FINISHED_GOOD'))";
    } else if (finalWhType === 'INVENTORY') {
      sql += " AND pw.id IS NULL";
    }

    if (finalItemType) {
      sql += " AND i.item_type = :finalItemType";
      params.finalItemType = finalItemType;
    }

    if (finalGroupId) {
      sql += " AND i.item_group_id = :finalGroupId";
      params.finalGroupId = finalGroupId;
    }

    if (finalSearch) {
      sql += " AND (LOWER(i.item_name) LIKE :searchLike OR LOWER(i.item_code) LIKE :searchLike OR LOWER(COALESCE(sb.batch_no, '')) LIKE :searchLike OR LOWER(COALESCE(w.warehouse_name, pw.warehouse_name, '')) LIKE :searchLike)";
      params.searchLike = `%${finalSearch}%`;
    }

    if (finalStatus === 'LOW_STOCK') {
      sql += " AND sb.qty > 0 AND sb.qty <= COALESCE(i.reorder_level, 0)";
    } else if (finalStatus === 'OUT_OF_STOCK') {
      sql += " AND sb.qty <= 0";
    } else if (finalStatus === 'IN_STOCK') {
      sql += " AND sb.qty > 0";
    }

    sql += " ORDER BY sb.updated_at DESC, i.item_name ASC";

    const rows = await query(sql, params);

    // Compute stats
    let totalItems = 0;
    let totalQty = 0;
    let totalValue = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    const itemIdsSeen = new Set();

    (rows || []).forEach(r => {
      const qtyNum = Number(r.qty || 0);
      const costNum = Number(r.cost_price || 0);
      const reorderNum = Number(r.reorder_level || 0);

      totalQty += qtyNum;
      totalValue += qtyNum * costNum;
      if (!itemIdsSeen.has(r.item_id)) {
        itemIdsSeen.add(r.item_id);
        totalItems++;
      }

      if (qtyNum <= 0) {
        outOfStockCount++;
        r.health_status = 'OUT_OF_STOCK';
      } else if (reorderNum > 0 && qtyNum <= reorderNum) {
        lowStockCount++;
        r.health_status = 'LOW_STOCK';
      } else {
        r.health_status = 'ADEQUATE';
      }
    });

    res.json({
      items: rows || [],
      stats: {
        total_items: totalItems,
        total_qty: totalQty,
        total_value: totalValue,
        low_stock_count: lowStockCount,
        out_of_stock_count: outOfStockCount,
        total_records: rows.length
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getStockLedger
 * Fetches transaction history for an item across warehouses.
 */
export const inv_getStockLedger = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { itemId } = req.params;
    const { warehouseId } = req.query;

    let sql = `
      SELECT 
        l.*,
        i.item_code,
        i.item_name,
        COALESCE(i.uom, 'PCS') as uom,
        COALESCE(w.warehouse_name, pw.warehouse_name, 'General Warehouse') as warehouse_name,
        u.username as created_by_name
      FROM inv_stock_ledger l
      JOIN inv_items i ON l.item_id = i.id
      LEFT JOIN inv_warehouses w ON l.warehouse_id = w.id
      LEFT JOIN prod_warehouses pw ON l.warehouse_id = pw.id
      LEFT JOIN adm_users u ON l.created_by = u.id
      WHERE (l.company_id = :companyId OR l.company_id IS NULL)
        AND l.item_id = :itemId
    `;
    const params = { companyId, itemId };

    if (warehouseId) {
      sql += " AND l.warehouse_id = :warehouseId";
      params.warehouseId = warehouseId;
    }

    sql += " ORDER BY l.transaction_date DESC, l.id DESC LIMIT 100";

    const rows = await query(sql, params);
    res.json({ items: rows || [] });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getWarehouseStockSummary
 * Aggregates stock by warehouse.
 */
export const inv_getWarehouseStockSummary = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    const invWh = await query(
      `SELECT w.id, w.warehouse_name, w.warehouse_code, 'INVENTORY' as warehouse_type,
              COUNT(DISTINCT sb.item_id) as total_items,
              COALESCE(SUM(sb.qty), 0) as total_qty,
              COALESCE(SUM(sb.qty * i.cost_price), 0) as total_value
       FROM inv_warehouses w
       LEFT JOIN inv_stock_balances sb ON sb.warehouse_id = w.id
       LEFT JOIN inv_items i ON sb.item_id = i.id
       WHERE (w.company_id = :companyId OR w.company_id IS NULL)
       GROUP BY w.id, w.warehouse_name, w.warehouse_code`,
      { companyId }
    );

    const prodWh = await query(
      `SELECT pw.id, pw.warehouse_name, pw.code as warehouse_code, 'PRODUCTION' as warehouse_type,
              COUNT(DISTINCT sb.item_id) as total_items,
              COALESCE(SUM(sb.qty), 0) as total_qty,
              COALESCE(SUM(sb.qty * i.cost_price), 0) as total_value
       FROM prod_warehouses pw
       LEFT JOIN inv_stock_balances sb ON sb.warehouse_id = pw.id
       LEFT JOIN inv_items i ON sb.item_id = i.id
       WHERE (pw.company_id = :companyId OR pw.company_id IS NULL)
       GROUP BY pw.id, pw.warehouse_name, pw.code`,
      { companyId }
    );

    res.json({
      inventory_warehouses: invWh || [],
      production_warehouses: prodWh || [],
      all: [...(invWh || []), ...(prodWh || [])]
    });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getStockOverviewStats
 * Summary KPI numbers across all stock.
 */
export const inv_getStockOverviewStats = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;

    const stats = await query(
      `SELECT 
        COUNT(DISTINCT sb.item_id) as total_items,
        COALESCE(SUM(sb.qty), 0) as total_qty,
        COALESCE(SUM(sb.reserved_qty), 0) as total_reserved,
        COALESCE(SUM(sb.qty * i.cost_price), 0) as total_value,
        SUM(CASE WHEN sb.qty <= COALESCE(i.reorder_level, 0) AND sb.qty > 0 THEN 1 ELSE 0 END) as low_stock_count,
        SUM(CASE WHEN sb.qty <= 0 THEN 1 ELSE 0 END) as out_of_stock_count
       FROM inv_stock_balances sb
       JOIN inv_items i ON sb.item_id = i.id
       WHERE (sb.company_id = :companyId OR sb.company_id IS NULL)`,
      { companyId }
    );

    res.json(stats?.[0] || {
      total_items: 0,
      total_qty: 0,
      total_reserved: 0,
      total_value: 0,
      low_stock_count: 0,
      out_of_stock_count: 0
    });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getNextStockJournalNo
 * Returns the next formatted journal number (e.g., ISJ-000001)
 */
export const inv_getNextStockJournalNo = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const rows = await query(
      `SELECT journal_no FROM inv_stock_journals 
       WHERE company_id = :companyId 
       ORDER BY id DESC LIMIT 1`,
      { companyId }
    );
    let nextNum = 1;
    if (rows && rows.length > 0) {
      const match = String(rows[0].journal_no).match(/\d+/);
      if (match) {
        nextNum = parseInt(match[0], 10) + 1;
      }
    }
    const nextNo = `ISJ-${String(nextNum).padStart(6, '0')}`;
    res.json({ next_no: nextNo });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_listStockJournals
 * Lists inventory stock journal records with active base currency from fin_currencies.
 */
export const inv_listStockJournals = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { journal_type, search, warehouse_id } = req.query;

    let sql = `
      SELECT 
        j.*,
        sw.warehouse_name as source_warehouse_name,
        dw.warehouse_name as destination_warehouse_name,
        u.username as created_by_name,
        (SELECT COUNT(*) FROM inv_stock_journal_items WHERE journal_id = j.id) as item_count
      FROM inv_stock_journals j
      LEFT JOIN inv_warehouses sw ON j.source_warehouse_id = sw.id
      LEFT JOIN inv_warehouses dw ON j.destination_warehouse_id = dw.id
      LEFT JOIN adm_users u ON j.created_by = u.id
      WHERE (j.company_id = :companyId OR j.company_id IS NULL)
    `;
    const params = { companyId };

    if (journal_type && journal_type !== 'ALL') {
      sql += " AND j.journal_type = :journal_type";
      params.journal_type = journal_type;
    }

    if (warehouse_id && warehouse_id !== 'ALL') {
      sql += " AND (j.source_warehouse_id = :warehouse_id OR j.destination_warehouse_id = :warehouse_id)";
      params.warehouse_id = warehouse_id;
    }

    if (search) {
      sql += " AND (LOWER(j.journal_no) LIKE :searchLike OR LOWER(COALESCE(j.remarks, '')) LIKE :searchLike)";
      params.searchLike = `%${String(search).toLowerCase()}%`;
    }

    sql += " ORDER BY j.journal_date DESC, j.id DESC";

    const [rows, currRows] = await Promise.all([
      query(sql, params),
      query(
        `SELECT code, symbol, name FROM fin_currencies 
         WHERE (company_id = :companyId OR company_id IS NULL) AND is_base = 1 AND is_active = 1 
         LIMIT 1`,
        { companyId }
      ).catch(() => [])
    ]);

    const baseCurrency = currRows?.[0] || { code: "USD", symbol: "$", name: "US Dollar" };

    res.json({ 
      items: rows || [],
      currency: {
        code: baseCurrency.code,
        symbol: baseCurrency.symbol || baseCurrency.code || "$",
        name: baseCurrency.name
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_getStockJournalById
 * Fetches single journal voucher with all issue and receipt items and base currency.
 */
export const inv_getStockJournalById = async (req, res, next) => {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const { id } = req.params;

    const [journals, currRows] = await Promise.all([
      query(
        `SELECT 
          j.*,
          sw.warehouse_name as source_warehouse_name,
          dw.warehouse_name as destination_warehouse_name,
          u.username as created_by_name
         FROM inv_stock_journals j
         LEFT JOIN inv_warehouses sw ON j.source_warehouse_id = sw.id
         LEFT JOIN inv_warehouses dw ON j.destination_warehouse_id = dw.id
         LEFT JOIN adm_users u ON j.created_by = u.id
         WHERE (j.company_id = :companyId OR j.company_id IS NULL)
           AND j.id = :id`,
        { companyId, id }
      ),
      query(
        `SELECT code, symbol, name FROM fin_currencies 
         WHERE (company_id = :companyId OR company_id IS NULL) AND is_base = 1 AND is_active = 1 
         LIMIT 1`,
        { companyId }
      ).catch(() => [])
    ]);

    if (!journals || journals.length === 0) {
      throw httpError(404, "NOT_FOUND", "Stock journal not found");
    }

    const journal = journals[0];

    const items = await query(
      `SELECT 
        ji.*,
        i.item_code,
        i.item_name,
        COALESCE(ji.uom, i.uom, 'PCS') as uom,
        w.warehouse_name
       FROM inv_stock_journal_items ji
       JOIN inv_items i ON ji.item_id = i.id
       LEFT JOIN inv_warehouses w ON ji.warehouse_id = w.id
       WHERE ji.journal_id = :id
       ORDER BY ji.entry_type ASC, ji.id ASC`,
      { id }
    );

    journal.items = items || [];
    journal.issue_items = (items || []).filter(i => i.entry_type === 'ISSUE');
    journal.receipt_items = (items || []).filter(i => i.entry_type === 'RECEIPT');

    const baseCurrency = currRows?.[0] || { code: "USD", symbol: "$", name: "US Dollar" };

    res.json({ 
      journal,
      currency: {
        code: baseCurrency.code,
        symbol: baseCurrency.symbol || baseCurrency.code || "$",
        name: baseCurrency.name
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * inv_createStockJournal
 * Creates and posts an inventory stock journal voucher, updating balances & ledger.
 */
export const inv_createStockJournal = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const companyId = req.scope?.companyId || req.user?.company_id || req.user?.companyId || 1;
    const branchId = req.scope?.branchId || req.user?.branch_id || req.user?.branchId || 1;
    const userId = req.user?.id || 1;

    const {
      journal_no: userJournalNo,
      journal_type = 'GENERAL',
      journal_date = new Date().toISOString().split('T')[0],
      source_warehouse_id,
      destination_warehouse_id,
      remarks,
      items = []
    } = req.body;

    if (!items || items.length === 0) {
      throw httpError(400, "VALIDATION_ERROR", "Journal must contain at least one Stock Issue or Stock Receipt line item.");
    }

    // Determine journal number
    let journal_no = userJournalNo;
    if (!journal_no) {
      const [lastRow] = await conn.execute(
        "SELECT journal_no FROM inv_stock_journals WHERE company_id = ? ORDER BY id DESC LIMIT 1",
        [companyId]
      );
      let nextNum = 1;
      if (lastRow && lastRow.length > 0) {
        const match = String(lastRow[0].journal_no).match(/\d+/);
        if (match) nextNum = parseInt(match[0], 10) + 1;
      }
      journal_no = `ISJ-${String(nextNum).padStart(6, '0')}`;
    }

    let totalIssueQty = 0;
    let totalReceiptQty = 0;
    let totalValuation = 0;

    items.forEach(it => {
      const q = Number(it.qty || 0);
      const cost = Number(it.unit_cost || 0);
      if (it.entry_type === 'ISSUE') totalIssueQty += q;
      if (it.entry_type === 'RECEIPT') totalReceiptQty += q;
      totalValuation += q * cost;
    });

    const finalSrcWh = source_warehouse_id && Number(source_warehouse_id) > 0 ? Number(source_warehouse_id) : null;
    const finalDstWh = destination_warehouse_id && Number(destination_warehouse_id) > 0 ? Number(destination_warehouse_id) : null;
    const finalRemarks = remarks && String(remarks).trim() !== '' ? String(remarks).trim() : null;

    const [insertHeader] = await conn.execute(
      `INSERT INTO inv_stock_journals 
        (company_id, branch_id, journal_no, journal_type, journal_date, source_warehouse_id, destination_warehouse_id, remarks, total_issue_qty, total_receipt_qty, total_valuation, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
      [
        companyId,
        branchId,
        journal_no,
        journal_type,
        journal_date,
        finalSrcWh,
        finalDstWh,
        finalRemarks,
        totalIssueQty,
        totalReceiptQty,
        totalValuation,
        userId
      ]
    );

    const journalId = insertHeader.insertId;

    for (const item of items) {
      const entryType = (item.entry_type || 'ISSUE').toUpperCase();
      const itemId = Number(item.item_id);
      const whId = item.warehouse_id && Number(item.warehouse_id) > 0 
        ? Number(item.warehouse_id) 
        : (entryType === 'ISSUE' ? finalSrcWh : finalDstWh);
      const qtyNum = Number(item.qty || 0);
      const uomVal = item.uom && String(item.uom).trim() !== '' ? String(item.uom).trim() : 'PCS';
      const batchVal = item.batch_no && String(item.batch_no).trim() !== '' ? String(item.batch_no).trim() : null;
      const expiryVal = item.expiry_date && String(item.expiry_date).trim() !== '' ? item.expiry_date : null;
      const unitCost = Number(item.unit_cost || 0);
      const totalCost = qtyNum * unitCost;
      const itemRemarks = item.remarks && String(item.remarks).trim() !== '' ? String(item.remarks).trim() : null;

      // Insert line item
      await conn.execute(
        `INSERT INTO inv_stock_journal_items
          (journal_id, entry_type, item_id, warehouse_id, qty, uom, batch_no, expiry_date, unit_cost, total_cost, remarks)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [journalId, entryType, itemId, whId, qtyNum, uomVal, batchVal, expiryVal, unitCost, totalCost, itemRemarks]
      );

      // Update Stock Balances and Stock Ledger
      if (whId) {
        const qtyChange = entryType === 'ISSUE' ? -qtyNum : qtyNum;
        const txType = entryType === 'ISSUE' ? 'JOURNAL_ISSUE' : 'JOURNAL_RECEIPT';

        // Check existing balance
        const [existingBal] = await conn.execute(
          `SELECT id, qty FROM inv_stock_balances 
           WHERE company_id = ? AND warehouse_id = ? AND item_id = ?
           LIMIT 1`,
          [companyId, whId, itemId]
        );

        if (existingBal && existingBal.length > 0) {
          await conn.execute(
            `UPDATE inv_stock_balances 
             SET qty = qty + ?, updated_at = NOW()
             WHERE id = ?`,
            [qtyChange, existingBal[0].id]
          );
        } else {
          await conn.execute(
            `INSERT INTO inv_stock_balances 
              (company_id, branch_id, warehouse_id, item_id, qty, reserved_qty, batch_no, expiry_date, entry_date, source_type, source_id, created_by)
             VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)`,
            [companyId, branchId, whId, itemId, Math.max(0, qtyChange), batchVal, expiryVal, journal_date, txType, journalId, userId]
          );
        }

        // Record stock ledger transaction
        await conn.execute(
          `INSERT INTO inv_stock_ledger 
            (company_id, branch_id, warehouse_id, item_id, transaction_type, transaction_date, qty_change, batch_no, expiry_date, source_ref, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [companyId, branchId, whId, itemId, txType, journal_date, qtyChange, batchVal, expiryVal, journal_no, userId]
        );
      }
    }

    await conn.commit();
    res.json({ id: journalId, journal_no, message: `Inventory Stock Journal ${journal_no} posted successfully.` });
  } catch (err) {
    await conn.rollback();
    console.error("Error in inv_createStockJournal:", err);
    next(err);
  } finally {
    conn.release();
  }
};



