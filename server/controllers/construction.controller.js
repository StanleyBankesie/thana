/**
 * @file construction.controller.js
 * @description Comprehensive enterprise controller for OmniSuite ERP Construction Management module.
 * Integrates with Finance, Inventory, Purchase, Sales, HR, and Administration.
 */

import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { calculateCPM } from "../services/cpmEngine.js";
import { ensureConstructionTables } from "../utils/constructionTables.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ==========================================
// 1. SITES, COST CODES, PHASES & WORK PACKAGES
// ==========================================

export const listSites = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = req.query.project_id ? toNumber(req.query.project_id) : null;
    let sql = `SELECT s.*, p.project_name, p.project_code 
               FROM pm_sites s
               LEFT JOIN pm_projects p ON p.id = s.project_id
               WHERE s.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND s.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY s.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createSite = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.site_name) throw httpError(400, "VALIDATION_ERROR", "Site name is required");

    const result = await query(
      `INSERT INTO pm_sites (company_id, branch_id, project_id, site_code, site_name, address, city, state, country, gps_latitude, gps_longitude, site_engineer_name, contact_phone, status, remarks)
       VALUES (:companyId, :branchId, :project_id, :site_code, :site_name, :address, :city, :state, :country, :gps_latitude, :gps_longitude, :site_engineer_name, :contact_phone, :status, :remarks)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        site_code: b.site_code || null,
        site_name: b.site_name,
        address: b.address || null,
        city: b.city || null,
        state: b.state || null,
        country: b.country || null,
        gps_latitude: b.gps_latitude ? Number(b.gps_latitude) : null,
        gps_longitude: b.gps_longitude ? Number(b.gps_longitude) : null,
        site_engineer_name: b.site_engineer_name || null,
        contact_phone: b.contact_phone || null,
        status: b.status || "ACTIVE",
        remarks: b.remarks || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Site created successfully" });
  } catch (err) {
    next(err);
  }
};

export const listCostCodes = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const items = await query(
      `SELECT * FROM pm_cost_codes WHERE (company_id = :companyId OR company_id IS NULL) AND is_active = 'Y' ORDER BY code ASC`,
      { companyId }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createCostCode = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.code || !b.name) throw httpError(400, "VALIDATION_ERROR", "Code and name are required");

    const result = await query(
      `INSERT INTO pm_cost_codes (company_id, code, name, category, standard_type, parent_id, description)
       VALUES (:companyId, :code, :name, :category, :standard_type, :parent_id, :description)`,
      {
        companyId,
        code: b.code,
        name: b.name,
        category: b.category || "MATERIALS",
        standard_type: b.standard_type || "CUSTOM",
        parent_id: toNumber(b.parent_id),
        description: b.description || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Cost code created" });
  } catch (err) {
    next(err);
  }
};

export const listPhases = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT * FROM pm_phases WHERE company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY sequence_order ASC, id ASC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createPhase = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.phase_name) throw httpError(400, "VALIDATION_ERROR", "Project and phase name required");

    const result = await query(
      `INSERT INTO pm_phases (company_id, project_id, phase_code, phase_name, sequence_order, start_date, end_date, budget, status, description)
       VALUES (:companyId, :project_id, :phase_code, :phase_name, :sequence_order, :start_date, :end_date, :budget, :status, :description)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        phase_code: b.phase_code || null,
        phase_name: b.phase_name,
        sequence_order: Number(b.sequence_order || 1),
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        budget: Number(b.budget || 0),
        status: b.status || "PLANNED",
        description: b.description || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Phase created" });
  } catch (err) {
    next(err);
  }
};

export const listWorkPackages = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT wp.*, p.phase_name, pr.project_name 
               FROM pm_work_packages wp
               LEFT JOIN pm_phases p ON p.id = wp.phase_id
               LEFT JOIN pm_projects pr ON pr.id = wp.project_id
               WHERE wp.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND wp.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY wp.wbs_code ASC, wp.id ASC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createWorkPackage = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.package_name) throw httpError(400, "VALIDATION_ERROR", "Project and package name required");

    const result = await query(
      `INSERT INTO pm_work_packages (company_id, project_id, phase_id, wbs_code, package_name, lead_user_id, estimated_cost, start_date, end_date, status, scope_description)
       VALUES (:companyId, :project_id, :phase_id, :wbs_code, :package_name, :lead_user_id, :estimated_cost, :start_date, :end_date, :status, :scope_description)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        phase_id: toNumber(b.phase_id),
        wbs_code: b.wbs_code || null,
        package_name: b.package_name,
        lead_user_id: toNumber(b.lead_user_id),
        estimated_cost: Number(b.estimated_cost || 0),
        start_date: b.start_date || null,
        end_date: b.end_date || null,
        status: b.status || "PLANNED",
        scope_description: b.scope_description || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Work package created" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 2. TENDERING & BILL OF QUANTITIES (BOQ)
// ==========================================

export const listTenders = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const items = await query(
      `SELECT t.*, c.name AS client_name, p.project_name 
       FROM pm_tenders t
       LEFT JOIN sal_customers c ON c.id = t.client_id
       LEFT JOIN pm_projects p ON p.id = t.awarded_project_id
       WHERE t.company_id = :companyId ORDER BY t.id DESC`,
      { companyId }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getTenderById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const rows = await query(
      `SELECT t.*, c.name AS client_name 
       FROM pm_tenders t 
       LEFT JOIN sal_customers c ON c.id = t.client_id
       WHERE t.id = :id AND t.company_id = :companyId LIMIT 1`,
      { id, companyId }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Tender not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createTender = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.tender_code || !b.title) throw httpError(400, "VALIDATION_ERROR", "Tender code and title required");

    const result = await query(
      `INSERT INTO pm_tenders (company_id, branch_id, tender_code, title, client_id, client_name, project_type, site_location, submission_date, estimated_value, bid_bond_amount, bid_bond_expiry, status, remarks, created_by)
       VALUES (:companyId, :branchId, :tender_code, :title, :client_id, :client_name, :project_type, :site_location, :submission_date, :estimated_value, :bid_bond_amount, :bid_bond_expiry, :status, :remarks, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        tender_code: b.tender_code,
        title: b.title,
        client_id: toNumber(b.client_id),
        client_name: b.client_name || null,
        project_type: b.project_type || "COMMERCIAL_BUILDING",
        site_location: b.site_location || null,
        submission_date: b.submission_date || null,
        estimated_value: Number(b.estimated_value || 0),
        bid_bond_amount: Number(b.bid_bond_amount || 0),
        bid_bond_expiry: b.bid_bond_expiry || null,
        status: b.status || "DRAFT",
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Tender created successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateTender = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    await query(
      `UPDATE pm_tenders SET
        title = :title, client_id = :client_id, client_name = :client_name,
        project_type = :project_type, site_location = :site_location,
        submission_date = :submission_date, estimated_value = :estimated_value,
        bid_bond_amount = :bid_bond_amount, bid_bond_expiry = :bid_bond_expiry,
        status = :status, remarks = :remarks
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        title: b.title,
        client_id: toNumber(b.client_id),
        client_name: b.client_name || null,
        project_type: b.project_type,
        site_location: b.site_location || null,
        submission_date: b.submission_date || null,
        estimated_value: Number(b.estimated_value || 0),
        bid_bond_amount: Number(b.bid_bond_amount || 0),
        bid_bond_expiry: b.bid_bond_expiry || null,
        status: b.status || "DRAFT",
        remarks: b.remarks || null,
      }
    );
    res.json({ ok: true, message: "Tender updated" });
  } catch (err) {
    next(err);
  }
};

export const awardTenderToProject = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const tenderId = toNumber(req.params.id);
    const b = req.body || {};

    const tenders = await query(`SELECT * FROM pm_tenders WHERE id = :tenderId AND company_id = :companyId LIMIT 1`, { tenderId, companyId });
    if (!tenders.length) throw httpError(404, "NOT_FOUND", "Tender not found");
    const tender = tenders[0];

    // Create active construction project from awarded tender
    const projCode = b.project_code || `PRJ-${tender.tender_code}`;
    const projResult = await query(
      `INSERT INTO pm_projects 
        (company_id, branch_id, project_code, project_name, project_type, client_id, client_name, contract_ref_no, contract_sum, revised_contract_sum, budget, project_status, start_date, end_date, site_address, created_by)
       VALUES 
        (:companyId, :branchId, :project_code, :project_name, :project_type, :client_id, :client_name, :contract_ref_no, :contract_sum, :revised_contract_sum, :budget, 'IN_PROGRESS', :start_date, :end_date, :site_address, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_code: projCode,
        project_name: b.project_name || tender.title,
        project_type: tender.project_type,
        client_id: tender.client_id,
        client_name: tender.client_name,
        contract_ref_no: b.contract_ref_no || tender.tender_code,
        contract_sum: Number(b.contract_sum || tender.estimated_value || 0),
        revised_contract_sum: Number(b.contract_sum || tender.estimated_value || 0),
        budget: Number(b.budget || tender.estimated_value || 0),
        start_date: b.start_date || new Date().toISOString().split("T")[0],
        end_date: b.end_date || null,
        site_address: tender.site_location,
        created_by: req.user?.id || null,
      }
    );

    const projectId = projResult.insertId;

    // Link tender to awarded project and mark awarded
    await query(
      `UPDATE pm_tenders SET status = 'AWARDED', awarded_project_id = :projectId WHERE id = :tenderId`,
      { projectId, tenderId }
    );

    // Link any tender BOQs to this project
    await query(
      `UPDATE pm_boqs SET project_id = :projectId WHERE tender_id = :tenderId`,
      { projectId, tenderId }
    );

    res.json({ ok: true, project_id: projectId, message: "Tender awarded and project initiated successfully" });
  } catch (err) {
    next(err);
  }
};

export const listBOQs = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = req.query.project_id ? toNumber(req.query.project_id) : null;
    const tenderId = req.query.tender_id ? toNumber(req.query.tender_id) : null;

    let sql = `SELECT b.*, p.project_name, t.title AS tender_title,
                (SELECT COUNT(*) FROM pm_boq_items WHERE boq_id = b.id) AS item_count
               FROM pm_boqs b
               LEFT JOIN pm_projects p ON p.id = b.project_id
               LEFT JOIN pm_tenders t ON t.id = b.tender_id
               WHERE b.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND b.project_id = :projectId`;
      params.projectId = projectId;
    }
    if (tenderId) {
      sql += ` AND b.tender_id = :tenderId`;
      params.tenderId = tenderId;
    }
    sql += ` ORDER BY b.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getBOQById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const boqs = await query(`SELECT * FROM pm_boqs WHERE id = :id AND company_id = :companyId LIMIT 1`, { id, companyId });
    if (!boqs.length) throw httpError(404, "NOT_FOUND", "BOQ not found");

    const items = await query(
      `SELECT bi.*, cc.name AS cost_code_name, cc.code AS cost_code
       FROM pm_boq_items bi
       LEFT JOIN pm_cost_codes cc ON cc.id = bi.cost_code_id
       WHERE bi.boq_id = :id ORDER BY bi.item_number ASC, bi.id ASC`,
      { id }
    );

    res.json({ item: boqs[0], items });
  } catch (err) {
    next(err);
  }
};

export const createBOQ = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.title) throw httpError(400, "VALIDATION_ERROR", "BOQ title is required");

    const result = await query(
      `INSERT INTO pm_boqs (company_id, branch_id, project_id, tender_id, boq_number, title, revision_number, total_amount, currency, status, remarks, created_by)
       VALUES (:companyId, :branchId, :project_id, :tender_id, :boq_number, :title, :revision_number, :total_amount, :currency, :status, :remarks, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        tender_id: toNumber(b.tender_id),
        boq_number: b.boq_number || `BOQ-${Date.now()}`,
        title: b.title,
        revision_number: Number(b.revision_number || 0),
        total_amount: Number(b.total_amount || 0),
        currency: b.currency || "GHS",
        status: b.status || "DRAFT",
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "BOQ created" });
  } catch (err) {
    next(err);
  }
};

export const saveBOQItems = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const boqId = toNumber(req.params.id);
    const { items = [] } = req.body;

    const boqCheck = await query(`SELECT id FROM pm_boqs WHERE id = :boqId AND company_id = :companyId`, { boqId, companyId });
    if (!boqCheck.length) throw httpError(404, "NOT_FOUND", "BOQ not found");

    // Replace items or bulk insert
    await query(`DELETE FROM pm_boq_items WHERE boq_id = :boqId`, { boqId });

    let runningTotal = 0;
    for (const itm of items) {
      const qty = Number(itm.quantity || 0);
      const rate = Number(itm.unit_rate || 0);
      const amt = Number(itm.total_amount || qty * rate);
      runningTotal += amt;

      await query(
        `INSERT INTO pm_boq_items (boq_id, parent_item_id, item_number, bill_no, element, description, unit, quantity, unit_rate, total_amount, cost_code_id, work_package_id, is_measured)
         VALUES (:boq_id, :parent_item_id, :item_number, :bill_no, :element, :description, :unit, :quantity, :unit_rate, :total_amount, :cost_code_id, :work_package_id, :is_measured)`,
        {
          boq_id: boqId,
          parent_item_id: toNumber(itm.parent_item_id),
          item_number: itm.item_number || "",
          bill_no: itm.bill_no || null,
          element: itm.element || null,
          description: itm.description || "",
          unit: itm.unit || "SUM",
          quantity: qty,
          unit_rate: rate,
          total_amount: amt,
          cost_code_id: toNumber(itm.cost_code_id),
          work_package_id: toNumber(itm.work_package_id),
          is_measured: itm.is_measured !== undefined ? itm.is_measured : 1,
        }
      );
    }

    await query(`UPDATE pm_boqs SET total_amount = :runningTotal WHERE id = :boqId`, { runningTotal, boqId });
    res.json({ ok: true, total_amount: runningTotal, message: "BOQ items updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const getRateAnalysis = async (req, res, next) => {
  try {
    const boqItemId = toNumber(req.params.boqItemId);
    const rows = await query(`SELECT * FROM pm_rate_analyses WHERE boq_item_id = :boqItemId LIMIT 1`, { boqItemId });
    res.json({ item: rows.length ? rows[0] : null });
  } catch (err) {
    next(err);
  }
};

export const saveRateAnalysis = async (req, res, next) => {
  try {
    const boqItemId = toNumber(req.params.boqItemId);
    const b = req.body || {};

    const mat = Number(b.material_cost || 0);
    const lab = Number(b.labour_cost || 0);
    const plant = Number(b.plant_cost || 0);
    const sub = Number(b.subcontract_cost || 0);
    const directTotal = mat + lab + plant + sub;

    const ovhPct = Number(b.overhead_percent || 0);
    const ovhAmt = (directTotal * ovhPct) / 100;
    const profitPct = Number(b.profit_percent || 0);
    const profitAmt = ((directTotal + ovhAmt) * profitPct) / 100;
    const computedUnitRate = directTotal + ovhAmt + profitAmt;

    await query(
      `INSERT INTO pm_rate_analyses 
        (boq_item_id, material_cost, labour_cost, plant_cost, subcontract_cost, overhead_percent, overhead_amount, profit_percent, profit_amount, computed_unit_rate, notes)
       VALUES 
        (:boqItemId, :mat, :lab, :plant, :sub, :ovhPct, :ovhAmt, :profitPct, :profitAmt, :computedUnitRate, :notes)
       ON DUPLICATE KEY UPDATE
        material_cost = :mat, labour_cost = :lab, plant_cost = :plant, subcontract_cost = :sub,
        overhead_percent = :ovhPct, overhead_amount = :ovhAmt, profit_percent = :profitPct,
        profit_amount = :profitAmt, computed_unit_rate = :computedUnitRate, notes = :notes`,
      {
        boqItemId,
        mat,
        lab,
        plant,
        sub,
        ovhPct,
        ovhAmt,
        profitPct,
        profitAmt,
        computedUnitRate,
        notes: b.notes || null,
      }
    );

    // Optionally update BOQ item unit rate
    if (b.update_boq_item_rate) {
      await query(`UPDATE pm_boq_items SET unit_rate = :computedUnitRate, total_amount = quantity * :computedUnitRate WHERE id = :boqItemId`, { computedUnitRate, boqItemId });
    }

    res.json({ ok: true, computed_unit_rate: computedUnitRate });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 3. BUDGETING & COST CONTROL (EVM)
// ==========================================

export const getCostControlSummary = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);

    // 1. Fetch Project Master
    const projRows = await query(
      `SELECT id, project_code, project_name, contract_sum, revised_contract_sum, budget, completion_percent, start_date, end_date
       FROM pm_projects WHERE id = :projectId AND company_id = :companyId LIMIT 1`,
      { projectId, companyId }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const proj = projRows[0];

    // 2. Approved Budget Lines
    const budgetLines = await query(
      `SELECT bl.*, cc.name AS cost_code_name, cc.code AS cost_code, cc.category AS cost_category
       FROM pm_budget_lines bl
       LEFT JOIN pm_project_budgets pb ON pb.id = bl.budget_id
       LEFT JOIN pm_cost_codes cc ON cc.id = bl.cost_code_id
       WHERE pb.project_id = :projectId AND pb.status = 'APPROVED'
       ORDER BY cc.code ASC`,
      { projectId }
    );

    const totalBudget = Number(proj.budget || 0);

    // 3. Actual Direct Expenses (from pm_expenses)
    const expRows = await query(
      `SELECT COALESCE(SUM(amount), 0) AS total_expense FROM pm_expenses WHERE project_id = :projectId`,
      { projectId }
    );
    const directExpenses = Number(expRows[0]?.total_expense || 0);

    // 4. Committed Purchase Orders (from pur_orders / pur_order_lines)
    let poCommitted = 0;
    try {
      const poRows = await query(
        `SELECT COALESCE(SUM(pol.total_price), 0) AS committed
         FROM pur_order_lines pol
         JOIN pur_orders po ON po.id = pol.order_id
         WHERE po.project_id = :projectId AND po.status NOT IN ('CANCELLED', 'REJECTED')`,
        { projectId }
      );
      poCommitted = Number(poRows[0]?.committed || 0);
    } catch (e) {
      // purchase order table fallback
    }

    // 5. Certified Subcontract Valuations
    let subValuations = 0;
    try {
      const svRows = await query(
        `SELECT COALESCE(SUM(net_payable), 0) AS sub_total 
         FROM pm_subcontract_valuations 
         WHERE project_id = :projectId AND status IN ('CERTIFIED', 'APPROVED', 'PAID')`,
        { projectId }
      );
      subValuations = Number(svRows[0]?.sub_total || 0);
    } catch (e) {}

    // 6. Labour Timesheet Actuals
    let timesheetLabourCost = 0;
    try {
      const tsRows = await query(
        `SELECT COALESCE(SUM(hours * 25.00), 0) AS labour_cost 
         FROM pm_timesheets WHERE project_id = :projectId`,
        { projectId }
      );
      timesheetLabourCost = Number(tsRows[0]?.labour_cost || 0);
    } catch (e) {}

    // Total Actual Cost (AC)
    const actualCost = directExpenses + subValuations + timesheetLabourCost;

    // EVM Calculations
    const completionPercent = Number(proj.completion_percent || 0);
    const earnedValue = (totalBudget * completionPercent) / 100; // EV = BAC * %
    const plannedValue = totalBudget; // PV (simplified to BAC if on schedule)

    const costVariance = earnedValue - actualCost; // CV = EV - AC
    const cpi = actualCost > 0 ? Number((earnedValue / actualCost).toFixed(2)) : 1.0; // CPI = EV / AC
    const spi = plannedValue > 0 ? Number((earnedValue / plannedValue).toFixed(2)) : 1.0; // SPI = EV / PV
    const estimateAtCompletion = cpi > 0 ? Number((totalBudget / cpi).toFixed(2)) : totalBudget; // EAC = BAC / CPI
    const varianceAtCompletion = Number((totalBudget - estimateAtCompletion).toFixed(2)); // VAC = BAC - EAC

    res.json({
      project: proj,
      budgetLines,
      cost_summary: {
        budget_at_completion: totalBudget,
        actual_cost: actualCost,
        committed_cost: poCommitted,
        direct_expenses: directExpenses,
        subcontractor_valuations: subValuations,
        labour_costs: timesheetLabourCost,
        earned_value: earnedValue,
        planned_value: plannedValue,
        cost_variance: costVariance,
        cpi,
        spi,
        estimate_at_completion: estimateAtCompletion,
        variance_at_completion: varianceAtCompletion,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createProjectBudget = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id) throw httpError(400, "VALIDATION_ERROR", "Project ID is required");

    const lines = b.lines || [];
    let totalBudget = 0;
    lines.forEach((l) => (totalBudget += Number(l.budget_amount || 0)));

    const result = await query(
      `INSERT INTO pm_project_budgets (company_id, branch_id, project_id, budget_name, original_budget, current_budget, currency, status, remarks, created_by)
       VALUES (:companyId, :branchId, :project_id, :budget_name, :original_budget, :current_budget, :currency, :status, :remarks, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        budget_name: b.budget_name || "Baseline Construction Budget",
        original_budget: totalBudget,
        current_budget: totalBudget,
        currency: b.currency || "GHS",
        status: b.status || "APPROVED",
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
      }
    );

    const budgetId = result.insertId;

    for (const l of lines) {
      await query(
        `INSERT INTO pm_budget_lines (budget_id, cost_code_id, work_package_id, cost_category, budget_amount, quantity, unit_rate, remarks)
         VALUES (:budgetId, :cost_code_id, :work_package_id, :cost_category, :budget_amount, :quantity, :unit_rate, :remarks)`,
        {
          budgetId,
          cost_code_id: toNumber(l.cost_code_id),
          work_package_id: toNumber(l.work_package_id),
          cost_category: l.cost_category || "MATERIALS",
          budget_amount: Number(l.budget_amount || 0),
          quantity: Number(l.quantity || 1),
          unit_rate: Number(l.unit_rate || l.budget_amount || 0),
          remarks: l.remarks || null,
        }
      );
    }

    // Update project budget
    await query(`UPDATE pm_projects SET budget = :totalBudget WHERE id = :projectId`, { totalBudget, projectId: toNumber(b.project_id) });

    res.status(201).json({ id: budgetId, total_budget: totalBudget, message: "Budget saved successfully" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 4. PLANNING, SCHEDULING & CPM
// ==========================================

export const calculateProjectCPM = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);

    // Fetch tasks for the project
    const tasks = await query(
      `SELECT id, task_title, start_date, end_date, completion_percent,
              DATEDIFF(COALESCE(end_date, CURDATE()), COALESCE(start_date, CURDATE())) AS duration_days,
              reason_for_delay, is_critical, total_float
       FROM pm_tasks
       WHERE project_id = :projectId AND (is_active = 'Y' OR is_active IS NULL)
       ORDER BY id ASC`,
      { projectId }
    );

    if (!tasks.length) {
      return res.json({ tasks: [], projectDurationDays: 0, criticalPathIds: [] });
    }

    const proj = await query(`SELECT start_date FROM pm_projects WHERE id = :projectId`, { projectId });
    const baseDate = proj[0]?.start_date || new Date();

    const cpmResult = calculateCPM(tasks, baseDate);

    // Update pm_tasks with computed CPM attributes
    for (const t of cpmResult.tasks) {
      await query(
        `UPDATE pm_tasks SET 
          early_start = :early_start, early_finish = :early_finish,
          late_start = :late_start, late_finish = :late_finish,
          total_float = :total_float, is_critical = :is_critical
         WHERE id = :id`,
        {
          id: t.id,
          early_start: t.early_start,
          early_finish: t.early_finish,
          late_start: t.late_start,
          late_finish: t.late_finish,
          total_float: t.total_float,
          is_critical: t.is_critical,
        }
      );
    }

    res.json(cpmResult);
  } catch (err) {
    next(err);
  }
};

export const listEOTRequests = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT e.*, p.project_name FROM pm_eot_requests e JOIN pm_projects p ON p.id = e.project_id WHERE e.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND e.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY e.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createEOTRequest = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.days_requested) throw httpError(400, "VALIDATION_ERROR", "Project and days requested required");

    const result = await query(
      `INSERT INTO pm_eot_requests (company_id, project_id, request_number, delay_cause, delay_category, days_requested, financial_claim_amount, requested_date, justification, status, created_by)
       VALUES (:companyId, :project_id, :request_number, :delay_cause, :delay_category, :days_requested, :financial_claim_amount, :requested_date, :justification, :status, :created_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        request_number: b.request_number || `EOT-${Date.now()}`,
        delay_cause: b.delay_cause || "",
        delay_category: b.delay_category || "CLIENT_CHANGE",
        days_requested: Number(b.days_requested),
        financial_claim_amount: Number(b.financial_claim_amount || 0),
        requested_date: b.requested_date || new Date().toISOString().split("T")[0],
        justification: b.justification || null,
        status: "SUBMITTED",
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "EOT request submitted" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 5. DAILY SITE REPORTS (DSR)
// ==========================================

export const listDailyReports = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT r.*, p.project_name, s.site_name,
                (SELECT COUNT(*) FROM pm_daily_site_activities WHERE report_id = r.id) AS activity_count,
                (SELECT COALESCE(SUM(headcount), 0) FROM pm_daily_site_workforce WHERE report_id = r.id) AS total_headcount
               FROM pm_daily_site_reports r
               LEFT JOIN pm_projects p ON p.id = r.project_id
               LEFT JOIN pm_sites s ON s.id = r.site_id
               WHERE r.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND r.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY r.report_date DESC, r.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getDailyReportById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);

    const rows = await query(`SELECT * FROM pm_daily_site_reports WHERE id = :id AND company_id = :companyId LIMIT 1`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Daily site report not found");

    const report = rows[0];
    const activities = await query(`SELECT * FROM pm_daily_site_activities WHERE report_id = :id ORDER BY id ASC`, { id });
    const workforce = await query(`SELECT * FROM pm_daily_site_workforce WHERE report_id = :id ORDER BY id ASC`, { id });
    const equipment = await query(`SELECT * FROM pm_daily_site_equipment WHERE report_id = :id ORDER BY id ASC`, { id });
    const materials = await query(`SELECT * FROM pm_daily_site_materials WHERE report_id = :id ORDER BY id ASC`, { id });
    const photos = await query(`SELECT * FROM pm_daily_site_photos WHERE report_id = :id ORDER BY id ASC`, { id });

    res.json({
      item: report,
      activities,
      workforce,
      equipment,
      materials,
      photos,
    });
  } catch (err) {
    next(err);
  }
};

export const createDailyReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.report_date) throw httpError(400, "VALIDATION_ERROR", "Project and report date required");

    const result = await query(
      `INSERT INTO pm_daily_site_reports 
        (company_id, branch_id, project_id, site_id, report_number, report_date, weather_morning, weather_afternoon, site_condition, working_hours_from, working_hours_to, general_remarks, safety_observations, status, site_engineer_name, prepared_by)
       VALUES 
        (:companyId, :branchId, :project_id, :site_id, :report_number, :report_date, :weather_morning, :weather_afternoon, :site_condition, :working_hours_from, :working_hours_to, :general_remarks, :safety_observations, :status, :site_engineer_name, :prepared_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        site_id: toNumber(b.site_id),
        report_number: b.report_number || `DSR-${b.report_date}-${Date.now().toString().slice(-4)}`,
        report_date: b.report_date,
        weather_morning: b.weather_morning || "SUNNY",
        weather_afternoon: b.weather_afternoon || "SUNNY",
        site_condition: b.site_condition || "DRY",
        working_hours_from: b.working_hours_from || "08:00:00",
        working_hours_to: b.working_hours_to || "17:00:00",
        general_remarks: b.general_remarks || null,
        safety_observations: b.safety_observations || null,
        status: b.status || "DRAFT",
        site_engineer_name: b.site_engineer_name || req.user?.username || null,
        prepared_by: req.user?.id || null,
      }
    );

    const reportId = result.insertId;

    // Insert sub-items if present
    if (Array.isArray(b.activities)) {
      for (const a of b.activities) {
        await query(
          `INSERT INTO pm_daily_site_activities (report_id, location_grid, description, quantity_completed, unit, progress_percent, remarks)
           VALUES (:reportId, :location_grid, :description, :quantity_completed, :unit, :progress_percent, :remarks)`,
          {
            reportId,
            location_grid: a.location_grid || null,
            description: a.description || "",
            quantity_completed: Number(a.quantity_completed || 0),
            unit: a.unit || null,
            progress_percent: Number(a.progress_percent || 0),
            remarks: a.remarks || null,
          }
        );
      }
    }

    if (Array.isArray(b.workforce)) {
      for (const w of b.workforce) {
        await query(
          `INSERT INTO pm_daily_site_workforce (report_id, trade_category, trade_name, subcontractor_name, headcount, total_hours)
           VALUES (:reportId, :trade_category, :trade_name, :subcontractor_name, :headcount, :total_hours)`,
          {
            reportId,
            trade_category: w.trade_category || "SKILLED",
            trade_name: w.trade_name || "General Labour",
            subcontractor_name: w.subcontractor_name || null,
            headcount: Number(w.headcount || 1),
            total_hours: Number(w.total_hours || 8),
          }
        );
      }
    }

    if (Array.isArray(b.equipment)) {
      for (const eq of b.equipment) {
        await query(
          `INSERT INTO pm_daily_site_equipment (report_id, equipment_name, equipment_tag, hours_worked, hours_idle, hours_breakdown, remarks)
           VALUES (:reportId, :equipment_name, :equipment_tag, :hours_worked, :hours_idle, :hours_breakdown, :remarks)`,
          {
            reportId,
            equipment_name: eq.equipment_name || "",
            equipment_tag: eq.equipment_tag || null,
            hours_worked: Number(eq.hours_worked || 0),
            hours_idle: Number(eq.hours_idle || 0),
            hours_breakdown: Number(eq.hours_breakdown || 0),
            remarks: eq.remarks || null,
          }
        );
      }
    }

    if (Array.isArray(b.materials)) {
      for (const m of b.materials) {
        await query(
          `INSERT INTO pm_daily_site_materials (report_id, material_name, quantity, unit, supplier_name, delivery_note_no, remarks)
           VALUES (:reportId, :material_name, :quantity, :unit, :supplier_name, :delivery_note_no, :remarks)`,
          {
            reportId,
            material_name: m.material_name || "",
            quantity: Number(m.quantity || 0),
            unit: m.unit || "PCS",
            supplier_name: m.supplier_name || null,
            delivery_note_no: m.delivery_note_no || null,
            remarks: m.remarks || null,
          }
        );
      }
    }

    res.status(201).json({ id: reportId, message: "Daily site report logged successfully" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 6. SUBCONTRACTS & VALUATIONS (IPCs)
// ==========================================

export const listSubcontracts = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT sc.*, p.project_name, s.supplier_name 
               FROM pm_subcontracts sc
               LEFT JOIN pm_projects p ON p.id = sc.project_id
               LEFT JOIN pur_suppliers s ON s.id = sc.subcontractor_id
               WHERE sc.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND sc.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY sc.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createSubcontract = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.subcontract_number || !b.subcontractor_id) {
      throw httpError(400, "VALIDATION_ERROR", "Project, contract number, and subcontractor required");
    }

    const result = await query(
      `INSERT INTO pm_subcontracts 
        (company_id, branch_id, project_id, subcontract_number, subcontractor_id, trade, scope_of_work, contract_sum, retention_percent, retention_cap, advance_payment, advance_recovery_percent, start_date, completion_date, status, remarks)
       VALUES 
        (:companyId, :branchId, :project_id, :subcontract_number, :subcontractor_id, :trade, :scope_of_work, :contract_sum, :retention_percent, :retention_cap, :advance_payment, :advance_recovery_percent, :start_date, :completion_date, :status, :remarks)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        subcontract_number: b.subcontract_number,
        subcontractor_id: toNumber(b.subcontractor_id),
        trade: b.trade || "GENERAL",
        scope_of_work: b.scope_of_work || null,
        contract_sum: Number(b.contract_sum || 0),
        retention_percent: Number(b.retention_percent || 5.0),
        retention_cap: Number(b.retention_cap || 0),
        advance_payment: Number(b.advance_payment || 0),
        advance_recovery_percent: Number(b.advance_recovery_percent || 10.0),
        start_date: b.start_date || null,
        completion_date: b.completion_date || null,
        status: b.status || "ACTIVE",
        remarks: b.remarks || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Subcontract registered successfully" });
  } catch (err) {
    next(err);
  }
};

export const listSubcontractValuations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const subcontractId = toNumber(req.query.subcontract_id);
    let sql = `SELECT v.*, sc.subcontract_number, sc.trade, s.supplier_name
               FROM pm_subcontract_valuations v
               JOIN pm_subcontracts sc ON sc.id = v.subcontract_id
               LEFT JOIN pur_suppliers s ON s.id = sc.subcontractor_id
               WHERE sc.company_id = :companyId`;
    const params = { companyId };
    if (subcontractId) {
      sql += ` AND v.subcontract_id = :subcontractId`;
      params.subcontractId = subcontractId;
    }
    sql += ` ORDER BY v.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createSubcontractValuation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.subcontract_id || !b.valuation_number) throw httpError(400, "VALIDATION_ERROR", "Subcontract and valuation number required");

    const scRows = await query(`SELECT * FROM pm_subcontracts WHERE id = :id AND company_id = :companyId LIMIT 1`, { id: toNumber(b.subcontract_id), companyId });
    if (!scRows.length) throw httpError(404, "NOT_FOUND", "Subcontract not found");
    const sc = scRows[0];

    const cumWorkDone = Number(b.cumulative_work_done || 0);
    const prevCertified = Number(b.previous_certified || 0);
    const currWork = Math.max(0, cumWorkDone - prevCertified);

    const retPct = Number(sc.retention_percent || 5);
    const retentionDeducted = Number(((currWork * retPct) / 100).toFixed(2));

    const advRecPct = Number(sc.advance_recovery_percent || 10);
    const advanceRecovered = Number(((currWork * advRecPct) / 100).toFixed(2));

    const otherDeductions = Number(b.other_deductions || 0);
    const netPayable = Math.max(0, currWork - retentionDeducted - advanceRecovered - otherDeductions);

    const result = await query(
      `INSERT INTO pm_subcontract_valuations 
        (subcontract_id, project_id, valuation_number, period_from, period_to, cumulative_work_done, previous_certified, current_work_done, retention_deducted, advance_recovered, other_deductions, net_payable, status, remarks, certified_by, certified_at)
       VALUES 
        (:subcontract_id, :project_id, :valuation_number, :period_from, :period_to, :cumulative_work_done, :previous_certified, :current_work_done, :retention_deducted, :advance_recovered, :other_deductions, :net_payable, :status, :remarks, :certified_by, :certified_at)`,
      {
        subcontract_id: sc.id,
        project_id: sc.project_id,
        valuation_number: b.valuation_number,
        period_from: b.period_from || null,
        period_to: b.period_to || null,
        cumulative_work_done: cumWorkDone,
        previous_certified: prevCertified,
        current_work_done: currWork,
        retention_deducted: retentionDeducted,
        advance_recovered: advanceRecovered,
        other_deductions: otherDeductions,
        net_payable: netPayable,
        status: b.status || "CERTIFIED",
        remarks: b.remarks || null,
        certified_by: req.user?.id || null,
        certified_at: b.status === "CERTIFIED" ? new Date() : null,
      }
    );

    // Optionally generate financial voucher / bill in Purchase/Finance
    const valuationId = result.insertId;

    res.status(201).json({ id: valuationId, net_payable: netPayable, message: "Subcontract valuation recorded" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. CLIENT VALUATIONS & PAYMENT APPLICATIONS (IPAs)
// ==========================================

export const listClientValuations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT v.*, p.project_name, p.project_code, c.name AS client_name
               FROM pm_client_valuations v
               JOIN pm_projects p ON p.id = v.project_id
               LEFT JOIN sal_customers c ON c.id = p.client_id
               WHERE v.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND v.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY v.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createClientValuation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.application_number) throw httpError(400, "VALIDATION_ERROR", "Project and application number required");

    const projRows = await query(`SELECT * FROM pm_projects WHERE id = :id AND company_id = :companyId LIMIT 1`, { id: toNumber(b.project_id), companyId });
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const proj = projRows[0];

    const cumWork = Number(b.cumulative_work_done || 0);
    const prevCertified = Number(b.previously_certified || 0);
    const currClaim = Math.max(0, cumWork - prevCertified);

    // Retention check
    const retPct = Number(proj.retention_percent || 5.0);
    const retentionAmt = Number(((currClaim * retPct) / 100).toFixed(2));

    // Advance recovery check
    const advRecoveryPct = Number(proj.advance_recovery_percent || 10.0);
    const advanceRecoveryAmt = Number(((currClaim * advRecoveryPct) / 100).toFixed(2));

    const netCertified = Math.max(0, currClaim - retentionAmt - advanceRecoveryAmt);

    const result = await query(
      `INSERT INTO pm_client_valuations 
        (company_id, branch_id, project_id, application_number, valuation_date, period_from, period_to, cumulative_work_done, previously_certified, current_claim, retention_deducted, advance_recovery, net_certified_amount, status, remarks, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :application_number, :valuation_date, :period_from, :period_to, :cumulative_work_done, :previously_certified, :current_claim, :retention_deducted, :advance_recovery, :net_certified_amount, :status, :remarks, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: proj.id,
        application_number: b.application_number,
        valuation_date: b.valuation_date || new Date().toISOString().split("T")[0],
        period_from: b.period_from || null,
        period_to: b.period_to || null,
        cumulative_work_done: cumWork,
        previously_certified: prevCertified,
        current_claim: currClaim,
        retention_deducted: retentionAmt,
        advance_recovery: advanceRecoveryAmt,
        net_certified_amount: netCertified,
        status: b.status || "SUBMITTED",
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
      }
    );

    res.status(201).json({ id: result.insertId, net_certified_amount: netCertified, message: "Client valuation registered" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 8. VARIATIONS & CHANGE ORDERS
// ==========================================

export const listVariations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT v.*, p.project_name FROM pm_variations v JOIN pm_projects p ON p.id = v.project_id WHERE v.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND v.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY v.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createVariation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.variation_number || !b.title) throw httpError(400, "VALIDATION_ERROR", "Project, variation number, and title required");

    const result = await query(
      `INSERT INTO pm_variations 
        (company_id, branch_id, project_id, variation_number, title, reason, initiator, amount_claimed, amount_approved, schedule_impact_days, status, submission_date, remarks, requested_by)
       VALUES 
        (:companyId, :branchId, :project_id, :variation_number, :title, :reason, :initiator, :amount_claimed, :amount_approved, :schedule_impact_days, :status, :submission_date, :remarks, :requested_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        variation_number: b.variation_number,
        title: b.title,
        reason: b.reason || null,
        initiator: b.initiator || "CLIENT",
        amount_claimed: Number(b.amount_claimed || 0),
        amount_approved: Number(b.amount_approved || 0),
        schedule_impact_days: Number(b.schedule_impact_days || 0),
        status: b.status || "PROPOSED",
        submission_date: b.submission_date || new Date().toISOString().split("T")[0],
        remarks: b.remarks || null,
        requested_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Variation order registered" });
  } catch (err) {
    next(err);
  }
};

export const approveVariation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { amount_approved, schedule_impact_days = 0 } = req.body;

    const varRows = await query(`SELECT * FROM pm_variations WHERE id = :id AND company_id = :companyId LIMIT 1`, { id, companyId });
    if (!varRows.length) throw httpError(404, "NOT_FOUND", "Variation not found");
    const v = varRows[0];

    const approvedAmt = Number(amount_approved !== undefined ? amount_approved : v.amount_claimed);
    const approvedDays = Number(schedule_impact_days !== undefined ? schedule_impact_days : v.schedule_impact_days);

    await query(
      `UPDATE pm_variations SET 
        status = 'APPROVED', amount_approved = :approvedAmt, schedule_impact_days = :approvedDays,
        approval_date = CURDATE(), approved_by = :approved_by
       WHERE id = :id`,
      { id, approvedAmt, approvedDays, approved_by: req.user?.id || null }
    );

    // Update project revised contract sum
    await query(
      `UPDATE pm_projects SET 
        revised_contract_sum = revised_contract_sum + :approvedAmt,
        budget = budget + :approvedAmt
       WHERE id = :projectId`,
      { approvedAmt, projectId: v.project_id }
    );

    res.json({ ok: true, amount_approved: approvedAmt, message: "Variation approved and contract sum updated" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 9. QUALITY CONTROL (QA/QC)
// ==========================================

export const listInspections = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT ir.*, p.project_name FROM pm_inspection_requests ir JOIN pm_projects p ON p.id = ir.project_id WHERE ir.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND ir.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY ir.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createInspection = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.inspection_title) throw httpError(400, "VALIDATION_ERROR", "Project and inspection title required");

    const result = await query(
      `INSERT INTO pm_inspection_requests 
        (company_id, branch_id, project_id, ir_number, inspection_title, inspection_type, location_grid, scheduled_date, inspector_name, result, remarks, requested_by)
       VALUES 
        (:companyId, :branchId, :project_id, :ir_number, :inspection_title, :inspection_type, :location_grid, :scheduled_date, :inspector_name, :result, :remarks, :requested_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        ir_number: b.ir_number || `IR-${Date.now().toString().slice(-6)}`,
        inspection_title: b.inspection_title,
        inspection_type: b.inspection_type || "STRUCTURAL",
        location_grid: b.location_grid || null,
        scheduled_date: b.scheduled_date || new Date().toISOString().split("T")[0],
        inspector_name: b.inspector_name || null,
        result: b.result || "PENDING",
        remarks: b.remarks || null,
        requested_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Inspection scheduled" });
  } catch (err) {
    next(err);
  }
};

export const listNCRs = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT n.*, p.project_name FROM pm_ncrs n JOIN pm_projects p ON p.id = n.project_id WHERE n.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND n.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY n.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createNCR = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.issue_description) throw httpError(400, "VALIDATION_ERROR", "Project and issue description required");

    const result = await query(
      `INSERT INTO pm_ncrs 
        (company_id, project_id, ncr_number, issue_description, location_grid, root_cause, corrective_action, preventive_action, severity, status, issued_date, created_by)
       VALUES 
        (:companyId, :project_id, :ncr_number, :issue_description, :location_grid, :root_cause, :corrective_action, :preventive_action, :severity, :status, :issued_date, :created_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        ncr_number: b.ncr_number || `NCR-${Date.now().toString().slice(-6)}`,
        issue_description: b.issue_description,
        location_grid: b.location_grid || null,
        root_cause: b.root_cause || null,
        corrective_action: b.corrective_action || null,
        preventive_action: b.preventive_action || null,
        severity: b.severity || "MEDIUM",
        status: "OPEN",
        issued_date: b.issued_date || new Date().toISOString().split("T")[0],
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Non-conformance report issued" });
  } catch (err) {
    next(err);
  }
};

export const listSnagList = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT s.*, p.project_name FROM pm_snag_list s JOIN pm_projects p ON p.id = s.project_id WHERE s.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND s.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY s.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createSnagItem = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.defect_description) throw httpError(400, "VALIDATION_ERROR", "Project and defect description required");

    const result = await query(
      `INSERT INTO pm_snag_list (company_id, project_id, room_area, defect_description, trade_responsible, priority, status, created_by)
       VALUES (:companyId, :project_id, :room_area, :defect_description, :trade_responsible, :priority, :status, :created_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        room_area: b.room_area || null,
        defect_description: b.defect_description,
        trade_responsible: b.trade_responsible || null,
        priority: b.priority || "MEDIUM",
        status: "OPEN",
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Snag item logged" });
  } catch (err) {
    next(err);
  }
};

export const listMaterialTests = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT t.*, p.project_name FROM pm_material_tests t JOIN pm_projects p ON p.id = t.project_id WHERE t.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND t.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY t.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createMaterialTest = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.test_name) throw httpError(400, "VALIDATION_ERROR", "Project and test name required");

    const result = await query(
      `INSERT INTO pm_material_tests 
        (company_id, project_id, test_name, material_type, batch_number, sample_date, test_date, required_strength, achieved_strength, result, certificate_ref, lab_name, remarks, tested_by)
       VALUES 
        (:companyId, :project_id, :test_name, :material_type, :batch_number, :sample_date, :test_date, :required_strength, :achieved_strength, :result, :certificate_ref, :lab_name, :remarks, :tested_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        test_name: b.test_name,
        material_type: b.material_type || "CONCRETE",
        batch_number: b.batch_number || null,
        sample_date: b.sample_date || null,
        test_date: b.test_date || new Date().toISOString().split("T")[0],
        required_strength: b.required_strength || null,
        achieved_strength: b.achieved_strength || null,
        result: b.result || "PASS",
        certificate_ref: b.certificate_ref || null,
        lab_name: b.lab_name || null,
        remarks: b.remarks || null,
        tested_by: req.user?.username || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Material test record logged" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 10. HEALTH, SAFETY & ENVIRONMENT (HSE)
// ==========================================

export const listSafetyIncidents = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT i.*, p.project_name FROM pm_safety_incidents i JOIN pm_projects p ON p.id = i.project_id WHERE i.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND i.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY i.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createSafetyIncident = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.description) throw httpError(400, "VALIDATION_ERROR", "Project and incident description required");

    const result = await query(
      `INSERT INTO pm_safety_incidents 
        (company_id, project_id, incident_date, incident_type, location, injured_person_name, description, root_cause, corrective_action, days_lost, reported_to_authority, status, reported_by)
       VALUES 
        (:companyId, :project_id, :incident_date, :incident_type, :location, :injured_person_name, :description, :root_cause, :corrective_action, :days_lost, :reported_to_authority, :status, :reported_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        incident_date: b.incident_date || new Date().toISOString().split("T")[0],
        incident_type: b.incident_type || "NEAR_MISS",
        location: b.location || null,
        injured_person_name: b.injured_person_name || null,
        description: b.description,
        root_cause: b.root_cause || null,
        corrective_action: b.corrective_action || null,
        days_lost: Number(b.days_lost || 0),
        reported_to_authority: b.reported_to_authority || "N",
        status: b.status || "REPORTED",
        reported_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Safety incident logged" });
  } catch (err) {
    next(err);
  }
};

export const listToolboxTalks = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT t.*, p.project_name FROM pm_toolbox_talks t JOIN pm_projects p ON p.id = t.project_id WHERE t.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND t.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY t.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createToolboxTalk = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.topic) throw httpError(400, "VALIDATION_ERROR", "Project and topic required");

    const result = await query(
      `INSERT INTO pm_toolbox_talks (company_id, project_id, talk_date, topic, conductor_name, attendee_count, notes)
       VALUES (:companyId, :project_id, :talk_date, :topic, :conductor_name, :attendee_count, :notes)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        talk_date: b.talk_date || new Date().toISOString().split("T")[0],
        topic: b.topic,
        conductor_name: b.conductor_name || req.user?.username || null,
        attendee_count: Number(b.attendee_count || 0),
        notes: b.notes || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Toolbox talk recorded" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 11. TECHNICAL DOCUMENTS & RFIs
// ==========================================

export const listDocuments = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT d.*, p.project_name FROM pm_documents d JOIN pm_projects p ON p.id = d.project_id WHERE d.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND d.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY d.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createDocument = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.document_number || !b.title) throw httpError(400, "VALIDATION_ERROR", "Project, document number, and title required");

    const result = await query(
      `INSERT INTO pm_documents (company_id, project_id, document_number, title, discipline, category, current_revision, status, file_url, uploaded_by)
       VALUES (:companyId, :project_id, :document_number, :title, :discipline, :category, :current_revision, :status, :file_url, :uploaded_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        document_number: b.document_number,
        title: b.title,
        discipline: b.discipline || "ARCHITECTURAL",
        category: b.category || "DRAWING",
        current_revision: b.current_revision || "0",
        status: b.status || "APPROVED_FOR_CONSTRUCTION",
        file_url: b.file_url || null,
        uploaded_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "Document registered in drawing register" });
  } catch (err) {
    next(err);
  }
};

export const listRFIs = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT r.*, p.project_name FROM pm_rfis r JOIN pm_projects p ON p.id = r.project_id WHERE r.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND r.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY r.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createRFI = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.subject || !b.question) throw httpError(400, "VALIDATION_ERROR", "Project, subject, and question required");

    const result = await query(
      `INSERT INTO pm_rfis 
        (company_id, project_id, rfi_number, subject, question, drawing_reference, date_raised, due_date, cost_impact, schedule_impact, status, raised_by)
       VALUES 
        (:companyId, :project_id, :rfi_number, :subject, :question, :drawing_reference, :date_raised, :due_date, :cost_impact, :schedule_impact, :status, :raised_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        rfi_number: b.rfi_number || `RFI-${Date.now().toString().slice(-6)}`,
        subject: b.subject,
        question: b.question,
        drawing_reference: b.drawing_reference || null,
        date_raised: b.date_raised || new Date().toISOString().split("T")[0],
        due_date: b.due_date || null,
        cost_impact: b.cost_impact || "N",
        schedule_impact: b.schedule_impact || "N",
        status: "OPEN",
        raised_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, message: "RFI raised successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateRFI = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    await query(
      `UPDATE pm_rfis SET 
        answer = :answer, answered_by = :answered_by, answered_date = :answered_date, status = :status
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        answer: b.answer || null,
        answered_by: req.user?.id || null,
        answered_date: b.answer ? new Date().toISOString().split("T")[0] : null,
        status: b.status || (b.answer ? "CLOSED" : "OPEN"),
      }
    );
    res.json({ ok: true, message: "RFI updated" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 12. PLANT & EQUIPMENT MANAGEMENT
// ==========================================

export const listEquipmentLogs = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT l.*, p.project_name, eq.name AS equipment_name
               FROM pm_equipment_logs l
               JOIN pm_projects p ON p.id = l.project_id
               LEFT JOIN pm_equipments eq ON eq.id = l.equipment_id
               WHERE l.company_id = :companyId`;
    const params = { companyId };
    if (projectId) {
      sql += ` AND l.project_id = :projectId`;
      params.projectId = projectId;
    }
    sql += ` ORDER BY l.log_date DESC, l.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const createEquipmentLog = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.equipment_id) throw httpError(400, "VALIDATION_ERROR", "Project and equipment required");

    const hrsWorked = Number(b.hours_worked || 0);
    const hourlyRate = Number(b.hourly_rate || 0);
    const calculatedCost = hrsWorked * hourlyRate;

    const result = await query(
      `INSERT INTO pm_equipment_logs 
        (company_id, project_id, equipment_id, log_date, hours_worked, hours_idle, hours_breakdown, fuel_consumed_litres, operator_name, hourly_rate, total_cost, remarks, logged_by)
       VALUES 
        (:companyId, :project_id, :equipment_id, :log_date, :hours_worked, :hours_idle, :hours_breakdown, :fuel_consumed_litres, :operator_name, :hourly_rate, :total_cost, :remarks, :logged_by)`,
      {
        companyId,
        project_id: toNumber(b.project_id),
        equipment_id: toNumber(b.equipment_id),
        log_date: b.log_date || new Date().toISOString().split("T")[0],
        hours_worked: hrsWorked,
        hours_idle: Number(b.hours_idle || 0),
        hours_breakdown: Number(b.hours_breakdown || 0),
        fuel_consumed_litres: Number(b.fuel_consumed_litres || 0),
        operator_name: b.operator_name || null,
        hourly_rate: hourlyRate,
        total_cost: calculatedCost,
        remarks: b.remarks || null,
        logged_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, total_cost: calculatedCost, message: "Equipment operating log recorded" });
  } catch (err) {
    next(err);
  }
};
