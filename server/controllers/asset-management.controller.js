import { pool, query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNum(v, fb = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fb;
}

/**
 * 1. ASSET STATISTICS & KPIS
 */
export async function getAssetStats(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [totals] = await pool.query(
      `SELECT 
        COUNT(*) AS total_assets,
        COALESCE(SUM(purchase_cost), 0) AS total_cost,
        COALESCE(SUM(accumulated_depreciation), 0) AS total_accum_dep,
        COALESCE(SUM(current_nbv), 0) AS total_nbv,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_count,
        COUNT(CASE WHEN status = 'FULLY_DEPRECIATED' THEN 1 END) AS fully_depreciated_count,
        COUNT(CASE WHEN status = 'DISPOSED' THEN 1 END) AS disposed_count
       FROM ast_assets
       WHERE company_id = ?`,
      [companyId || 1]
    );

    const [categories] = await pool.query(
      `SELECT c.category_name, COUNT(a.id) AS asset_count, COALESCE(SUM(a.current_nbv), 0) AS category_nbv
       FROM ast_asset_categories c
       LEFT JOIN ast_assets a ON a.category_id = c.id AND a.company_id = ?
       WHERE c.company_id = ? OR c.company_id = 1
       GROUP BY c.id, c.category_name
       ORDER BY category_nbv DESC`,
      [companyId || 1, companyId || 1]
    );

    res.json({
      success: true,
      stats: totals[0] || {
        total_assets: 0,
        total_cost: 0,
        total_accum_dep: 0,
        total_nbv: 0,
        active_count: 0,
        fully_depreciated_count: 0,
        disposed_count: 0,
      },
      categories,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 2. ASSET REGISTER (LIST & DETAILS)
 */
export async function listAssets(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { categoryId, branchId, status, search } = req.query;

    const conditions = ["a.company_id = ?"];
    const params = [companyId || 1];

    if (categoryId) {
      conditions.push("a.category_id = ?");
      params.push(categoryId);
    }
    if (branchId) {
      conditions.push("a.branch_id = ?");
      params.push(branchId);
    }
    if (status) {
      conditions.push("a.status = ?");
      params.push(status);
    }
    if (search) {
      conditions.push("(a.asset_code LIKE ? OR a.asset_name LIKE ? OR a.serial_number LIKE ? OR a.barcode LIKE ?)");
      const term = `%${search}%`;
      params.push(term, term, term, term);
    }

    const sql = `
      SELECT 
        a.*,
        c.category_name,
        c.category_code,
        b.name AS branch_name,
        p.property_name,
        s.space_name
      FROM ast_assets a
      LEFT JOIN ast_asset_categories c ON c.id = a.category_id
      LEFT JOIN adm_branches b ON b.id = a.branch_id
      LEFT JOIN fm_properties p ON p.id = a.property_id
      LEFT JOIN fm_spaces s ON s.id = a.space_id
      WHERE ${conditions.join(" AND ")}
      ORDER BY a.id DESC
    `;

    const items = await query(sql, params);
    res.json({ success: true, items, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getAssetById(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const [assets] = await pool.query(
      `SELECT a.*, c.category_name, c.category_code, b.name AS branch_name, p.property_name, s.space_name
       FROM ast_assets a
       LEFT JOIN ast_asset_categories c ON c.id = a.category_id
       LEFT JOIN adm_branches b ON b.id = a.branch_id
       LEFT JOIN fm_properties p ON p.id = a.property_id
       LEFT JOIN fm_spaces s ON s.id = a.space_id
       WHERE a.id = ? AND a.company_id = ?`,
      [id, companyId || 1]
    );

    if (!assets || assets.length === 0) {
      return res.status(404).json({ success: false, message: "Asset not found" });
    }

    const [transfers] = await pool.query(
      `SELECT * FROM ast_asset_transfers WHERE asset_id = ? ORDER BY transfer_date DESC`,
      [id]
    );

    const [depreciationHistory] = await pool.query(
      `SELECT i.*, r.run_no, r.period_year, r.period_month, r.run_date
       FROM ast_depreciation_run_items i
       JOIN ast_depreciation_runs r ON r.id = i.run_id
       WHERE i.asset_id = ?
       ORDER BY r.period_year DESC, r.period_month DESC`,
      [id]
    );

    res.json({
      success: true,
      asset: assets[0],
      data: assets[0],
      transfers,
      depreciationHistory,
    });
  } catch (err) {
    next(err);
  }
}

export async function createAsset(req, res, next) {
  try {
    const { companyId, branchId: scopeBranchId } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || null;
    const body = req.body || {};

    const branchId = toNum(body.branch_id || scopeBranchId, 1);
    const categoryId = toNum(body.category_id);
    if (!categoryId) {
      throw httpError(400, "VALIDATION_ERROR", "Category is required");
    }

    // Lookup Category Defaults
    const [catRows] = await pool.query("SELECT * FROM ast_asset_categories WHERE id = ?", [categoryId]);
    const cat = catRows[0] || {};

    // Auto-generate asset code if not supplied
    let assetCode = body.asset_code ? String(body.asset_code).trim() : "";
    if (!assetCode) {
      const prefix = cat.category_code ? cat.category_code.slice(0, 4).toUpperCase() : "AST";
      const [seq] = await pool.query(
        "SELECT COUNT(*) AS total FROM ast_assets WHERE company_id = ?",
        [companyId || 1]
      );
      const nextNum = (seq[0]?.total || 0) + 1;
      assetCode = `${prefix}-${String(nextNum).padStart(5, "0")}`;
    }

    const purchaseCost = toNum(body.purchase_cost, 0);
    const salvageValue = toNum(body.salvage_value, 0);
    const initialAccumDep = toNum(body.accumulated_depreciation, 0);
    const initialNBV = purchaseCost - initialAccumDep;

    const depMethod = body.depreciation_method || cat.depreciation_method || "STRAIGHT_LINE";
    const usefulLife = toNum(body.useful_life_years || cat.useful_life_years, 5);
    const depRate = toNum(body.depreciation_rate_pct || cat.depreciation_rate_pct, 20);

    const [result] = await pool.query(
      `INSERT INTO ast_assets (
        company_id, branch_id, asset_code, asset_name, category_id,
        property_id, building_id, space_id, location, department_id,
        custodian_id, custodian_name, serial_number, barcode, make, model,
        purchase_date, capitalization_date, purchase_cost, salvage_value,
        current_nbv, accumulated_depreciation, depreciation_method,
        useful_life_years, depreciation_rate_pct, warranty_expiry_date,
        status, notes, created_by
      ) VALUES (
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?
      )`,
      [
        companyId || 1,
        branchId,
        assetCode,
        body.asset_name || "Unnamed Asset",
        categoryId,
        body.property_id || null,
        body.building_id || null,
        body.space_id || null,
        body.location || null,
        body.department_id || null,
        body.custodian_id || null,
        body.custodian_name || null,
        body.serial_number || null,
        body.barcode || assetCode,
        body.make || null,
        body.model || null,
        body.purchase_date || null,
        body.capitalization_date || new Date().toISOString().slice(0, 10),
        purchaseCost,
        salvageValue,
        initialNBV,
        initialAccumDep,
        depMethod,
        usefulLife,
        depRate,
        body.warranty_expiry_date || null,
        body.status || "ACTIVE",
        body.notes || null,
        userId,
      ]
    );

    res.status(201).json({
      success: true,
      id: result.insertId,
      asset_code: assetCode,
      message: "Asset created successfully",
    });
  } catch (err) {
    next(err);
  }
}

export async function updateAsset(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const body = req.body || {};

    const purchaseCost = toNum(body.purchase_cost);
    const salvageValue = toNum(body.salvage_value);
    const accumDep = toNum(body.accumulated_depreciation);
    const currentNBV = purchaseCost - accumDep;

    await pool.query(
      `UPDATE ast_assets SET
        asset_name = COALESCE(?, asset_name),
        category_id = COALESCE(?, category_id),
        branch_id = COALESCE(?, branch_id),
        property_id = ?,
        building_id = ?,
        space_id = ?,
        location = ?,
        custodian_name = ?,
        serial_number = ?,
        barcode = ?,
        make = ?,
        model = ?,
        purchase_date = ?,
        capitalization_date = COALESCE(?, capitalization_date),
        purchase_cost = ?,
        salvage_value = ?,
        current_nbv = ?,
        accumulated_depreciation = ?,
        depreciation_method = COALESCE(?, depreciation_method),
        useful_life_years = COALESCE(?, useful_life_years),
        depreciation_rate_pct = COALESCE(?, depreciation_rate_pct),
        warranty_expiry_date = ?,
        status = COALESCE(?, status),
        notes = ?
       WHERE id = ? AND company_id = ?`,
      [
        body.asset_name,
        body.category_id,
        body.branch_id,
        body.property_id || null,
        body.building_id || null,
        body.space_id || null,
        body.location || null,
        body.custodian_name || null,
        body.serial_number || null,
        body.barcode || null,
        body.make || null,
        body.model || null,
        body.purchase_date || null,
        body.capitalization_date,
        purchaseCost,
        salvageValue,
        currentNBV,
        accumDep,
        body.depreciation_method,
        body.useful_life_years,
        body.depreciation_rate_pct,
        body.warranty_expiry_date || null,
        body.status,
        body.notes || null,
        id,
        companyId || 1,
      ]
    );

    res.json({ success: true, message: "Asset updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteAsset(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    // Check if depreciation exists
    const [depCheck] = await pool.query(
      "SELECT COUNT(*) AS c FROM ast_depreciation_run_items WHERE asset_id = ?",
      [id]
    );
    if (depCheck[0]?.c > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot delete asset with posted depreciation history. Consider marking it as DISPOSED instead.",
      });
    }

    await pool.query("DELETE FROM ast_assets WHERE id = ? AND company_id = ?", [id, companyId || 1]);
    res.json({ success: true, message: "Asset deleted successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * 3. ASSET CATEGORIES CRUD
 */
export async function listCategories(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [categories] = await pool.query(
      `SELECT c.*, 
        c.useful_life_years AS default_useful_life_years,
        c.depreciation_rate_pct AS default_depreciation_rate,
        c.asset_cost_account_id AS gl_asset_cost_account_id,
        c.accum_depreciation_account_id AS gl_accum_depreciation_account_id,
        c.depreciation_expense_account_id AS gl_depreciation_expense_account_id,
        c.gain_loss_account_id AS gl_gain_loss_account_id,
        fa_cost.code AS cost_account_code, fa_cost.name AS cost_account_name,
        fa_accum.code AS accum_account_code, fa_accum.name AS accum_account_name,
        fa_exp.code AS expense_account_code, fa_exp.name AS expense_account_name,
        fa_gl.code AS gain_loss_account_code, fa_gl.name AS gain_loss_account_name,
        (SELECT COUNT(*) FROM ast_assets a WHERE a.category_id = c.id) AS asset_count
       FROM ast_asset_categories c
       LEFT JOIN fin_accounts fa_cost ON fa_cost.id = c.asset_cost_account_id
       LEFT JOIN fin_accounts fa_accum ON fa_accum.id = c.accum_depreciation_account_id
       LEFT JOIN fin_accounts fa_exp ON fa_exp.id = c.depreciation_expense_account_id
       LEFT JOIN fin_accounts fa_gl ON fa_gl.id = c.gain_loss_account_id
       WHERE c.company_id = ? OR c.company_id = 1
       ORDER BY c.category_name ASC`,
      [companyId || 1]
    );
    res.json({ success: true, items: categories, data: categories });
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const body = req.body || {};

    if (!body.category_name || !body.category_name.trim()) {
      throw httpError(400, "VALIDATION_ERROR", "Category Name is required");
    }

    // System-generated category code
    let categoryCode = (body.category_code || "").toUpperCase().trim();
    if (!categoryCode) {
      const clean = body.category_name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const prefix = clean.slice(0, 4) || "CAT";
      categoryCode = `${prefix}-${Date.now().toString().slice(-4)}`;
    }

    const [result] = await pool.query(
      `INSERT INTO ast_asset_categories (
        company_id, category_code, category_name, depreciation_method,
        depreciation_frequency, useful_life_years, depreciation_rate_pct,
        asset_cost_account_id, accum_depreciation_account_id,
        depreciation_expense_account_id, gain_loss_account_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        categoryCode,
        body.category_name.trim(),
        body.depreciation_method || "STRAIGHT_LINE",
        body.depreciation_frequency || "YEARLY",
        toNum(body.useful_life_years ?? body.default_useful_life_years, 5),
        toNum(body.depreciation_rate_pct ?? body.default_depreciation_rate, 20),
        toNum(body.asset_cost_account_id ?? body.gl_asset_cost_account_id) || null,
        toNum(body.accum_depreciation_account_id ?? body.gl_accum_depreciation_account_id) || null,
        toNum(body.depreciation_expense_account_id ?? body.gl_depreciation_expense_account_id) || null,
        toNum(body.gain_loss_account_id ?? body.gl_gain_loss_account_id) || null,
      ]
    );

    res.status(201).json({ success: true, id: result.insertId, category_code: categoryCode });
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const body = req.body || {};

    await pool.query(
      `UPDATE ast_asset_categories SET
        category_name = COALESCE(?, category_name),
        depreciation_method = COALESCE(?, depreciation_method),
        depreciation_frequency = COALESCE(?, depreciation_frequency),
        useful_life_years = COALESCE(?, useful_life_years),
        depreciation_rate_pct = COALESCE(?, depreciation_rate_pct),
        asset_cost_account_id = ?,
        accum_depreciation_account_id = ?,
        depreciation_expense_account_id = ?,
        gain_loss_account_id = ?,
        is_active = COALESCE(?, is_active)
       WHERE id = ?`,
      [
        body.category_name,
        body.depreciation_method,
        body.depreciation_frequency,
        body.useful_life_years ?? body.default_useful_life_years,
        body.depreciation_rate_pct ?? body.default_depreciation_rate,
        toNum(body.asset_cost_account_id ?? body.gl_asset_cost_account_id) || null,
        toNum(body.accum_depreciation_account_id ?? body.gl_accum_depreciation_account_id) || null,
        toNum(body.depreciation_expense_account_id ?? body.gl_depreciation_expense_account_id) || null,
        toNum(body.gain_loss_account_id ?? body.gl_gain_loss_account_id) || null,
        body.is_active,
        id,
      ]
    );

    res.json({ success: true, message: "Category updated" });
  } catch (err) {
    next(err);
  }
}

function getDivisorForFrequency(freq) {
  switch ((freq || "").toUpperCase()) {
    case "HALF_YEARLY":
      return 2;
    case "QUARTERLY":
      return 4;
    case "MONTHLY":
      return 12;
    case "YEARLY":
    default:
      return 1;
  }
}

/**
 * 4. AUTOMATED DEPRECIATION ENGINE
 */
export async function calculateDepreciationPreview(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const year = toNum(req.query.year || req.query.period_year, new Date().getFullYear());
    const month = toNum(req.query.month || req.query.period_month, new Date().getMonth() + 1);
    const runFrequency = (req.query.frequency || req.query.period_type || "").toUpperCase();

    // Period end date
    const periodEndStr = `${year}-${String(month).padStart(2, "0")}-28`;

    // Fetch active depreciable assets
    const [assets] = await pool.query(
      `SELECT a.*, 
        c.category_name, 
        COALESCE(a.depreciation_frequency, c.depreciation_frequency, 'YEARLY') AS effective_frequency,
        c.depreciation_expense_account_id, 
        c.accum_depreciation_account_id
       FROM ast_assets a
       JOIN ast_asset_categories c ON c.id = a.category_id
       WHERE a.company_id = ? 
         AND a.status = 'ACTIVE'
         AND a.capitalization_date <= ?
         AND (a.current_nbv - a.salvage_value) > 0.01`,
      [companyId || 1, periodEndStr]
    );

    // Check if run already exists for this period
    const [existingRun] = await pool.query(
      `SELECT id, run_no FROM ast_depreciation_runs WHERE company_id = ? AND period_year = ? AND period_month = ?`,
      [companyId || 1, year, month]
    );

    let totalAmount = 0;
    const items = [];

    for (const a of assets) {
      const costBasis = toNum(a.purchase_cost);
      const salvage = toNum(a.salvage_value);
      const priorAccum = toNum(a.accumulated_depreciation);
      const currentNBV = toNum(a.current_nbv);
      const usefulYears = toNum(a.useful_life_years, 5);
      const ratePct = toNum(a.depreciation_rate_pct, 20);
      const method = a.depreciation_method || "STRAIGHT_LINE";
      const effectiveFreq = runFrequency || a.effective_frequency || "YEARLY";
      const divisor = getDivisorForFrequency(effectiveFreq);

      let charge = 0;
      if (method === "STRAIGHT_LINE") {
        charge = (costBasis - salvage) / (usefulYears * divisor);
      } else if (method === "REDUCING_BALANCE") {
        charge = (currentNBV * (ratePct / 100)) / divisor;
      } else if (method === "DOUBLE_DECLINING") {
        charge = (currentNBV * (2 / usefulYears)) / divisor;
      }

      // Max allowable charge is current_nbv - salvage
      const maxAllowable = Math.max(0, currentNBV - salvage);
      const finalCharge = Math.min(charge, maxAllowable);

      if (finalCharge > 0) {
        const roundedCharge = Math.round(finalCharge * 100) / 100;
        const newAccum = Math.round((priorAccum + roundedCharge) * 100) / 100;
        const newNBV = Math.round((costBasis - newAccum) * 100) / 100;

        totalAmount += roundedCharge;
        items.push({
          asset_id: a.id,
          asset_code: a.asset_code,
          asset_name: a.asset_name,
          category_name: a.category_name,
          method,
          purchase_cost: costBasis,
          cost_basis: costBasis,
          prior_accum_depreciation: priorAccum,
          accumulated_depreciation_before: priorAccum,
          depreciation_amount: roundedCharge,
          new_accum_depreciation: newAccum,
          new_nbv: newNBV,
          nbv_before: currentNBV,
          nbv_after: newNBV,
          expense_account_id: a.depreciation_expense_account_id,
          accum_account_id: a.accum_depreciation_account_id,
        });
      }
    }

    const totalDep = Math.round(totalAmount * 100) / 100;
    const totalNbvBefore = Math.round(items.reduce((s, i) => s + Number(i.nbv_before || 0), 0) * 100) / 100;
    const totalNbvAfter = Math.round(items.reduce((s, i) => s + Number(i.nbv_after || 0), 0) * 100) / 100;

    res.json({
      success: true,
      period: { year, month },
      alreadyRun: existingRun.length > 0 ? existingRun[0] : null,
      total_depreciation: totalDep,
      assets_count: items.length,
      items,
      data: {
        total_assets: items.length,
        total_depreciation_amount: totalDep,
        total_nbv_before: totalNbvBefore,
        total_nbv_after: totalNbvAfter,
        preview_lines: items,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function postDepreciationRun(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId: scopeBranchId } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || null;
    const year = toNum(req.body.year || req.body.period_year);
    const month = toNum(req.body.month || req.body.period_month);
    const runFrequency = (req.body.frequency || req.body.period_type || "").toUpperCase();
    let items = req.body.items || [];

    if (!year || !month) {
      throw httpError(400, "VALIDATION_ERROR", "Year and month are required");
    }

    await conn.beginTransaction();

    // Check if already posted
    const [existing] = await conn.execute(
      "SELECT id, run_no FROM ast_depreciation_runs WHERE company_id = ? AND period_year = ? AND period_month = ?",
      [companyId || 1, year, month]
    );
    if (existing.length > 0) {
      throw httpError(409, "DUPLICATE_RUN", `Depreciation for ${year}-${String(month).padStart(2, "0")} is already posted (${existing[0].run_no})`);
    }

    // If items were not sent directly, compute them from current active assets
    if (!items || items.length === 0) {
      const periodEndStr = `${year}-${String(month).padStart(2, "0")}-28`;
      const [assets] = await conn.query(
        `SELECT a.*, 
          c.category_name, 
          COALESCE(a.depreciation_frequency, c.depreciation_frequency, 'YEARLY') AS effective_frequency,
          c.depreciation_expense_account_id, 
          c.accum_depreciation_account_id
         FROM ast_assets a
         JOIN ast_asset_categories c ON c.id = a.category_id
         WHERE a.company_id = ? 
           AND a.status = 'ACTIVE'
           AND a.capitalization_date <= ?
           AND (a.current_nbv - a.salvage_value) > 0.01`,
        [companyId || 1, periodEndStr]
      );

      for (const a of assets) {
        const costBasis = toNum(a.purchase_cost);
        const salvage = toNum(a.salvage_value);
        const priorAccum = toNum(a.accumulated_depreciation);
        const currentNBV = toNum(a.current_nbv);
        const usefulYears = toNum(a.useful_life_years, 5);
        const ratePct = toNum(a.depreciation_rate_pct, 20);
        const method = a.depreciation_method || "STRAIGHT_LINE";
        const effectiveFreq = runFrequency || a.effective_frequency || "YEARLY";
        const divisor = getDivisorForFrequency(effectiveFreq);

        let charge = 0;
        if (method === "STRAIGHT_LINE") {
          charge = (costBasis - salvage) / (usefulYears * divisor);
        } else if (method === "REDUCING_BALANCE") {
          charge = (currentNBV * (ratePct / 100)) / divisor;
        } else if (method === "DOUBLE_DECLINING") {
          charge = (currentNBV * (2 / usefulYears)) / divisor;
        }

        const maxAllowable = Math.max(0, currentNBV - salvage);
        const finalCharge = Math.min(charge, maxAllowable);

        if (finalCharge > 0) {
          const roundedCharge = Math.round(finalCharge * 100) / 100;
          const newAccum = Math.round((priorAccum + roundedCharge) * 100) / 100;
          const newNBV = Math.round((costBasis - newAccum) * 100) / 100;
          items.push({
            asset_id: a.id,
            asset_code: a.asset_code,
            asset_name: a.asset_name,
            cost_basis: costBasis,
            prior_accum_depreciation: priorAccum,
            depreciation_amount: roundedCharge,
            new_accum_depreciation: newAccum,
            new_nbv: newNBV,
            expense_account_id: a.depreciation_expense_account_id,
            accum_account_id: a.accum_depreciation_account_id,
          });
        }
      }
    }

    const runPrefix = runFrequency === "YEARLY" ? `DEP-YR${year}` : `DEP-${year}${String(month).padStart(2, "0")}`;
    const runNo = `${runPrefix}-${Date.now().toString().slice(-4)}`;
    const runDate = `${year}-${String(month).padStart(2, "0")}-28`;

    let totalAmount = 0;
    items.forEach((it) => {
      totalAmount += toNum(it.depreciation_amount);
    });

    // 1. Create Depreciation Run Record
    const [runRes] = await conn.execute(
      `INSERT INTO ast_depreciation_runs (
        company_id, branch_id, run_no, run_date, period_year, period_month,
        total_depreciation, assets_count, status, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
      [
        companyId || 1,
        toNum(scopeBranchId, 1),
        runNo,
        runDate,
        year,
        month,
        totalAmount,
        items.length,
        userId,
      ]
    );
    const runId = runRes.insertId;

    // 2. Insert items and update assets
    for (const it of items) {
      const depAmount = toNum(it.depreciation_amount);
      const newAccum = toNum(it.new_accum_depreciation);
      const newNBV = toNum(it.new_nbv);

      await conn.execute(
        `INSERT INTO ast_depreciation_run_items (
          run_id, asset_id, asset_code, asset_name, cost_basis,
          prior_accum_depreciation, depreciation_amount, new_accum_depreciation, new_nbv
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          runId,
          it.asset_id,
          it.asset_code,
          it.asset_name,
          toNum(it.cost_basis),
          toNum(it.prior_accum_depreciation),
          depAmount,
          newAccum,
          newNBV,
        ]
      );

      // Update asset
      await conn.execute(
        `UPDATE ast_assets SET
          accumulated_depreciation = ?,
          current_nbv = ?,
          status = CASE WHEN ? <= salvage_value THEN 'FULLY_DEPRECIATED' ELSE status END
         WHERE id = ?`,
        [newAccum, newNBV, newNBV, it.asset_id]
      );
    }

    // 3. Post to General Ledger as a Journal Voucher (JV)
    try {
      const [jvType] = await conn.execute(
        "SELECT id FROM fin_voucher_types WHERE code = 'JV' OR category = 'JOURNAL' LIMIT 1"
      );
      const voucherTypeId = jvType[0]?.id || 4;
      const voucherNo = `JV-${runNo}`;

      // Pick default automated GL accounts if not mapped
      const [expenseAcc] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE (code = '5024' OR name LIKE '%Depreciation Expense%') AND is_active = 1 LIMIT 1"
      ).catch(() => [[]]);
      const [accumAcc] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE (code = '1099' OR name LIKE '%Accumulated Depreciation%') AND is_active = 1 LIMIT 1"
      ).catch(() => [[]]);

      const defaultExpenseAccountId = expenseAcc[0]?.id || 47;
      const defaultAccumAccountId = accumAcc[0]?.id || 193;

      const [voucherRes] = await conn.execute(
        `INSERT INTO fin_vouchers (
          company_id, branch_id, voucher_type_id, voucher_no, voucher_date,
          narration, total_debit, total_credit, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
        [
          companyId || 1,
          toNum(scopeBranchId, 1),
          voucherTypeId,
          voucherNo,
          runDate,
          `Automated Asset Depreciation for ${year}-${String(month).padStart(2, "0")} (${items.length} assets)`,
          totalAmount,
          totalAmount,
          userId,
        ]
      );
      const voucherId = voucherRes.insertId;

      // Group by expense_account_id & accum_account_id
      const accountPairs = new Map();
      for (const it of items) {
        const expId = toNum(it.expense_account_id) || defaultExpenseAccountId;
        const accId = toNum(it.accum_account_id) || defaultAccumAccountId;
        const key = `${expId}-${accId}`;
        const prev = accountPairs.get(key) || { expId, accId, amount: 0 };
        prev.amount += toNum(it.depreciation_amount);
        accountPairs.set(key, prev);
      }

      let lineNo = 1;
      if (accountPairs.size > 0) {
        for (const pair of accountPairs.values()) {
          const roundedPairAmt = Math.round(pair.amount * 100) / 100;
          if (roundedPairAmt <= 0) continue;
          // Debit Expense
          await conn.execute(
            `INSERT INTO fin_voucher_lines (
              company_id, voucher_id, line_no, account_id, description, debit, credit, created_by
            ) VALUES (?, ?, ?, ?, ?, ?, 0, ?)`,
            [companyId || 1, voucherId, lineNo++, pair.expId, `Depreciation Expense - ${runNo}`, roundedPairAmt, userId]
          );
          // Credit Accumulated Depreciation
          await conn.execute(
            `INSERT INTO fin_voucher_lines (
              company_id, voucher_id, line_no, account_id, description, debit, credit, created_by
            ) VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
            [companyId || 1, voucherId, lineNo++, pair.accId, `Accumulated Depreciation - ${runNo}`, roundedPairAmt, userId]
          );
        }
      } else {
        // Fallback lines
        await conn.execute(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description, debit, credit, created_by
          ) VALUES (?, ?, 1, ?, ?, ?, 0, ?)`,
          [companyId || 1, voucherId, defaultExpenseAccountId, `Depreciation Expense - ${runNo}`, totalAmount, userId]
        );
        await conn.execute(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description, debit, credit, created_by
          ) VALUES (?, ?, 2, ?, ?, 0, ?, ?)`,
          [companyId || 1, voucherId, defaultAccumAccountId, `Accumulated Depreciation - ${runNo}`, totalAmount, userId]
        );
      }

      // Link voucher to run
      await conn.execute("UPDATE ast_depreciation_runs SET voucher_id = ? WHERE id = ?", [voucherId, runId]);
    } catch (glErr) {
      console.warn("[Asset Management] GL Voucher generation note:", glErr.message);
    }

    await conn.commit();
    res.json({
      success: true,
      run_no: runNo,
      total_depreciation: totalAmount,
      assets_processed: items.length,
      message: `Successfully posted depreciation for ${items.length} assets`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function listDepreciationRuns(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [runs] = await pool.query(
      `SELECT r.*, 
              r.run_no AS run_code,
              r.assets_count AS total_assets_processed,
              r.total_depreciation AS total_depreciation_amount,
              v.voucher_no AS gl_voucher_number,
              u.username AS created_by_name
       FROM ast_depreciation_runs r
       LEFT JOIN fin_vouchers v ON v.id = r.voucher_id
       LEFT JOIN adm_users u ON u.id = r.created_by
       WHERE r.company_id = ?
       ORDER BY r.period_year DESC, r.period_month DESC, r.id DESC`,
      [companyId || 1]
    );
    res.json({ success: true, items: runs, data: runs });
  } catch (err) {
    next(err);
  }
}

/**
 * 5. ASSET TRANSFERS
 */
export async function listAssetTransfers(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [transfers] = await pool.query(
      `SELECT t.*, a.asset_code, a.asset_name, fb.name AS from_branch, tb.name AS to_branch
       FROM ast_asset_transfers t
       JOIN ast_assets a ON a.id = t.asset_id
       LEFT JOIN adm_branches fb ON fb.id = t.from_branch_id
       LEFT JOIN adm_branches tb ON tb.id = t.to_branch_id
       WHERE t.company_id = ?
       ORDER BY t.transfer_date DESC, t.id DESC`,
      [companyId || 1]
    );
    res.json({ success: true, items: transfers, data: transfers });
  } catch (err) {
    next(err);
  }
}

export async function createAssetTransfer(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || null;
    const body = req.body || {};

    const assetId = toNum(body.asset_id);
    if (!assetId) throw httpError(400, "VALIDATION_ERROR", "Asset is required");

    // Fetch current asset location
    const [assetRows] = await pool.query("SELECT * FROM ast_assets WHERE id = ?", [assetId]);
    if (!assetRows.length) throw httpError(404, "NOT_FOUND", "Asset not found");
    const asset = assetRows[0];

    const transferNo = `TRF-${Date.now().toString().slice(-6)}`;
    const transferDate = body.transfer_date || new Date().toISOString().slice(0, 10);

    await pool.query(
      `INSERT INTO ast_asset_transfers (
        company_id, transfer_no, asset_id, transfer_date,
        from_branch_id, to_branch_id, from_property_id, to_property_id,
        from_space_id, to_space_id, from_location, to_location,
        from_custodian_name, to_custodian_name, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        transferNo,
        assetId,
        transferDate,
        asset.branch_id,
        body.to_branch_id || asset.branch_id,
        asset.property_id,
        body.to_property_id || null,
        asset.space_id,
        body.to_space_id || null,
        asset.location,
        body.to_location || null,
        asset.custodian_name,
        body.to_custodian_name || null,
        body.reason || null,
        userId,
      ]
    );

    // Update asset
    await pool.query(
      `UPDATE ast_assets SET
        branch_id = COALESCE(?, branch_id),
        property_id = ?,
        space_id = ?,
        location = COALESCE(?, location),
        custodian_name = COALESCE(?, custodian_name)
       WHERE id = ?`,
      [
        body.to_branch_id,
        body.to_property_id || null,
        body.to_space_id || null,
        body.to_location,
        body.to_custodian_name,
        assetId,
      ]
    );

    res.status(201).json({ success: true, transfer_no: transferNo, message: "Transfer logged successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * 6. ASSET DISPOSALS
 */
export async function listAssetDisposals(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [disposals] = await pool.query(
      `SELECT d.*, a.asset_code, a.asset_name, c.category_name
       FROM ast_asset_disposals d
       JOIN ast_assets a ON a.id = d.asset_id
       LEFT JOIN ast_asset_categories c ON c.id = a.category_id
       WHERE d.company_id = ?
       ORDER BY d.disposal_date DESC, d.id DESC`,
      [companyId || 1]
    );
    res.json({ success: true, items: disposals, data: disposals });
  } catch (err) {
    next(err);
  }
}

export async function createAssetDisposal(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || null;
    const body = req.body || {};

    const assetId = toNum(body.asset_id);
    if (!assetId) throw httpError(400, "VALIDATION_ERROR", "Asset is required");

    const [assetRows] = await pool.query("SELECT * FROM ast_assets WHERE id = ?", [assetId]);
    if (!assetRows.length) throw httpError(404, "NOT_FOUND", "Asset not found");
    const asset = assetRows[0];

    const saleProceeds = toNum(body.sale_proceeds, 0);
    const costAtDisposal = toNum(asset.purchase_cost);
    const accumAtDisposal = toNum(asset.accumulated_depreciation);
    const nbvAtDisposal = toNum(asset.current_nbv);
    const gainLoss = saleProceeds - nbvAtDisposal;

    const disposalNo = `DSP-${Date.now().toString().slice(-6)}`;
    const disposalDate = body.disposal_date || new Date().toISOString().slice(0, 10);

    const [dispRes] = await pool.query(
      `INSERT INTO ast_asset_disposals (
        company_id, disposal_no, asset_id, disposal_date, disposal_type,
        sale_proceeds, cost_at_disposal, accum_dep_at_disposal, nbv_at_disposal,
        gain_loss, buyer_name, reason, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        disposalNo,
        assetId,
        disposalDate,
        body.disposal_type || "SALE",
        saleProceeds,
        costAtDisposal,
        accumAtDisposal,
        nbvAtDisposal,
        gainLoss,
        body.buyer_name || null,
        body.reason || null,
        userId,
      ]
    );

    // Update asset status to DISPOSED
    await pool.query(
      `UPDATE ast_assets SET status = 'DISPOSED', current_nbv = 0 WHERE id = ?`,
      [assetId]
    );

    res.status(201).json({
      success: true,
      disposal_no: disposalNo,
      gain_loss: gainLoss,
      message: `Asset marked as disposed with a ${gainLoss >= 0 ? "gain" : "loss"} of GHS ${Math.abs(gainLoss).toLocaleString()}`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. FIXED ASSET SCHEDULE REPORT (STATUTORY AUDIT NOTE)
 */
export async function getFixedAssetScheduleReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const year = toNum(req.query.year, new Date().getFullYear());

    const [categories] = await pool.query(
      `SELECT 
        c.id AS category_id,
        c.category_code,
        c.category_name,
        c.depreciation_method,
        c.useful_life_years,
        COUNT(a.id) AS total_assets,
        COALESCE(SUM(a.purchase_cost), 0) AS gross_cost,
        COALESCE(SUM(CASE WHEN a.status = 'DISPOSED' THEN a.purchase_cost ELSE 0 END), 0) AS disposed_cost,
        COALESCE(SUM(a.accumulated_depreciation), 0) AS accumulated_depreciation,
        COALESCE(SUM(a.current_nbv), 0) AS net_book_value
       FROM ast_asset_categories c
       LEFT JOIN ast_assets a ON a.category_id = c.id AND a.company_id = ?
       WHERE c.company_id = ? OR c.company_id = 1
       GROUP BY c.id, c.category_code, c.category_name, c.depreciation_method, c.useful_life_years
       ORDER BY c.category_name ASC`,
      [companyId || 1, companyId || 1]
    );

    const reportRows = categories.map((cat) => {
      const grossCost = toNum(cat.gross_cost);
      const disposedCost = toNum(cat.disposed_cost);
      const accumDep = toNum(cat.accumulated_depreciation);
      const nbv = toNum(cat.net_book_value);
      return {
        ...cat,
        beg_gross_cost: grossCost,
        additions_cost: 0,
        disposals_cost: disposedCost,
        end_gross_cost: grossCost - disposedCost,
        beg_accum_dep: 0,
        period_dep: accumDep,
        disposals_dep: 0,
        end_accum_dep: accumDep,
        end_nbv: nbv,
      };
    });

    const totals = reportRows.reduce(
      (acc, cat) => ({
        gross_cost: acc.gross_cost + toNum(cat.gross_cost),
        disposed_cost: acc.disposed_cost + toNum(cat.disposed_cost),
        accumulated_depreciation: acc.accumulated_depreciation + toNum(cat.accumulated_depreciation),
        net_book_value: acc.net_book_value + toNum(cat.net_book_value),
        total_assets: acc.total_assets + toNum(cat.total_assets),
      }),
      { gross_cost: 0, disposed_cost: 0, accumulated_depreciation: 0, net_book_value: 0, total_assets: 0 }
    );

    res.json({
      success: true,
      year,
      totals,
      categories: reportRows,
      items: reportRows,
      data: reportRows,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * 7. ASSET REVALUATION & IMPAIRMENT (Value Adjustments)
 */
export async function listAssetRevaluations(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [items] = await pool.query(
      `SELECT r.*, 
              a.asset_code, a.asset_name, 
              c.category_name, 
              v.voucher_no, 
              u.username AS created_by_name
       FROM ast_asset_revaluations r
       JOIN ast_assets a ON a.id = r.asset_id
       LEFT JOIN ast_asset_categories c ON c.id = a.category_id
       LEFT JOIN fin_vouchers v ON v.id = r.voucher_id
       LEFT JOIN adm_users u ON u.id = r.created_by
       WHERE r.company_id = ?
       ORDER BY r.revaluation_date DESC, r.id DESC`,
      [companyId || 1]
    );
    res.json({ success: true, items, data: items });
  } catch (err) {
    next(err);
  }
}

export async function createAssetRevaluation(req, res, next) {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchId: scopeBranchId } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || null;
    const body = req.body || {};

    const assetId = toNum(body.asset_id);
    if (!assetId) throw httpError(400, "VALIDATION_ERROR", "Asset is required");

    await conn.beginTransaction();

    const [assetRows] = await conn.query(
      `SELECT a.*, c.asset_cost_account_id, c.depreciation_expense_account_id
       FROM ast_assets a
       LEFT JOIN ast_asset_categories c ON c.id = a.category_id
       WHERE a.id = ? AND a.company_id = ?`,
      [assetId, companyId || 1]
    );
    if (!assetRows.length) throw httpError(404, "NOT_FOUND", "Asset not found");
    const asset = assetRows[0];

    const prevCost = toNum(asset.purchase_cost);
    const prevNBV = toNum(asset.current_nbv);
    const revType = (body.revaluation_type || "INCREASE").toUpperCase(); // INCREASE, DECREASE, IMPAIRMENT
    
    let newCost = prevCost;
    let newNBV = prevNBV;
    let adjustmentAmount = toNum(body.adjustment_amount);

    if (body.new_valuation) {
      const newVal = toNum(body.new_valuation);
      adjustmentAmount = Math.round(Math.abs(newVal - prevNBV) * 100) / 100;
      if (newVal >= prevNBV) {
        newCost = Math.round((prevCost + adjustmentAmount) * 100) / 100;
        newNBV = newVal;
      } else {
        newCost = Math.round(Math.max(0, prevCost - adjustmentAmount) * 100) / 100;
        newNBV = newVal;
      }
    } else {
      if (revType === "INCREASE") {
        newCost = Math.round((prevCost + adjustmentAmount) * 100) / 100;
        newNBV = Math.round((prevNBV + adjustmentAmount) * 100) / 100;
      } else {
        newCost = Math.round(Math.max(0, prevCost - adjustmentAmount) * 100) / 100;
        newNBV = Math.round(Math.max(0, prevNBV - adjustmentAmount) * 100) / 100;
      }
    }

    const revNo = `REV-${Date.now().toString().slice(-6)}`;
    const revDate = body.revaluation_date || new Date().toISOString().slice(0, 10);

    // 1. Insert revaluation record
    const [revRes] = await conn.query(
      `INSERT INTO ast_asset_revaluations (
        company_id, branch_id, revaluation_no, asset_id, revaluation_date,
        revaluation_type, previous_cost, new_cost, previous_nbv, new_nbv,
        adjustment_amount, valuation_reason, valuer_name, valuation_report_ref,
        notes, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        toNum(scopeBranchId, 1),
        revNo,
        assetId,
        revDate,
        revType,
        prevCost,
        newCost,
        prevNBV,
        newNBV,
        adjustmentAmount,
        body.valuation_reason || null,
        body.valuer_name || null,
        body.valuation_report_ref || null,
        body.notes || null,
        userId
      ]
    );
    const revId = revRes.insertId;

    // 2. Update Asset Cost and Current NBV
    await conn.query(
      `UPDATE ast_assets SET
        purchase_cost = ?,
        current_nbv = ?,
        notes = CONCAT(COALESCE(notes, ''), '\n[Revaluation ', ?, ' on ', ?, ': Adjusted by ', ?, ']')
       WHERE id = ?`,
      [newCost, newNBV, revType, revDate, adjustmentAmount, assetId]
    );

    // 3. Post balanced GL voucher
    try {
      const [jvType] = await conn.execute("SELECT id FROM fin_voucher_types WHERE code = 'JV' LIMIT 1").catch(() => [[]]);
      const voucherTypeId = jvType[0]?.id || 4;
      const voucherNo = `JV-${revNo}`;
      const assetAccId = asset.asset_cost_account_id || 12;

      const [revReserveAcc] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE name LIKE '%Revaluation%' OR code = '3020' OR group_id = 3 LIMIT 1"
      ).catch(() => [[]]);
      const [impairmentLossAcc] = await conn.execute(
        "SELECT id FROM fin_accounts WHERE name LIKE '%Impairment Loss%' OR code = '5025' OR code = '5024' LIMIT 1"
      ).catch(() => [[]]);

      const reserveAccountId = revReserveAcc[0]?.id || 30;
      const lossAccountId = impairmentLossAcc[0]?.id || asset.depreciation_expense_account_id || 47;

      const [vRes] = await conn.execute(
        `INSERT INTO fin_vouchers (
          company_id, branch_id, voucher_type_id, voucher_no, voucher_date,
          narration, total_debit, total_credit, status, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'POSTED', ?)`,
        [
          companyId || 1,
          toNum(scopeBranchId, 1),
          voucherTypeId,
          voucherNo,
          revDate,
          `Asset Value Adjustment (${revType}) for ${asset.asset_code || asset.asset_name}: Amount ${adjustmentAmount}`,
          adjustmentAmount,
          adjustmentAmount,
          userId
        ]
      );
      const voucherId = vRes.insertId;

      if (revType === "INCREASE") {
        await conn.execute(
          `INSERT INTO fin_voucher_lines (company_id, voucher_id, line_no, account_id, description, debit, credit, created_by)
           VALUES (?, ?, 1, ?, ?, ?, 0, ?)`,
          [companyId || 1, voucherId, assetAccId, `Asset Revaluation Increase - ${asset.asset_code}`, adjustmentAmount, userId]
        );
        await conn.execute(
          `INSERT INTO fin_voucher_lines (company_id, voucher_id, line_no, account_id, description, debit, credit, created_by)
           VALUES (?, ?, 2, ?, ?, 0, ?, ?)`,
          [companyId || 1, voucherId, reserveAccountId, `Revaluation Surplus Reserve - ${asset.asset_code}`, adjustmentAmount, userId]
        );
      } else {
        await conn.execute(
          `INSERT INTO fin_voucher_lines (company_id, voucher_id, line_no, account_id, description, debit, credit, created_by)
           VALUES (?, ?, 1, ?, ?, ?, 0, ?)`,
          [companyId || 1, voucherId, lossAccountId, `Asset Impairment Loss - ${asset.asset_code}`, adjustmentAmount, userId]
        );
        await conn.execute(
          `INSERT INTO fin_voucher_lines (company_id, voucher_id, line_no, account_id, description, debit, credit, created_by)
           VALUES (?, ?, 2, ?, ?, 0, ?, ?)`,
          [companyId || 1, voucherId, assetAccId, `Asset Book Value Reduction - ${asset.asset_code}`, adjustmentAmount, userId]
        );
      }

      await conn.execute("UPDATE ast_asset_revaluations SET voucher_id = ? WHERE id = ?", [voucherId, revId]);
    } catch (glErr) {
      console.warn("[Asset Revaluation] GL Voucher note:", glErr.message);
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      revaluation_no: revNo,
      message: `Successfully processed asset value adjustment for ${asset.asset_name}`,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * 8. MANUFACTURERS / BRANDS
 */
export async function listManufacturers(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [items] = await pool.query(
      `SELECT m.*, (SELECT COUNT(*) FROM ast_assets a WHERE (a.make = m.name OR a.make = m.code) AND a.company_id = m.company_id) AS asset_count
       FROM ast_manufacturers m
       WHERE (m.company_id = ? OR m.company_id = 1) AND m.is_active = 1
       ORDER BY m.name ASC`,
      [companyId || 1]
    );
    res.json({ success: true, items, data: items });
  } catch (err) {
    next(err);
  }
}

export async function createManufacturer(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const body = req.body || {};
    if (!body.name?.trim()) throw httpError(400, "VALIDATION_ERROR", "Manufacturer Name is required");

    const [resIns] = await pool.query(
      `INSERT INTO ast_manufacturers (company_id, name, code, country, support_contact, website, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        body.name.trim(),
        (body.code || body.name.slice(0, 4)).toUpperCase().trim(),
        body.country || null,
        body.support_contact || null,
        body.website || null,
        body.notes || null,
      ]
    );
    res.status(201).json({ success: true, id: resIns.insertId, message: "Manufacturer created successfully" });
  } catch (err) {
    next(err);
  }
}

export async function updateManufacturer(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const body = req.body || {};

    await pool.query(
      `UPDATE ast_manufacturers SET
         name = COALESCE(?, name),
         code = COALESCE(?, code),
         country = COALESCE(?, country),
         support_contact = COALESCE(?, support_contact),
         website = COALESCE(?, website),
         notes = COALESCE(?, notes),
         is_active = COALESCE(?, is_active)
       WHERE id = ? AND (company_id = ? OR company_id = 1)`,
      [body.name, body.code, body.country, body.support_contact, body.website, body.notes, body.is_active, id, companyId || 1]
    );
    res.json({ success: true, message: "Manufacturer updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteManufacturer(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    await pool.query(
      "UPDATE ast_manufacturers SET is_active = 0 WHERE id = ? AND (company_id = ? OR company_id = 1)",
      [id, companyId || 1]
    );
    res.json({ success: true, message: "Manufacturer removed successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * 9. PROPERTY / FACILITY SITES
 */
export async function listProperties(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [items] = await pool.query(
      `SELECT p.*, (SELECT COUNT(*) FROM ast_assets a WHERE a.property_id = p.id AND a.company_id = p.company_id) AS asset_count
       FROM ast_properties p
       WHERE (p.company_id = ? OR p.company_id = 1) AND p.is_active = 1
       ORDER BY p.property_name ASC`,
      [companyId || 1]
    );
    res.json({ success: true, items, data: items });
  } catch (err) {
    next(err);
  }
}

export async function createProperty(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const body = req.body || {};
    if (!body.property_name?.trim()) throw httpError(400, "VALIDATION_ERROR", "Property/Site Name is required");

    let propCode = (body.property_code || "").toUpperCase().trim();
    if (!propCode) {
      propCode = `SITE-${Date.now().toString().slice(-4)}`;
    }

    const [resIns] = await pool.query(
      `INSERT INTO ast_properties (company_id, property_code, property_name, property_type, address, city)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        companyId || 1,
        propCode,
        body.property_name.trim(),
        body.property_type || "SITE",
        body.address || null,
        body.city || null,
      ]
    );
    res.status(201).json({ success: true, id: resIns.insertId, message: "Property / Site created successfully" });
  } catch (err) {
    next(err);
  }
}

export async function updateProperty(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const body = req.body || {};

    await pool.query(
      `UPDATE ast_properties SET
         property_name = COALESCE(?, property_name),
         property_code = COALESCE(?, property_code),
         property_type = COALESCE(?, property_type),
         address = COALESCE(?, address),
         city = COALESCE(?, city),
         is_active = COALESCE(?, is_active)
       WHERE id = ? AND (company_id = ? OR company_id = 1)`,
      [body.property_name, body.property_code, body.property_type, body.address, body.city, body.is_active, id, companyId || 1]
    );
    res.json({ success: true, message: "Property / Site updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteProperty(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    await pool.query(
      "UPDATE ast_properties SET is_active = 0 WHERE id = ? AND (company_id = ? OR company_id = 1)",
      [id, companyId || 1]
    );
    res.json({ success: true, message: "Property / Site removed successfully" });
  } catch (err) {
    next(err);
  }
}

/**
 * 10. ASSET TAGGING NOMENCLATURE RULES
 */
export async function getTagNomenclature(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const [rows] = await pool.query(
      "SELECT * FROM ast_tag_nomenclature WHERE company_id = ? LIMIT 1",
      [companyId || 1]
    );
    const rule = rows[0] || {
      prefix: "AST",
      include_category: 1,
      include_site: 0,
      include_year: 1,
      seq_digits: 4,
      separator_char: "-",
      current_sequence: 1,
      sample_format: "AST-CAT-2026-0001",
    };
    res.json({ success: true, data: rule, rule });
  } catch (err) {
    next(err);
  }
}

export async function saveTagNomenclature(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};

    const prefix = (b.prefix || "AST").toUpperCase().trim();
    const incCat = b.include_category ? 1 : 0;
    const incSite = b.include_site ? 1 : 0;
    const incYear = b.include_year ? 1 : 0;
    const seqDigits = toNum(b.seq_digits, 4);
    const sep = b.separator_char || "-";
    const curSeq = toNum(b.current_sequence, 1);

    const parts = [prefix];
    if (incCat) parts.push("CAT");
    if (incSite) parts.push("SITE");
    if (incYear) parts.push(new Date().getFullYear());
    parts.push(String(curSeq).padStart(seqDigits, "0"));
    const sample = parts.join(sep);

    await pool.query(
      `INSERT INTO ast_tag_nomenclature (
         company_id, prefix, include_category, include_site, include_year, seq_digits, separator_char, current_sequence, sample_format
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         prefix = VALUES(prefix),
         include_category = VALUES(include_category),
         include_site = VALUES(include_site),
         include_year = VALUES(include_year),
         seq_digits = VALUES(seq_digits),
         separator_char = VALUES(separator_char),
         sample_format = VALUES(sample_format)`,
      [companyId || 1, prefix, incCat, incSite, incYear, seqDigits, sep, curSeq, sample]
    );

    res.json({ success: true, message: "Tagging nomenclature rule saved successfully", sample_format: sample });
  } catch (err) {
    next(err);
  }
}

export async function generateNextTag(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { categoryId, propertyId } = req.query;

    const [ruleRows] = await pool.query(
      "SELECT * FROM ast_tag_nomenclature WHERE company_id = ? LIMIT 1",
      [companyId || 1]
    );
    const rule = ruleRows[0] || {
      prefix: "AST",
      include_category: 1,
      include_site: 0,
      include_year: 1,
      seq_digits: 4,
      separator_char: "-",
      current_sequence: 1,
    };

    let catSlug = "GEN";
    if (categoryId) {
      const [cat] = await pool.query("SELECT category_code, category_name FROM ast_asset_categories WHERE id = ?", [categoryId]);
      if (cat.length > 0) {
        catSlug = (cat[0].category_code || cat[0].category_name.slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, "");
      }
    }

    let siteSlug = "SITE";
    if (propertyId) {
      const [prop] = await pool.query("SELECT property_code, property_name FROM ast_properties WHERE id = ?", [propertyId]);
      if (prop.length > 0) {
        siteSlug = (prop[0].property_code || prop[0].property_name.slice(0, 4)).toUpperCase().replace(/[^A-Z0-9]/g, "");
      }
    }

    const [countRows] = await pool.query("SELECT COUNT(*) AS total FROM ast_assets WHERE company_id = ?", [companyId || 1]);
    const nextSeq = (countRows[0]?.total || 0) + 1;

    const parts = [rule.prefix || "AST"];
    if (rule.include_category) parts.push(catSlug);
    if (rule.include_site) parts.push(siteSlug);
    if (rule.include_year) parts.push(new Date().getFullYear());
    parts.push(String(nextSeq).padStart(rule.seq_digits || 4, "0"));

    const nextTag = parts.join(rule.separator_char || "-");
    res.json({ success: true, next_tag: nextTag, tag: nextTag });
  } catch (err) {
    next(err);
  }
}

