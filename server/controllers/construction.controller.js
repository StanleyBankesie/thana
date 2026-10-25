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
      `SELECT t.*, COALESCE(c.customer_name, t.client_name, '') AS client_name, p.project_name 
       FROM pm_tenders t
       LEFT JOIN sal_customers c ON c.id = t.client_id
       LEFT JOIN pm_projects p ON p.id = t.awarded_project_id
       WHERE (t.company_id = :companyId OR :companyId IS NULL) ORDER BY t.id DESC`,
      { companyId: companyId || null }
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
      `SELECT t.*, COALESCE(c.customer_name, t.client_name, '') AS client_name 
       FROM pm_tenders t 
       LEFT JOIN sal_customers c ON c.id = t.client_id
       WHERE t.id = :id AND (t.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
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

    let sql = `SELECT b.*, 
                      p.project_name, 
                      p.project_code, 
                      COALESCE(b.client_name, p.client_name) AS client_name,
                      COALESCE(b.site_location, p.site_address) AS site_location,
                      t.tender_no AS tender_title,
                      u.username AS created_by_username,
                      (SELECT COUNT(*) FROM pm_boq_items WHERE boq_id = b.id) AS item_count
               FROM pm_boqs b
               LEFT JOIN pm_projects p ON p.id = b.project_id
               LEFT JOIN pm_tenders t ON t.id = b.tender_id
               LEFT JOIN adm_users u ON u.id = b.created_by
               WHERE (b.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || 1 };
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
    const boqs = await query(
      `SELECT b.*, 
              p.project_name, 
              p.project_code, 
              p.client_name AS proj_client_name, 
              p.site_address AS proj_site_address,
              p.site_city AS proj_site_city,
              u.username AS created_by_username
       FROM pm_boqs b
       LEFT JOIN pm_projects p ON p.id = b.project_id
       LEFT JOIN adm_users u ON u.id = b.created_by
       WHERE b.id = :id AND (b.company_id = :companyId OR :companyId IS NULL)
       LIMIT 1`,
      { id, companyId: companyId || 1 }
    );
    if (!boqs.length) throw httpError(404, "NOT_FOUND", "BOQ not found");

    const boq = boqs[0];
    if (!boq.client_name && boq.proj_client_name) {
      boq.client_name = boq.proj_client_name;
    }
    if (!boq.site_location && boq.proj_site_address) {
      boq.site_location = [boq.proj_site_address, boq.proj_site_city].filter(Boolean).join(", ");
    }

    const items = await query(
      `SELECT bi.*, 
              COALESCE(bi.quantity, bi.estimated_qty, 0) AS quantity,
              COALESCE(bi.unit_rate, bi.tender_rate, 0) AS unit_rate,
              COALESCE(bi.amount, bi.tender_amount, 0) AS amount,
              COALESCE(bi.item_description, '') AS description,
              COALESCE(bi.uom, 'EA') AS unit,
              COALESCE(bi.cost_category, 'MATERIALS') AS cost_category,
              cc.description AS cost_code_name, 
              cc.code AS cost_code
       FROM pm_boq_items bi
       LEFT JOIN pm_cost_codes cc ON cc.id = bi.cost_code_id
       WHERE bi.boq_id = :id 
       ORDER BY bi.item_order ASC, bi.id ASC`,
      { id }
    );

    const revisions = await query(
      `SELECT * FROM pm_boq_revisions WHERE boq_id = :id ORDER BY id DESC`,
      { id }
    ).catch(() => []);

    res.json({ item: boq, items, revisions });
  } catch (err) {
    next(err);
  }
};

export const createBOQ = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    const title = b.boq_title || b.title;
    if (!title) throw httpError(400, "VALIDATION_ERROR", "BOQ title is required");

    const projectId = toNumber(b.project_id);
    let clientName = b.client_name || "";
    let siteLocation = b.site_location || "";
    let projectCode = "";

    if (projectId) {
      const pRows = await query(`SELECT project_code, project_name, client_name, site_address, site_city FROM pm_projects WHERE id = :projectId LIMIT 1`, { projectId });
      if (pRows.length) {
        projectCode = pRows[0].project_code || "";
        if (!clientName) clientName = pRows[0].client_name || "";
        if (!siteLocation) siteLocation = [pRows[0].site_address, pRows[0].site_city].filter(Boolean).join(", ");
      }
    }

    const boqRef = b.boq_reference || b.boq_number || `BOQ-${projectCode ? projectCode + '-' : ''}${Date.now().toString().slice(-4)}`;
    const boqDate = b.boq_date || new Date().toISOString().split("T")[0];
    const version = b.version || "1.0";
    const currency = b.currency || "GHS";
    const subtotal = Number(b.subtotal || 0);
    const contingencyPercent = Number(b.contingency_percent || 0);
    const contingencyAmount = Number(b.contingency_amount || (subtotal * contingencyPercent / 100));
    const taxPercent = Number(b.tax_percent || 0);
    const taxAmount = Number(b.tax_amount || ((subtotal + contingencyAmount) * taxPercent / 100));
    const otherCharges = Number(b.other_charges || 0);
    const totalAmount = Number(b.total_amount || (subtotal + contingencyAmount + taxAmount + otherCharges));
    const status = b.status || "DRAFT";
    const prepByName = b.prepared_by_name || req.user?.username || req.user?.name || "System User";
    const prepDate = b.prepared_date || boqDate;

    const result = await query(
      `INSERT INTO pm_boqs (
        company_id, branch_id, project_id, tender_id, boq_reference, boq_title,
        client_name, site_location, boq_date, version, currency,
        subtotal, contingency_percent, contingency_amount, tax_code_id, tax_code, tax_percent, tax_amount, other_charges, total_amount,
        status, prepared_by_id, prepared_by_name, prepared_date,
        reviewed_by_name, reviewed_date, approved_by_name, approved_date,
        remarks, created_by
      ) VALUES (
        :companyId, :branchId, :project_id, :tender_id, :boq_reference, :boq_title,
        :client_name, :site_location, :boq_date, :version, :currency,
        :subtotal, :contingency_percent, :contingency_amount, :tax_code_id, :tax_code, :tax_percent, :tax_amount, :other_charges, :total_amount,
        :status, :prepared_by_id, :prepared_by_name, :prepared_date,
        :reviewed_by_name, :reviewed_date, :approved_by_name, :approved_date,
        :remarks, :created_by
      )`,
      {
        companyId: companyId || 1,
        branchId: branchId || null,
        project_id: projectId,
        tender_id: toNumber(b.tender_id),
        boq_reference: boqRef,
        boq_title: title,
        client_name: clientName,
        site_location: siteLocation,
        boq_date: boqDate,
        version,
        currency,
        subtotal,
        contingency_percent: contingencyPercent,
        contingency_amount: contingencyAmount,
        tax_code_id: toNumber(b.tax_code_id),
        tax_code: b.tax_code || null,
        tax_percent: taxPercent,
        tax_amount: taxAmount,
        other_charges: otherCharges,
        total_amount: totalAmount,
        status,
        prepared_by_id: req.user?.id || null,
        prepared_by_name: prepByName,
        prepared_date: prepDate,
        reviewed_by_name: b.reviewed_by_name || null,
        reviewed_date: b.reviewed_date || null,
        approved_by_name: b.approved_by_name || null,
        approved_date: b.approved_date || null,
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
      }
    );

    const boqId = result.insertId;

    // Insert initial revision snapshot
    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks, snapshot_json
        ) VALUES (
          :boq_id, :version, :revision_date, :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, :status, :remarks, :snapshot_json
        )`,
        {
          boq_id: boqId,
          version,
          revision_date: boqDate,
          prepared_by: prepByName,
          reviewed_by: b.reviewed_by_name || null,
          approved_by: b.approved_by_name || null,
          subtotal,
          contingency_amount: contingencyAmount,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          status,
          remarks: "Initial BOQ creation",
          snapshot_json: JSON.stringify({ header: b, items: b.items || [] })
        }
      );
    } catch (e) {}

    // If initial items were provided
    if (Array.isArray(b.items) && b.items.length > 0) {
      let runningSubtotal = 0;
      let idx = 0;
      for (const itm of b.items) {
        idx++;
        const qty = Number(itm.quantity || itm.estimated_qty || 0);
        const rate = Number(itm.unit_rate || itm.tender_rate || 0);
        const amt = Number(itm.amount || itm.total_amount || (qty * rate));
        runningSubtotal += amt;
        const taxRate = Number(itm.tax_rate_percent || 0);
        const itmTaxAmt = (amt * taxRate) / 100;

        await query(
          `INSERT INTO pm_boq_items (
            company_id, boq_id, project_id, item_code, item_description, uom,
            cost_category, quantity, unit_rate, amount, tax_rate_percent, tax_amount,
            estimated_qty, tender_rate, tender_amount, item_order, remarks
          ) VALUES (
            :companyId, :boq_id, :project_id, :item_code, :item_description, :uom,
            :cost_category, :quantity, :unit_rate, :amount, :tax_rate_percent, :tax_amount,
            :estimated_qty, :tender_rate, :tender_amount, :item_order, :remarks
          )`,
          {
            companyId: companyId || 1,
            boq_id: boqId,
            project_id: projectId,
            item_code: itm.item_code || `ITM-${idx}`,
            item_description: itm.item_description || itm.description || "",
            uom: itm.uom || itm.unit || "EA",
            cost_category: itm.cost_category || "MATERIALS",
            quantity: qty,
            unit_rate: rate,
            amount: amt,
            tax_rate_percent: taxRate,
            tax_amount: itmTaxAmt,
            estimated_qty: qty,
            tender_rate: rate,
            tender_amount: amt,
            item_order: idx,
            remarks: itm.remarks || null,
          }
        );
      }

      const finalContingency = (runningSubtotal * contingencyPercent) / 100;
      const finalTax = ((runningSubtotal + finalContingency) * taxPercent) / 100;
      const finalTotal = runningSubtotal + finalContingency + finalTax + otherCharges;

      await query(
        `UPDATE pm_boqs SET 
           subtotal = :subtotal, 
           contingency_amount = :contingencyAmount, 
           tax_amount = :taxAmount, 
           total_amount = :finalTotal
         WHERE id = :boqId`,
        { subtotal: runningSubtotal, contingencyAmount: finalContingency, taxAmount: finalTax, finalTotal, boqId }
      );
    }

    res.status(201).json({ id: boqId, boq_reference: boqRef, message: "BOQ created successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const boqCheck = await query(`SELECT id FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqCheck.length) throw httpError(404, "NOT_FOUND", "BOQ not found");

    await query(
      `UPDATE pm_boqs SET
        boq_reference = COALESCE(:boq_reference, boq_reference),
        boq_title = COALESCE(:boq_title, boq_title),
        client_name = COALESCE(:client_name, client_name),
        site_location = COALESCE(:site_location, site_location),
        boq_date = COALESCE(:boq_date, boq_date),
        version = COALESCE(:version, version),
        currency = COALESCE(:currency, currency),
        contingency_percent = COALESCE(:contingency_percent, contingency_percent),
        contingency_amount = COALESCE(:contingency_amount, contingency_amount),
        tax_percent = COALESCE(:tax_percent, tax_percent),
        tax_amount = COALESCE(:tax_amount, tax_amount),
        other_charges = COALESCE(:other_charges, other_charges),
        subtotal = COALESCE(:subtotal, subtotal),
        total_amount = COALESCE(:total_amount, total_amount),
        status = COALESCE(:status, status),
        prepared_by_name = COALESCE(:prepared_by_name, prepared_by_name),
        prepared_date = COALESCE(:prepared_date, prepared_date),
        reviewed_by_name = COALESCE(:reviewed_by_name, reviewed_by_name),
        reviewed_date = COALESCE(:reviewed_date, reviewed_date),
        approved_by_name = COALESCE(:approved_by_name, approved_by_name),
        approved_date = COALESCE(:approved_date, approved_date),
        approval_remarks = COALESCE(:approval_remarks, approval_remarks),
        remarks = COALESCE(:remarks, remarks)
      WHERE id = :id`,
      {
        id,
        boq_reference: b.boq_reference || null,
        boq_title: b.boq_title || b.title || null,
        client_name: b.client_name || null,
        site_location: b.site_location || null,
        boq_date: b.boq_date || null,
        version: b.version || null,
        currency: b.currency || null,
        contingency_percent: b.contingency_percent !== undefined ? Number(b.contingency_percent) : null,
        contingency_amount: b.contingency_amount !== undefined ? Number(b.contingency_amount) : null,
        tax_percent: b.tax_percent !== undefined ? Number(b.tax_percent) : null,
        tax_amount: b.tax_amount !== undefined ? Number(b.tax_amount) : null,
        other_charges: b.other_charges !== undefined ? Number(b.other_charges) : null,
        subtotal: b.subtotal !== undefined ? Number(b.subtotal) : null,
        total_amount: b.total_amount !== undefined ? Number(b.total_amount) : null,
        status: b.status || null,
        prepared_by_name: b.prepared_by_name || null,
        prepared_date: b.prepared_date || null,
        reviewed_by_name: b.reviewed_by_name || null,
        reviewed_date: b.reviewed_date || null,
        approved_by_name: b.approved_by_name || null,
        approved_date: b.approved_date || null,
        approval_remarks: b.approval_remarks || null,
        remarks: b.remarks || null,
      }
    );

    res.json({ ok: true, message: "BOQ updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const saveBOQItems = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const boqId = toNumber(req.params.id);
    const { 
      items = [], 
      contingency_percent, 
      tax_percent, 
      other_charges,
      version,
      status,
      prepared_by_name,
      reviewed_by_name,
      approved_by_name,
      remarks,
      record_revision = false,
      revision_remarks = ""
    } = req.body;

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :boqId AND (company_id = :companyId OR :companyId IS NULL)`, { boqId, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const currentBoq = boqRows[0];

    // Delete existing items and insert refreshed list
    await query(`DELETE FROM pm_boq_items WHERE boq_id = :boqId`, { boqId });

    let runningSubtotal = 0;
    let idx = 0;

    for (const itm of items) {
      idx++;
      const qty = Number(itm.quantity !== undefined ? itm.quantity : (itm.estimated_qty || 0));
      const rate = Number(itm.unit_rate !== undefined ? itm.unit_rate : (itm.tender_rate || 0));
      const amt = Number(itm.amount !== undefined ? itm.amount : (itm.total_amount !== undefined ? itm.total_amount : (qty * rate)));
      runningSubtotal += amt;

      const taxRate = Number(itm.tax_rate_percent || 0);
      const itmTaxAmt = (amt * taxRate) / 100;
      const uom = itm.uom || itm.unit || "EA";
      const desc = itm.item_description || itm.description || "";
      const cat = itm.cost_category || "MATERIALS";
      const code = itm.item_code || `ITM-${idx}`;

      await query(
        `INSERT INTO pm_boq_items (
          company_id, boq_id, project_id, item_code, item_description, uom,
          cost_category, quantity, unit_rate, amount, tax_rate_percent, tax_amount,
          estimated_qty, tender_rate, tender_amount, item_order, remarks
        ) VALUES (
          :companyId, :boq_id, :project_id, :item_code, :item_description, :uom,
          :cost_category, :quantity, :unit_rate, :amount, :tax_rate_percent, :tax_amount,
          :estimated_qty, :tender_rate, :tender_amount, :item_order, :remarks
        )`,
        {
          companyId: companyId || 1,
          boq_id: boqId,
          project_id: currentBoq.project_id,
          item_code: code,
          item_description: desc,
          uom,
          cost_category: cat,
          quantity: qty,
          unit_rate: rate,
          amount: amt,
          tax_rate_percent: taxRate,
          tax_amount: itmTaxAmt,
          estimated_qty: qty,
          tender_rate: rate,
          tender_amount: amt,
          item_order: itm.item_order || idx,
          remarks: itm.remarks || null,
        }
      );
    }

    const contPct = contingency_percent !== undefined ? Number(contingency_percent) : Number(currentBoq.contingency_percent || 0);
    const contAmt = (runningSubtotal * contPct) / 100;
    const taxPct = tax_percent !== undefined ? Number(tax_percent) : Number(currentBoq.tax_percent || 0);
    const taxAmt = ((runningSubtotal + contAmt) * taxPct) / 100;
    const otherChg = other_charges !== undefined ? Number(other_charges) : Number(currentBoq.other_charges || 0);
    const finalTotal = runningSubtotal + contAmt + taxAmt + otherChg;

    await query(
      `UPDATE pm_boqs SET 
         subtotal = :subtotal,
         contingency_percent = :contingency_percent,
         contingency_amount = :contingency_amount,
         tax_code_id = COALESCE(:tax_code_id, tax_code_id),
         tax_code = COALESCE(:tax_code, tax_code),
         tax_percent = :tax_percent,
         tax_amount = :tax_amount,
         other_charges = :other_charges,
         total_amount = :total_amount,
         version = COALESCE(:version, version),
         status = COALESCE(:status, status),
         prepared_by_name = COALESCE(:prepared_by_name, prepared_by_name),
         reviewed_by_name = COALESCE(:reviewed_by_name, reviewed_by_name),
         approved_by_name = COALESCE(:approved_by_name, approved_by_name),
         remarks = COALESCE(:remarks, remarks)
       WHERE id = :boqId`,
      {
        subtotal: runningSubtotal,
        contingency_percent: contPct,
        contingency_amount: contAmt,
        tax_code_id: req.body.tax_code_id !== undefined ? toNumber(req.body.tax_code_id) : null,
        tax_code: req.body.tax_code || null,
        tax_percent: taxPct,
        tax_amount: taxAmt,
        other_charges: otherChg,
        total_amount: finalTotal,
        version: version || null,
        status: status || null,
        prepared_by_name: prepared_by_name || null,
        reviewed_by_name: reviewed_by_name || null,
        approved_by_name: approved_by_name || null,
        remarks: remarks || null,
        boqId,
      }
    );

    // Save revision entry if requested
    if (record_revision) {
      try {
        await query(
          `INSERT INTO pm_boq_revisions (
            boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
            subtotal, contingency_amount, tax_amount, total_amount, status, remarks, snapshot_json
          ) VALUES (
            :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
            :subtotal, :contingency_amount, :tax_amount, :total_amount, :status, :remarks, :snapshot_json
          )`,
          {
            boq_id: boqId,
            version: version || currentBoq.version || "1.0",
            prepared_by: prepared_by_name || currentBoq.prepared_by_name || null,
            reviewed_by: reviewed_by_name || currentBoq.reviewed_by_name || null,
            approved_by: approved_by_name || currentBoq.approved_by_name || null,
            subtotal: runningSubtotal,
            contingency_amount: contAmt,
            tax_amount: taxAmt,
            total_amount: finalTotal,
            status: status || currentBoq.status || "DRAFT",
            remarks: revision_remarks || remarks || `Revision update with ${items.length} items`,
            snapshot_json: JSON.stringify({ items, subtotal: runningSubtotal, total_amount: finalTotal })
          }
        );
      } catch (e) {}
    }

    res.json({
      ok: true,
      subtotal: runningSubtotal,
      contingency_amount: contAmt,
      tax_amount: taxAmt,
      total_amount: finalTotal,
      item_count: items.length,
      message: "BOQ items and calculated totals saved successfully"
    });
  } catch (err) {
    next(err);
  }
};

export const updateBOQStatus = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { status, approved_by_name, approved_date, approval_remarks } = req.body;
    if (!status) throw httpError(400, "VALIDATION_ERROR", "Status is required");

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    const appName = approved_by_name || (status === 'APPROVED' ? (req.user?.username || req.user?.name || "Project Director") : boq.approved_by_name);
    const appDate = approved_date || (status === 'APPROVED' ? new Date().toISOString().split("T")[0] : boq.approved_date);

    await query(
      `UPDATE pm_boqs SET 
         status = :status, 
         approved_by_name = :approved_by_name, 
         approved_date = :approved_date, 
         approval_remarks = :approval_remarks 
       WHERE id = :id`,
      {
        status,
        approved_by_name: appName,
        approved_date: appDate,
        approval_remarks: approval_remarks || null,
        id
      }
    );

    // Record revision entry on approval / status transition
    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks
        ) VALUES (
          :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, :status, :remarks
        )`,
        {
          boq_id: id,
          version: boq.version || "1.0",
          prepared_by: boq.prepared_by_name,
          reviewed_by: boq.reviewed_by_name,
          approved_by: appName,
          subtotal: boq.subtotal,
          contingency_amount: boq.contingency_amount,
          tax_amount: boq.tax_amount,
          total_amount: boq.total_amount,
          status,
          remarks: approval_remarks || `Status transitioned to ${status}`
        }
      );
    } catch (e) {}

    res.json({ ok: true, status, message: `BOQ status transitioned to ${status}` });
  } catch (err) {
    next(err);
  }
};

export const createBOQRevision = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { new_version, revision_remarks } = req.body;

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    const items = await query(`SELECT * FROM pm_boq_items WHERE boq_id = :id`, { id });
    const currentVerNum = parseFloat(boq.version || "1.0") || 1.0;
    const nextVer = new_version || (currentVerNum + 1.0).toFixed(1);

    await query(
      `UPDATE pm_boqs SET version = :nextVer, status = 'REVISED' WHERE id = :id`,
      { nextVer, id }
    );

    await query(
      `INSERT INTO pm_boq_revisions (
        boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
        subtotal, contingency_amount, tax_amount, total_amount, status, remarks, snapshot_json
      ) VALUES (
        :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
        :subtotal, :contingency_amount, :tax_amount, :total_amount, 'REVISED', :remarks, :snapshot_json
      )`,
      {
        boq_id: id,
        version: nextVer,
        prepared_by: req.user?.username || boq.prepared_by_name,
        reviewed_by: boq.reviewed_by_name,
        approved_by: null,
        subtotal: boq.subtotal,
        contingency_amount: boq.contingency_amount,
        tax_amount: boq.tax_amount,
        total_amount: boq.total_amount,
        remarks: revision_remarks || `New revision ${nextVer} initialized`,
        snapshot_json: JSON.stringify({ header: boq, items })
      }
    );

    res.json({ ok: true, version: nextVer, message: `New revision ${nextVer} created successfully` });
  } catch (err) {
    next(err);
  }
};

export const getBOQRevisions = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    const revisions = await query(`SELECT * FROM pm_boq_revisions WHERE boq_id = :id ORDER BY id DESC`, { id });
    res.json({ revisions });
  } catch (err) {
    next(err);
  }
};

export const deleteBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);

    await query(`DELETE FROM pm_rate_analyses WHERE boq_item_id IN (SELECT id FROM pm_boq_items WHERE boq_id = :id)`, { id });
    await query(`DELETE FROM pm_boq_items WHERE boq_id = :id`, { id });
    await query(`DELETE FROM pm_boq_revisions WHERE boq_id = :id`, { id });
    await query(`DELETE FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });

    res.json({ ok: true, message: "BOQ deleted successfully" });
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
    if (!projectId) {
      return res.status(400).json({ message: "Valid project ID is required" });
    }

    // 1. Fetch Project Master
    const projRows = await query(
      `SELECT id, project_code, project_name, client_name, contract_sum, revised_contract_sum, budget, completion_percent, start_date, end_date
       FROM pm_projects WHERE id = :projectId AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { projectId, companyId: companyId || null }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const proj = projRows[0];
    let currency = "GH₵";

    // 2. Fetch Latest/Approved BOQ & BOQ Item Category Budgets
    let activeBOQ = null;
    let boqCategories = {
      MATERIALS: 0,
      LABOUR: 0,
      EQUIPMENT: 0,
      SUBCONTRACTING: 0,
      TRANSPORTATION: 0,
      OTHER: 0
    };
    try {
      const boqRows = await query(
        `SELECT id, boq_reference, boq_title, version, status, subtotal, contingency_percent, contingency_amount, tax_percent, tax_amount, other_charges, total_amount, currency
         FROM pm_boqs WHERE project_id = :projectId
         ORDER BY CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END, id DESC LIMIT 1`,
        { projectId }
      );
      if (boqRows.length) {
        activeBOQ = boqRows[0];
        if (activeBOQ.currency) currency = activeBOQ.currency;
        const catRows = await query(
          `SELECT UPPER(COALESCE(cost_category, 'OTHER')) AS category,
                  COALESCE(SUM(amount), 0) AS total_amount,
                  COUNT(*) as item_count
           FROM pm_boq_items
           WHERE boq_id = :boqId
           GROUP BY UPPER(COALESCE(cost_category, 'OTHER'))`,
          { boqId: activeBOQ.id }
        );
        catRows.forEach(r => {
          const cat = (r.category || "").trim();
          if (boqCategories[cat] !== undefined) {
            boqCategories[cat] = Number(r.total_amount || 0);
          } else if (cat === "MATERIAL") {
            boqCategories.MATERIALS += Number(r.total_amount || 0);
          } else if (cat === "LABOR") {
            boqCategories.LABOUR += Number(r.total_amount || 0);
          } else if (cat === "SUBCONTRACT") {
            boqCategories.SUBCONTRACTING += Number(r.total_amount || 0);
          } else if (cat === "TRANSPORT") {
            boqCategories.TRANSPORTATION += Number(r.total_amount || 0);
          } else {
            boqCategories.OTHER += Number(r.total_amount || 0);
          }
        });
      }
    } catch (e) {
      console.warn("BOQ query error in cost control:", e.message);
    }

    // 3. Approved Budget Lines from pm_budget_lines
    let budgetLines = [];
    try {
      budgetLines = await query(
        `SELECT bl.*, cc.description AS cost_code_name, cc.code AS cost_code, cc.category AS cost_category
         FROM pm_budget_lines bl
         LEFT JOIN pm_project_budgets pb ON pb.id = bl.budget_id
         LEFT JOIN pm_cost_codes cc ON cc.id = bl.cost_code_id
         WHERE pb.project_id = :projectId AND (pb.status = 'APPROVED' OR pb.status IS NULL)
         ORDER BY cc.code ASC`,
        { projectId }
      );
    } catch (e) {}

    // 4. Actual Direct Expenses (from pm_expenses) grouped by category
    let directExpenses = 0;
    let expensesByCategory = {
      MATERIALS: 0,
      LABOUR: 0,
      EQUIPMENT: 0,
      SUBCONTRACTING: 0,
      TRANSPORTATION: 0,
      OTHER: 0
    };
    try {
      const expRows = await query(
        `SELECT UPPER(COALESCE(category, 'OTHER')) AS category,
                COALESCE(SUM(amount), 0) AS category_total
         FROM pm_expenses WHERE project_id = :projectId
         GROUP BY UPPER(COALESCE(category, 'OTHER'))`,
        { projectId }
      );
      expRows.forEach(r => {
        const cat = (r.category || "").trim();
        const amt = Number(r.category_total || 0);
        directExpenses += amt;
        if (expensesByCategory[cat] !== undefined) {
          expensesByCategory[cat] += amt;
        } else if (cat === "MATERIAL") {
          expensesByCategory.MATERIALS += amt;
        } else if (cat === "LABOR") {
          expensesByCategory.LABOUR += amt;
        } else if (cat === "SUBCONTRACT") {
          expensesByCategory.SUBCONTRACTING += amt;
        } else if (cat === "TRANSPORT") {
          expensesByCategory.TRANSPORTATION += amt;
        } else {
          expensesByCategory.OTHER += amt;
        }
      });
    } catch (e) {}

    // 5. Materials Consumed (Inventory Integration from pm_material_utilization)
    let materialUtilizationCost = 0;
    try {
      const matRows = await query(
        `SELECT COALESCE(SUM(mui.required_qty * COALESCE(mui.cost_price, 0)), 0) AS mat_total
         FROM pm_material_utilization_items mui
         JOIN pm_material_utilization mu ON mu.id = mui.utilization_id
         WHERE mu.project_id = :projectId AND mu.status NOT IN ('CANCELLED', 'DRAFT')`,
        { projectId }
      );
      materialUtilizationCost = Number(matRows[0]?.mat_total || 0);
      expensesByCategory.MATERIALS += materialUtilizationCost;
    } catch (e) {}

    // 6. Certified Subcontract Valuations (from pm_subcontract_valuations)
    let subValuations = 0;
    try {
      const svRows = await query(
        `SELECT COALESCE(SUM(net_payable), 0) AS sub_total 
         FROM pm_subcontract_valuations 
         WHERE project_id = :projectId AND status IN ('CERTIFIED', 'APPROVED', 'PAID')`,
        { projectId }
      );
      subValuations = Number(svRows[0]?.sub_total || 0);
      expensesByCategory.SUBCONTRACTING += subValuations;
    } catch (e) {}

    // 7. Labour Timesheet Actuals (from pm_timesheets)
    let timesheetLabourCost = 0;
    try {
      const tsRows = await query(
        `SELECT COALESCE(SUM(hours * 25.00), 0) AS labour_cost 
         FROM pm_timesheets WHERE project_id = :projectId`,
        { projectId }
      );
      timesheetLabourCost = Number(tsRows[0]?.labour_cost || 0);
      expensesByCategory.LABOUR += timesheetLabourCost;
    } catch (e) {}

    // 8. Committed Purchase Orders (from pm_orders)
    let poCommitted = 0;
    let purchaseOrders = [];
    try {
      const poRows = await query(
        `SELECT id, order_no, order_date, status, total_amount, remarks
         FROM pm_orders
         WHERE project_id = :projectId AND status NOT IN ('CANCELLED', 'REJECTED')
         ORDER BY id DESC`,
        { projectId }
      );
      purchaseOrders = poRows;
      poCommitted = poRows.reduce((sum, r) => sum + Number(r.total_amount || 0), 0);
    } catch (e) {}

    // 9. Cost Calculations based on User Specification
    const originalContractSum = Number(proj.contract_sum || 0);
    const revisedContractSum = Number(proj.revised_contract_sum || proj.contract_sum || 0);
    const boqEstimatedCost = activeBOQ ? Number(activeBOQ.total_amount || 0) : 0;
    const projectSetBudget = Number(proj.budget || 0);

    // Effective Approved Budget
    const approvedBudget = projectSetBudget > 0 
      ? projectSetBudget 
      : (boqEstimatedCost > 0 ? boqEstimatedCost : revisedContractSum);

    // Actual Cost Incurred (Expenses + Subcontracts + Labour + Consumed Materials)
    const actualCost = directExpenses + subValuations + timesheetLabourCost + materialUtilizationCost;

    // Remaining Budget: Approved budget − Actual cost
    const remainingBudget = approvedBudget - actualCost;

    // Available budget after commitments: Remaining budget − Committed cost
    const availableBudget = remainingBudget - poCommitted;

    // Cost Variance: Budget − Actual cost (Positive = under budget / savings, Negative = over budget / overrun)
    const costVariance = approvedBudget - actualCost;
    const costVariancePercent = approvedBudget > 0 ? Number(((approvedBudget - actualCost) / approvedBudget * 100).toFixed(2)) : 0;

    // Cost Overrun: Actual - Budget (if Actual > Budget)
    const costOverrun = actualCost > approvedBudget ? (actualCost - approvedBudget) : 0;
    const costOverrunPercent = approvedBudget > 0 ? Number(((costOverrun / approvedBudget) * 100).toFixed(2)) : 0;

    // Budget Utilization: Actual cost ÷ Budget × 100
    const budgetUtilizationPercent = approvedBudget > 0 ? Number(((actualCost / approvedBudget) * 100).toFixed(2)) : 0;

    // Total Committed + Incurred
    const totalCommittedAndActual = actualCost + poCommitted;
    const totalUtilizationWithCommitments = approvedBudget > 0 ? Number(((totalCommittedAndActual / approvedBudget) * 100).toFixed(2)) : 0;

    // EVM & Completion Calculations
    const completionPercent = Number(proj.completion_percent || 0);
    const earnedValue = (approvedBudget * completionPercent) / 100;
    const cpi = actualCost > 0 ? Number((earnedValue / actualCost).toFixed(2)) : 1.0;
    const spi = approvedBudget > 0 ? Number((earnedValue / (approvedBudget * 0.5 || 1)).toFixed(2)) : 1.0;

    // Forecast Final Cost: Actual cost + estimated remaining cost
    let estimatedRemainingCost = 0;
    if (completionPercent >= 100) {
      estimatedRemainingCost = 0;
    } else if (completionPercent > 0 && cpi > 0) {
      estimatedRemainingCost = Math.max(0, (approvedBudget - earnedValue) / cpi);
    } else {
      estimatedRemainingCost = Math.max(0, approvedBudget - actualCost);
    }
    const forecastFinalCost = Number((actualCost + poCommitted + estimatedRemainingCost).toFixed(2));
    const projectedOverrun = forecastFinalCost > approvedBudget ? Number((forecastFinalCost - approvedBudget).toFixed(2)) : 0;

    // Contingency: Allocated from BOQ, used, remaining
    const contingencyAllocated = activeBOQ ? Number(activeBOQ.contingency_amount || 0) : 0;
    const contingencyUsed = Math.min(contingencyAllocated, Math.max(0, costOverrun));
    const contingencyRemaining = Math.max(0, contingencyAllocated - contingencyUsed);

    // Cost Category Breakdown Table (Matching dustbin / labour / transportation example)
    const categoryKeys = ["MATERIALS", "LABOUR", "EQUIPMENT", "SUBCONTRACTING", "TRANSPORTATION", "OTHER"];
    const categoryLabels = {
      MATERIALS: "Materials & Consumables",
      LABOUR: "Labour & Direct Workforce",
      EQUIPMENT: "Plant & Equipment",
      SUBCONTRACTING: "Subcontractor Works",
      TRANSPORTATION: "Logistics & Transportation",
      OTHER: "Other Site & Direct Expenses"
    };

    const categoryBreakdown = categoryKeys.map(cat => {
      const catBudget = boqCategories[cat] || 0;
      const catActual = expensesByCategory[cat] || 0;
      const catVariance = catBudget - catActual; // positive: under budget, negative: overrun
      const catOverrun = catActual > catBudget ? (catActual - catBudget) : 0;
      const catVariancePct = catBudget > 0 ? Number(((catVariance / catBudget) * 100).toFixed(1)) : 0;
      const catUtilPct = catBudget > 0 ? Number(((catActual / catBudget) * 100).toFixed(1)) : (catActual > 0 ? 100 : 0);

      let status = "UNDER_BUDGET"; // green
      if (catActual > catBudget && catBudget > 0) {
        status = "OVERRUN"; // red
      } else if (catUtilPct >= 80) {
        status = "WARNING"; // amber
      } else if (catBudget === 0 && catActual > 0) {
        status = "UNBUDGETED"; // orange
      }

      return {
        category: cat,
        label: categoryLabels[cat] || cat,
        budget: catBudget,
        actual: catActual,
        variance: catVariance,
        overrun: catOverrun,
        variance_percent: catVariancePct,
        utilization_percent: catUtilPct,
        status
      };
    });

    // Automated Alerts
    const alerts = [];
    if (actualCost > approvedBudget) {
      alerts.push({
        type: "CRITICAL",
        title: "Budget Overrun Incurred",
        message: `Project actual expenditure has exceeded the approved budget by ${currency} ${costOverrun.toLocaleString(undefined, { minimumFractionDigits: 2 })} (${costOverrunPercent}% overrun). Immediate corrective action and budget revision required.`
      });
    } else if (budgetUtilizationPercent >= 80) {
      alerts.push({
        type: "WARNING",
        title: "High Budget Consumption",
        message: `Budget utilization has reached ${budgetUtilizationPercent}%. Available uncommitted budget is ${currency} ${availableBudget.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      });
    }

    if (availableBudget < 0 && actualCost <= approvedBudget) {
      alerts.push({
        type: "WARNING",
        title: "Commitment Over-Allocation",
        message: `Total purchase commitments (${currency} ${poCommitted.toLocaleString(undefined, { minimumFractionDigits: 2 })}) plus actual costs exceed the approved budget by ${currency} ${Math.abs(availableBudget).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
      });
    }

    // Category overruns
    categoryBreakdown.filter(c => c.status === "OVERRUN").forEach(c => {
      alerts.push({
        type: "CATEGORY_ALERT",
        title: `${c.label} Exceeded Budget`,
        message: `${c.label} costs (${currency} ${c.actual.toLocaleString()}) exceeded the budget of ${currency} ${c.budget.toLocaleString()} by ${currency} ${c.overrun.toLocaleString()} (+${Math.abs(c.variance_percent)}%).`
      });
    });

    res.json({
      project: proj,
      activeBOQ,
      budgetLines,
      purchaseOrders,
      cost_summary: {
        currency,
        original_contract_sum: originalContractSum,
        revised_contract_sum: revisedContractSum,
        boq_estimated_cost: boqEstimatedCost,
        approved_budget: approvedBudget,
        actual_cost: actualCost,
        committed_cost: poCommitted,
        remaining_budget: remainingBudget,
        available_budget: availableBudget,
        cost_variance: costVariance,
        cost_variance_percent: costVariancePercent,
        cost_overrun: costOverrun,
        cost_overrun_percent: costOverrunPercent,
        budget_utilization_percent: budgetUtilizationPercent,
        total_committed_and_actual: totalCommittedAndActual,
        total_utilization_with_commitments: totalUtilizationWithCommitments,
        forecast_final_cost: forecastFinalCost,
        projected_overrun: projectedOverrun,
        contingency_allocated: contingencyAllocated,
        contingency_used: contingencyUsed,
        contingency_remaining: contingencyRemaining,
        // EVM metrics
        earned_value: earnedValue,
        cpi,
        spi,
        // Cost Breakdown by cross-module source
        direct_expenses: directExpenses,
        materials_consumed: materialUtilizationCost,
        subcontractor_valuations: subValuations,
        labour_costs: timesheetLabourCost,
        category_breakdown: categoryBreakdown,
        alerts
      }
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

// ==========================================
// 4. INTEGRATED PROJECT SCHEDULE & CPM ENGINE
// ==========================================

export const getProjectSchedule = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);
    await ensureConstructionTables();

    // 1. Fetch project info
    const projRows = await query(
      `SELECT p.id, p.project_name, p.project_code, p.start_date, p.end_date,
              p.practical_completion_date, p.final_completion_date,
              p.budget, p.contract_sum, p.revised_contract_sum,
              COALESCE(p.project_status, 'IN_PROGRESS') AS status, p.site_address, p.project_type,
              COALESCE(p.manager_name, u.full_name, u.username, 'Project Manager') AS manager_name
       FROM pm_projects p
       LEFT JOIN adm_users u ON u.id = p.manager_id
       WHERE p.id = :projectId AND (p.company_id = :companyId OR :companyId IS NULL)
       LIMIT 1`,
      { projectId, companyId: companyId || null }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const project = projRows[0];

    // 2. Fetch work packages
    const workPackages = await query(
      `SELECT id, package_name, package_code, status
       FROM pm_work_packages
       WHERE project_id = :projectId
       ORDER BY package_code ASC, id ASC`,
      { projectId }
    );

    // 3. Fetch active tasks
    const tasks = await query(
      `SELECT t.id, t.project_id, t.wbs_code, t.work_package_id, t.task_title, t.task_description,
              t.assigned_to_id, t.assigned_to_name, t.priority, t.status,
              t.start_date, t.end_date, t.baseline_start, t.baseline_end,
              COALESCE(t.duration_days, DATEDIFF(COALESCE(t.end_date, CURDATE()), COALESCE(t.start_date, CURDATE())), 1) AS duration_days,
              t.completion_percent, t.early_start, t.early_finish, t.late_start, t.late_finish,
              t.total_float, t.free_float, t.is_critical, t.reason_for_delay,
              wp.package_name AS work_package_name
       FROM pm_tasks t
       LEFT JOIN pm_work_packages wp ON wp.id = t.work_package_id
       WHERE t.project_id = :projectId AND (t.is_active = 'Y' OR t.is_active IS NULL)
       ORDER BY t.wbs_code ASC, t.id ASC`,
      { projectId }
    );

    // 4. Fetch dependencies
    const dependencies = await query(
      `SELECT d.id, d.task_id, d.predecessor_id, d.dependency_type, d.lag_days,
              pred.task_title AS predecessor_title, pred.wbs_code AS predecessor_wbs
       FROM pm_task_dependencies d
       JOIN pm_tasks t ON t.id = d.task_id
       JOIN pm_tasks pred ON pred.id = d.predecessor_id
       WHERE t.project_id = :projectId`,
      { projectId }
    );

    // 5. Fetch EOT claims
    const eotClaims = await query(
      `SELECT * FROM pm_eot_requests WHERE project_id = :projectId ORDER BY id DESC`,
      { projectId }
    );

    // 6. Run CPM calculation
    const baseDate = project.start_date || new Date().toISOString().split("T")[0];
    const cpmResult = calculateCPM(tasks, baseDate, dependencies, { calendar: "6_DAY" });

    // 7. Group dependencies by task
    const predMap = new Map();
    const succMap = new Map();
    for (const d of dependencies) {
      if (!predMap.has(d.task_id)) predMap.set(d.task_id, []);
      predMap.get(d.task_id).push({
        id: d.id,
        predecessor_id: d.predecessor_id,
        dependency_type: d.dependency_type || "FS",
        lag_days: d.lag_days || 0,
        predecessor_title: d.predecessor_title,
        predecessor_wbs: d.predecessor_wbs,
      });

      if (!succMap.has(d.predecessor_id)) succMap.set(d.predecessor_id, []);
      succMap.get(d.predecessor_id).push({
        id: d.id,
        task_id: d.task_id,
        dependency_type: d.dependency_type || "FS",
        lag_days: d.lag_days || 0,
      });
    }

    const enrichedTasks = cpmResult.tasks.map((t) => ({
      ...t,
      predecessors: predMap.get(t.id) || [],
      successors: succMap.get(t.id) || [],
    }));

    // 8. Progress and Schedule Variance Metrics
    const totalDuration = enrichedTasks.reduce((sum, t) => sum + (Number(t.duration_days) || 1), 0);
    const weightedActualProgress = totalDuration > 0
      ? enrichedTasks.reduce((sum, t) => sum + ((Number(t.completion_percent) || 0) * (Number(t.duration_days) || 1)), 0) / totalDuration
      : 0;

    // Planned progress based on current date
    const now = new Date();
    let weightedPlannedProgress = 0;
    if (totalDuration > 0) {
      let earnedPlanned = 0;
      for (const t of enrichedTasks) {
        const s = t.baseline_start ? new Date(t.baseline_start) : (t.start_date ? new Date(t.start_date) : new Date(baseDate));
        const e = t.baseline_end ? new Date(t.baseline_end) : (t.end_date ? new Date(t.end_date) : new Date(baseDate));
        const dur = Number(t.duration_days) || 1;
        if (now <= s) {
          earnedPlanned += 0;
        } else if (now >= e) {
          earnedPlanned += 100 * dur;
        } else {
          const totalDays = Math.max(1, (e - s) / (1000 * 60 * 60 * 24));
          const elapsed = (now - s) / (1000 * 60 * 60 * 24);
          const ratio = Math.min(1, Math.max(0, elapsed / totalDays));
          earnedPlanned += ratio * 100 * dur;
        }
      }
      weightedPlannedProgress = earnedPlanned / totalDuration;
    }

    const actualProgressPct = Math.round(weightedActualProgress * 10) / 10;
    const plannedProgressPct = Math.round(weightedPlannedProgress * 10) / 10;
    const spi = plannedProgressPct > 0 ? Math.round((actualProgressPct / plannedProgressPct) * 100) / 100 : 1.0;

    // Delayed tasks and activities threatening deadline
    const delayedTasks = enrichedTasks.filter((t) => {
      if (t.status === "COMPLETED" || (Number(t.completion_percent) || 0) >= 100) return false;
      const finish = t.end_date ? new Date(t.end_date) : null;
      return (finish && finish < now) || t.status === "DELAYED";
    });

    const activitiesThreateningDeadline = enrichedTasks.filter((t) => {
      const isCriticalOrNear = t.is_critical || (t.total_float <= 1);
      const isNotDone = t.status !== "COMPLETED" && (Number(t.completion_percent) || 0) < 100;
      return isCriticalOrNear && isNotDone;
    });

    const targetDate = project.end_date ? new Date(project.end_date) : null;
    const forecastDate = new Date(cpmResult.forecastCompletionDate);
    const scheduleVarianceDays = targetDate
      ? Math.round((targetDate - forecastDate) / (1000 * 60 * 60 * 24))
      : 0;

    // AI Heuristic Recovery Plans
    const recoveryPlan = [];
    if (scheduleVarianceDays < 0) {
      recoveryPlan.push({
        type: "CRITICAL_PATH_COMPRESSION",
        severity: "HIGH",
        title: "Compress Critical Path Activities",
        description: `Project is forecasting ${Math.abs(scheduleVarianceDays)} days behind schedule. Add double-shift or overtime on critical tasks (${cpmResult.criticalPathSequence.slice(0, 3).map((t) => t.task_title).join(", ")}) to recover timeline.`,
      });
      recoveryPlan.push({
        type: "FAST_TRACKING",
        severity: "MEDIUM",
        title: "Fast-Track Successor Activities",
        description: "Review finish-to-start (FS) dependencies on long-duration structural tasks and convert to start-to-start (SS) with lead days where site conditions permit parallel execution.",
      });
    }
    if (delayedTasks.length > 0) {
      recoveryPlan.push({
        type: "RESOURCE_REALLOCATION",
        severity: "MEDIUM",
        title: `Remediate ${delayedTasks.length} Delayed Activities`,
        description: `Prioritize delayed items (${delayedTasks.slice(0, 3).map((t) => t.task_title).join(", ")}) by mobilizing supplementary subcontractor gangs or equipment.`,
      });
    }

    res.json({
      project,
      tasks: enrichedTasks,
      cpm: {
        ...cpmResult,
        activitiesThreateningDeadline,
      },
      variance: {
        actualProgress: actualProgressPct,
        plannedProgress: plannedProgressPct,
        spi,
        scheduleVarianceDays,
        targetCompletionDate: project.end_date,
        forecastCompletionDate: cpmResult.forecastCompletionDate,
        delayedTasksCount: delayedTasks.length,
        recoveryPlan,
      },
      eotClaims,
      workPackages,
    });
  } catch (err) {
    next(err);
  }
};

export const calculateProjectCPM = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);
    await ensureConstructionTables();

    // Fetch tasks & dependencies
    const tasks = await query(
      `SELECT t.*,
              COALESCE(t.duration_days, DATEDIFF(COALESCE(t.end_date, CURDATE()), COALESCE(t.start_date, CURDATE())), 1) AS duration_days
       FROM pm_tasks t
       WHERE t.project_id = :projectId AND (t.is_active = 'Y' OR t.is_active IS NULL)
       ORDER BY t.wbs_code ASC, t.id ASC`,
      { projectId }
    );

    if (!tasks.length) {
      return res.json({ tasks: [], projectDurationDays: 0, criticalPathIds: [], criticalPathSequence: [] });
    }

    const dependencies = await query(
      `SELECT d.task_id, d.predecessor_id, d.dependency_type, d.lag_days
       FROM pm_task_dependencies d
       JOIN pm_tasks t ON t.id = d.task_id
       WHERE t.project_id = :projectId`,
      { projectId }
    );

    const proj = await query(`SELECT start_date FROM pm_projects WHERE id = :projectId`, { projectId });
    const baseDate = proj[0]?.start_date || new Date().toISOString().split("T")[0];

    const cpmResult = calculateCPM(tasks, baseDate, dependencies, { calendar: "6_DAY" });

    // Persist computed attributes into pm_tasks
    for (const t of cpmResult.tasks) {
      await query(
        `UPDATE pm_tasks SET 
          early_start = :early_start, early_finish = :early_finish,
          late_start = :late_start, late_finish = :late_finish,
          total_float = :total_float, free_float = :free_float,
          is_critical = :is_critical
         WHERE id = :id`,
        {
          id: t.id,
          early_start: t.early_start,
          early_finish: t.early_finish,
          late_start: t.late_start,
          late_finish: t.late_finish,
          total_float: t.total_float,
          free_float: t.free_float,
          is_critical: t.is_critical,
        }
      );
    }

    res.json(cpmResult);
  } catch (err) {
    next(err);
  }
};

export const createScheduleActivity = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);
    const b = req.body || {};
    if (!b.task_title) throw httpError(400, "VALIDATION_ERROR", "Activity title is required");

    await ensureConstructionTables();

    const projRows = await query(`SELECT id, company_id, branch_id, start_date FROM pm_projects WHERE id = :id LIMIT 1`, { id: projectId });
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");

    const targetCompId = companyId || projRows[0].company_id || 1;
    const targetBranchId = branchId || projRows[0].branch_id || 1;
    const durationDays = Math.max(1, Number(b.duration_days || 1));
    const startDate = b.start_date || projRows[0].start_date || new Date().toISOString().split("T")[0];
    const endDate = b.end_date || addWorkDays(startDate, durationDays, "6_DAY");

    // Insert task
    const taskResult = await query(
      `INSERT INTO pm_tasks 
        (company_id, branch_id, project_id, work_package_id, wbs_code, task_title, task_description, duration_days, start_date, end_date, assigned_to_id, assigned_to_name, priority, status, completion_percent, is_active)
       VALUES 
        (:companyId, :branchId, :project_id, :work_package_id, :wbs_code, :task_title, :task_description, :duration_days, :start_date, :end_date, :assigned_to_id, :assigned_to_name, :priority, :status, :completion_percent, 'Y')`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        project_id: projectId,
        work_package_id: toNumber(b.work_package_id),
        wbs_code: b.wbs_code || null,
        task_title: b.task_title,
        task_description: b.task_description || null,
        duration_days: durationDays,
        start_date: startDate,
        end_date: endDate,
        assigned_to_id: toNumber(b.assigned_to_id),
        assigned_to_name: b.assigned_to_name || null,
        priority: b.priority || "NORMAL",
        status: b.status || "NOT_STARTED",
        completion_percent: Number(b.completion_percent || 0),
      }
    );

    const taskId = taskResult.insertId;

    // Insert predecessor dependencies if provided
    if (Array.isArray(b.predecessors)) {
      for (const p of b.predecessors) {
        const predId = toNumber(p.predecessor_id || p.id);
        if (predId && predId !== taskId) {
          await query(
            `INSERT INTO pm_task_dependencies (company_id, branch_id, task_id, predecessor_id, dependency_type, lag_days)
             VALUES (:companyId, :branchId, :taskId, :predId, :type, :lag)`,
            {
              companyId: targetCompId,
              branchId: targetBranchId,
              taskId,
              predId,
              type: (p.dependency_type || "FS").toUpperCase(),
              lag: Number(p.lag_days || 0),
            }
          );
        }
      }
    }

    res.status(201).json({ id: taskId, message: "Activity added to project schedule" });
  } catch (err) {
    next(err);
  }
};

export const updateScheduleActivity = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);
    const taskId = toNumber(req.params.taskId);
    const b = req.body || {};

    await ensureConstructionTables();

    const existing = await query(`SELECT id, company_id, branch_id FROM pm_tasks WHERE id = :taskId AND project_id = :projectId LIMIT 1`, { taskId, projectId });
    if (!existing.length) throw httpError(404, "NOT_FOUND", "Activity not found");

    const durationDays = b.duration_days ? Math.max(1, Number(b.duration_days)) : undefined;

    await query(
      `UPDATE pm_tasks SET
        wbs_code = COALESCE(:wbs_code, wbs_code),
        work_package_id = :work_package_id,
        task_title = COALESCE(:task_title, task_title),
        task_description = COALESCE(:task_description, task_description),
        duration_days = COALESCE(:duration_days, duration_days),
        start_date = COALESCE(:start_date, start_date),
        end_date = COALESCE(:end_date, end_date),
        completion_percent = COALESCE(:completion_percent, completion_percent),
        status = COALESCE(:status, status),
        assigned_to_name = COALESCE(:assigned_to_name, assigned_to_name),
        priority = COALESCE(:priority, priority),
        reason_for_delay = COALESCE(:reason_for_delay, reason_for_delay)
       WHERE id = :taskId`,
      {
        taskId,
        wbs_code: b.wbs_code ?? null,
        work_package_id: toNumber(b.work_package_id),
        task_title: b.task_title ?? null,
        task_description: b.task_description ?? null,
        duration_days: durationDays ?? null,
        start_date: b.start_date ?? null,
        end_date: b.end_date ?? null,
        completion_percent: b.completion_percent !== undefined ? Number(b.completion_percent) : null,
        status: b.status ?? null,
        assigned_to_name: b.assigned_to_name ?? null,
        priority: b.priority ?? null,
        reason_for_delay: b.reason_for_delay ?? null,
      }
    );

    // Update predecessors if provided
    if (Array.isArray(b.predecessors)) {
      await query(`DELETE FROM pm_task_dependencies WHERE task_id = :taskId`, { taskId });
      for (const p of b.predecessors) {
        const predId = toNumber(p.predecessor_id || p.id);
        if (predId && predId !== taskId) {
          await query(
            `INSERT INTO pm_task_dependencies (company_id, branch_id, task_id, predecessor_id, dependency_type, lag_days)
             VALUES (:companyId, :branchId, :taskId, :predId, :type, :lag)`,
            {
              companyId: existing[0].company_id || 1,
              branchId: existing[0].branch_id || 1,
              taskId,
              predId,
              type: (p.dependency_type || "FS").toUpperCase(),
              lag: Number(p.lag_days || 0),
            }
          );
        }
      }
    }

    res.json({ id: taskId, message: "Activity updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const deleteScheduleActivity = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const projectId = toNumber(req.params.projectId);
    const taskId = toNumber(req.params.taskId);

    await query(`DELETE FROM pm_task_dependencies WHERE task_id = :taskId OR predecessor_id = :taskId`, { taskId });
    await query(`DELETE FROM pm_tasks WHERE id = :taskId AND project_id = :projectId`, { taskId, projectId });

    res.json({ success: true, message: "Activity deleted from schedule" });
  } catch (err) {
    next(err);
  }
};

export const setScheduleBaseline = async (req, res, next) => {
  try {
    const projectId = toNumber(req.params.projectId);
    await query(
      `UPDATE pm_tasks SET
        baseline_start = COALESCE(start_date, early_start, CURDATE()),
        baseline_end = COALESCE(end_date, early_finish, CURDATE())
       WHERE project_id = :projectId AND (is_active = 'Y' OR is_active IS NULL)`,
      { projectId }
    );
    res.json({ success: true, message: "Project schedule baseline recorded successfully" });
  } catch (err) {
    next(err);
  }
};

export const listEOTRequests = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT e.*,
                      COALESCE(e.request_number, e.request_no) AS request_number,
                      COALESCE(e.request_no, e.request_number) AS request_no,
                      COALESCE(e.delay_cause, e.reason) AS delay_cause,
                      COALESCE(e.reason, e.delay_cause) AS reason,
                      COALESCE(e.justification, e.impact_assessment) AS justification,
                      p.project_name
               FROM pm_eot_requests e
               LEFT JOIN pm_projects p ON p.id = e.project_id
               WHERE (e.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.days_requested) throw httpError(400, "VALIDATION_ERROR", "Project and days requested required");

    await ensureConstructionTables();

    const projRows = await query(`SELECT id, company_id, branch_id FROM pm_projects WHERE id = :id LIMIT 1`, { id: toNumber(b.project_id) });
    const targetCompId = companyId || projRows[0]?.company_id || 1;
    const targetBranchId = branchId || projRows[0]?.branch_id || 1;

    const reqNo = b.request_number || b.request_no || `EOT-${Date.now().toString().slice(-6)}`;
    const delayCause = b.delay_cause || b.reason || "Delay Claim";

    const result = await query(
      `INSERT INTO pm_eot_requests 
        (company_id, branch_id, project_id, request_no, request_number, delay_cause, reason, delay_category, days_requested, financial_claim_amount, requested_date, justification, impact_assessment, status, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :request_no, :request_number, :delay_cause, :reason, :delay_category, :days_requested, :financial_claim_amount, :requested_date, :justification, :impact_assessment, :status, :created_by)`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        project_id: toNumber(b.project_id),
        request_no: reqNo,
        request_number: reqNo,
        delay_cause: delayCause,
        reason: delayCause,
        delay_category: b.delay_category || "CLIENT_CHANGE",
        days_requested: Number(b.days_requested),
        financial_claim_amount: Number(b.financial_claim_amount || 0),
        requested_date: b.requested_date || new Date().toISOString().split("T")[0],
        justification: b.justification || null,
        impact_assessment: b.justification || null,
        status: "SUBMITTED",
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, request_no: reqNo, message: "EOT request submitted successfully" });
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
    let sql = `SELECT r.*,
                      COALESCE(r.report_number, r.report_no) AS report_number,
                      COALESCE(r.report_no, r.report_number) AS report_no,
                      COALESCE(r.site_engineer_name, r.reporting_officer_name) AS site_engineer_name,
                      COALESCE(r.weather_morning, r.weather, 'SUNNY') AS weather_morning,
                      COALESCE(r.weather_afternoon, r.weather, 'SUNNY') AS weather_afternoon,
                      COALESCE(r.general_remarks, r.supervisor_comments) AS general_remarks,
                      p.project_name,
                      s.site_name,
                      (SELECT COUNT(*) FROM pm_daily_site_activities WHERE report_id = r.id) AS activity_count,
                      (SELECT COALESCE(SUM(headcount), 0) FROM pm_daily_site_workforce WHERE report_id = r.id) AS total_headcount
               FROM pm_daily_site_reports r
               LEFT JOIN pm_projects p ON p.id = r.project_id
               LEFT JOIN pm_sites s ON s.id = r.site_id
               WHERE (r.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
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

    const rows = await query(
      `SELECT r.*,
              COALESCE(r.report_number, r.report_no) AS report_number,
              COALESCE(r.report_no, r.report_number) AS report_no,
              COALESCE(r.site_engineer_name, r.reporting_officer_name) AS site_engineer_name,
              COALESCE(r.weather_morning, r.weather, 'SUNNY') AS weather_morning,
              COALESCE(r.weather_afternoon, r.weather, 'SUNNY') AS weather_afternoon,
              COALESCE(r.general_remarks, r.supervisor_comments) AS general_remarks,
              p.project_name
       FROM pm_daily_site_reports r
       LEFT JOIN pm_projects p ON p.id = r.project_id
       WHERE r.id = :id AND (r.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Daily site report not found");

    const report = rows[0];
    const activities = await query(
      `SELECT id, report_id, project_id, COALESCE(description, activity_name) AS description, COALESCE(location_grid, location) AS location_grid, COALESCE(quantity_completed, measured_qty_completed) AS quantity_completed, COALESCE(unit, uom) AS unit, progress_percent, remarks FROM pm_daily_site_activities WHERE report_id = :id ORDER BY id ASC`,
      { id }
    );
    const workforce = await query(
      `SELECT id, report_id, trade_category, COALESCE(trade_name, 'General Labour') AS trade_name, subcontractor_name, headcount, total_hours, remarks FROM pm_daily_site_workforce WHERE report_id = :id ORDER BY id ASC`,
      { id }
    );
    const equipment = await query(
      `SELECT id, report_id, equipment_name, COALESCE(equipment_tag, asset_no) AS equipment_tag, COALESCE(hours_worked, operating_hours) AS hours_worked, COALESCE(hours_idle, idle_hours) AS hours_idle, COALESCE(hours_breakdown, breakdown_hours) AS hours_breakdown, remarks FROM pm_daily_site_equipment WHERE report_id = :id ORDER BY id ASC`,
      { id }
    );
    const materials = await query(
      `SELECT id, report_id, COALESCE(material_name, item_name) AS material_name, COALESCE(quantity, qty_received) AS quantity, COALESCE(unit, uom) AS unit, supplier_name, COALESCE(delivery_note_no, delivery_note_ref) AS delivery_note_no, remarks FROM pm_daily_site_materials WHERE report_id = :id ORDER BY id ASC`,
      { id }
    );
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

async function insertDailyReportSubItems(reportId, projectId, b) {
  if (Array.isArray(b.activities)) {
    for (const a of b.activities) {
      if (!a.description && !a.location_grid && !a.activity_name) continue;
      const desc = a.description || a.activity_name || "Site Activity";
      await query(
        `INSERT INTO pm_daily_site_activities 
          (report_id, project_id, activity_name, description, location, location_grid, measured_qty_completed, quantity_completed, uom, unit, progress_percent, remarks)
         VALUES 
          (:reportId, :project_id, :activity_name, :description, :location, :location_grid, :measured_qty_completed, :quantity_completed, :uom, :unit, :progress_percent, :remarks)`,
        {
          reportId,
          project_id: projectId,
          activity_name: desc,
          description: desc,
          location: a.location_grid || null,
          location_grid: a.location_grid || null,
          measured_qty_completed: Number(a.quantity_completed || 0),
          quantity_completed: Number(a.quantity_completed || 0),
          uom: a.unit || "NR",
          unit: a.unit || "NR",
          progress_percent: Number(a.progress_percent || 0),
          remarks: a.remarks || null,
        }
      );
    }
  }

  if (Array.isArray(b.workforce)) {
    for (const w of b.workforce) {
      if (!w.trade_name && !w.trade_category && !w.headcount) continue;
      await query(
        `INSERT INTO pm_daily_site_workforce 
          (report_id, trade_category, trade_name, subcontractor_name, headcount, total_hours, remarks)
         VALUES 
          (:reportId, :trade_category, :trade_name, :subcontractor_name, :headcount, :total_hours, :remarks)`,
        {
          reportId,
          trade_category: w.trade_category || "SKILLED",
          trade_name: w.trade_name || "General Labour",
          subcontractor_name: w.subcontractor_name || null,
          headcount: Number(w.headcount || 1),
          total_hours: Number(w.total_hours || 8),
          remarks: w.remarks || null,
        }
      );
    }
  }

  if (Array.isArray(b.equipment)) {
    for (const eq of b.equipment) {
      if (!eq.equipment_name && !eq.equipment_tag) continue;
      const eqTag = eq.equipment_tag || null;
      const eqName = eq.equipment_name || "Heavy Equipment";
      const hw = Number(eq.hours_worked || 0);
      const hi = Number(eq.hours_idle || 0);
      const hb = Number(eq.hours_breakdown || 0);
      await query(
        `INSERT INTO pm_daily_site_equipment 
          (report_id, equipment_name, asset_no, equipment_tag, operating_hours, hours_worked, idle_hours, hours_idle, breakdown_hours, hours_breakdown, remarks)
         VALUES 
          (:reportId, :equipment_name, :asset_no, :equipment_tag, :operating_hours, :hours_worked, :idle_hours, :hours_idle, :breakdown_hours, :hours_breakdown, :remarks)`,
        {
          reportId,
          equipment_name: eqName,
          asset_no: eqTag,
          equipment_tag: eqTag,
          operating_hours: hw,
          hours_worked: hw,
          idle_hours: hi,
          hours_idle: hi,
          breakdown_hours: hb,
          hours_breakdown: hb,
          remarks: eq.remarks || null,
        }
      );
    }
  }

  if (Array.isArray(b.materials)) {
    for (const m of b.materials) {
      if (!m.material_name && !m.item_name && !m.quantity) continue;
      const matName = m.material_name || m.item_name || "Material";
      const qty = Number(m.quantity || 0);
      const uomVal = m.unit || "PCS";
      const dn = m.delivery_note_no || null;
      await query(
        `INSERT INTO pm_daily_site_materials 
          (report_id, item_name, material_name, qty_received, quantity, uom, unit, supplier_name, delivery_note_ref, delivery_note_no, remarks)
         VALUES 
          (:reportId, :item_name, :material_name, :qty_received, :quantity, :uom, :unit, :supplier_name, :delivery_note_ref, :delivery_note_no, :remarks)`,
        {
          reportId,
          item_name: matName,
          material_name: matName,
          qty_received: qty,
          quantity: qty,
          uom: uomVal,
          unit: uomVal,
          supplier_name: m.supplier_name || null,
          delivery_note_ref: dn,
          delivery_note_no: dn,
          remarks: m.remarks || null,
        }
      );
    }
  }
}

export const createDailyReport = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.report_date) throw httpError(400, "VALIDATION_ERROR", "Project and report date required");

    await ensureConstructionTables();

    const projRows = await query(`SELECT id, project_code, company_id, branch_id FROM pm_projects WHERE id = :id LIMIT 1`, { id: toNumber(b.project_id) });
    const targetCompId = companyId || projRows[0]?.company_id || 1;
    const targetBranchId = branchId || projRows[0]?.branch_id || 1;

    let reportNo = b.report_number || b.report_no;
    if (!reportNo || !String(reportNo).trim()) {
      const pCode = projRows[0]?.project_code || `PRJ${b.project_id}`;
      reportNo = `DSR-${pCode}-${b.report_date}-${Date.now().toString().slice(-4)}`;
    }

    const weatherM = b.weather_morning || "SUNNY";
    const weatherA = b.weather_afternoon || "SUNNY";
    const allowedWeathers = ['SUNNY', 'RAINY', 'CLOUDY', 'STORMY', 'WINDY'];
    const weatherEnum = allowedWeathers.includes(weatherM) ? weatherM : 'SUNNY';

    const result = await query(
      `INSERT INTO pm_daily_site_reports 
        (company_id, branch_id, project_id, site_id, report_no, report_number, report_date, shift, reporting_officer_id, reporting_officer_name, site_engineer_name, weather, weather_morning, weather_afternoon, site_condition, working_hours_from, working_hours_to, supervisor_comments, general_remarks, safety_observations, status, prepared_by, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :site_id, :report_no, :report_number, :report_date, :shift, :reporting_officer_id, :reporting_officer_name, :site_engineer_name, :weather, :weather_morning, :weather_afternoon, :site_condition, :working_hours_from, :working_hours_to, :supervisor_comments, :general_remarks, :safety_observations, :status, :prepared_by, :created_by)`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        project_id: toNumber(b.project_id),
        site_id: toNumber(b.site_id),
        report_no: reportNo,
        report_number: reportNo,
        report_date: b.report_date,
        shift: b.shift || "DAY",
        reporting_officer_id: req.user?.id || null,
        reporting_officer_name: b.site_engineer_name || req.user?.username || "Site Engineer",
        site_engineer_name: b.site_engineer_name || req.user?.username || "Site Engineer",
        weather: weatherEnum,
        weather_morning: weatherM,
        weather_afternoon: weatherA,
        site_condition: b.site_condition || "DRY",
        working_hours_from: b.working_hours_from || "08:00:00",
        working_hours_to: b.working_hours_to || "17:00:00",
        supervisor_comments: b.general_remarks || null,
        general_remarks: b.general_remarks || null,
        safety_observations: b.safety_observations || null,
        status: b.status || "DRAFT",
        prepared_by: req.user?.id || null,
        created_by: req.user?.id || null,
      }
    );

    const reportId = result.insertId;

    await insertDailyReportSubItems(reportId, toNumber(b.project_id), b);

    res.status(201).json({ id: reportId, report_number: reportNo, message: "Daily site report logged successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateDailyReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const existing = await query(`SELECT id, project_id FROM pm_daily_site_reports WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`, { id, companyId: companyId || null });
    if (!existing.length) throw httpError(404, "NOT_FOUND", "Daily site report not found");

    const weatherM = b.weather_morning || "SUNNY";
    const allowedWeathers = ['SUNNY', 'RAINY', 'CLOUDY', 'STORMY', 'WINDY'];
    const weatherEnum = allowedWeathers.includes(weatherM) ? weatherM : 'SUNNY';

    await query(
      `UPDATE pm_daily_site_reports SET
        site_id = :site_id,
        report_date = :report_date,
        site_engineer_name = :site_engineer_name,
        reporting_officer_name = :reporting_officer_name,
        weather = :weather,
        weather_morning = :weather_morning,
        weather_afternoon = :weather_afternoon,
        site_condition = :site_condition,
        working_hours_from = :working_hours_from,
        working_hours_to = :working_hours_to,
        supervisor_comments = :supervisor_comments,
        general_remarks = :general_remarks,
        safety_observations = :safety_observations,
        status = :status
       WHERE id = :id`,
      {
        id,
        site_id: toNumber(b.site_id),
        report_date: b.report_date,
        site_engineer_name: b.site_engineer_name || req.user?.username || "Site Engineer",
        reporting_officer_name: b.site_engineer_name || req.user?.username || "Site Engineer",
        weather: weatherEnum,
        weather_morning: weatherM,
        weather_afternoon: b.weather_afternoon || "SUNNY",
        site_condition: b.site_condition || "DRY",
        working_hours_from: b.working_hours_from || "08:00:00",
        working_hours_to: b.working_hours_to || "17:00:00",
        supervisor_comments: b.general_remarks || null,
        general_remarks: b.general_remarks || null,
        safety_observations: b.safety_observations || null,
        status: b.status || "DRAFT",
      }
    );

    await query(`DELETE FROM pm_daily_site_activities WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_workforce WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_equipment WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_materials WHERE report_id = :id`, { id });

    await insertDailyReportSubItems(id, toNumber(b.project_id || existing[0].project_id), b);

    res.json({ id, message: "Daily site report updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const deleteDailyReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM pm_daily_site_activities WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_workforce WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_equipment WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_materials WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_photos WHERE report_id = :id`, { id });
    await query(`DELETE FROM pm_daily_site_reports WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || null });
    res.json({ success: true, message: "Daily site report deleted" });
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
    let sql = `SELECT sc.*,
                      sc.contract_no AS subcontract_number,
                      COALESCE(s.supplier_name, sc.subcontractor_name, 'Specialist Contractor') AS supplier_name,
                      sc.trade_category AS trade,
                      sc.contract_value AS contract_sum,
                      sc.advance_percent AS advance_recovery_percent,
                      sc.advance_paid AS advance_payment,
                      p.project_name,
                      p.project_code
               FROM pm_subcontracts sc
               LEFT JOIN pm_projects p ON p.id = sc.project_id
               LEFT JOIN pur_suppliers s ON s.id = sc.supplier_id
               WHERE (sc.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
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
    let contractNo = b.subcontract_number || b.contract_no;
    const suppId = toNumber(b.subcontractor_id || b.supplier_id);
    if (!b.project_id || !suppId) {
      throw httpError(400, "VALIDATION_ERROR", "Project and subcontractor required");
    }

    const projRows = await query(`SELECT id, project_code, company_id, branch_id FROM pm_projects WHERE id = :id LIMIT 1`, { id: toNumber(b.project_id) });
    const targetCompId = companyId || projRows[0]?.company_id || 1;
    const targetBranchId = branchId || projRows[0]?.branch_id || 1;

    // System-generated Subcontract No if not provided or hidden on frontend
    if (!contractNo || !String(contractNo).trim()) {
      const pCode = projRows[0]?.project_code || `PRJ${b.project_id}`;
      const countRows = await query(`SELECT COUNT(*) as c FROM pm_subcontracts WHERE project_id = :projId`, { projId: toNumber(b.project_id) });
      let nextSeq = Number(countRows[0]?.c || 0) + 1;
      contractNo = `SC-${pCode}-${String(nextSeq).padStart(3, "0")}`;
      // Verify uniqueness
      const existing = await query(`SELECT id FROM pm_subcontracts WHERE contract_no = :contractNo LIMIT 1`, { contractNo });
      if (existing.length) {
        contractNo = `SC-${pCode}-${Date.now().toString().slice(-4)}`;
      }
    }

    let suppName = b.subcontractor_name;
    if (!suppName) {
      const suppRows = await query(`SELECT supplier_name FROM pur_suppliers WHERE id = :suppId LIMIT 1`, { suppId });
      suppName = suppRows[0]?.supplier_name || "Specialist Contractor";
    }

    const result = await query(
      `INSERT INTO pm_subcontracts 
        (company_id, branch_id, project_id, contract_no, supplier_id, subcontractor_name, trade_category, scope_of_work, contract_value, retention_percent, retention_cap, advance_percent, advance_paid, advance_recovered, start_date, completion_date, status, terms_and_conditions, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :contract_no, :supplier_id, :subcontractor_name, :trade_category, :scope_of_work, :contract_value, :retention_percent, :retention_cap, :advance_percent, :advance_paid, :advance_recovered, :start_date, :completion_date, :status, :terms_and_conditions, :created_by)`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        project_id: toNumber(b.project_id),
        contract_no: contractNo,
        supplier_id: suppId,
        subcontractor_name: suppName,
        trade_category: b.trade || b.trade_category || "GENERAL",
        scope_of_work: b.scope_of_work || b.scope_description || "",
        contract_value: Number(b.contract_sum || b.contract_value || 0),
        retention_percent: Number(b.retention_percent ?? 5.0),
        retention_cap: Number(b.retention_cap || 0),
        advance_percent: Number(b.advance_recovery_percent || b.advance_percent || 10.0),
        advance_paid: Number(b.advance_payment || b.advance_paid || 0),
        advance_recovered: 0,
        start_date: b.start_date || null,
        completion_date: b.completion_date || b.end_date || null,
        status: b.status || "ACTIVE",
        terms_and_conditions: b.remarks || b.terms_and_conditions || null,
        created_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, contract_no: contractNo, message: "Subcontract registered successfully" });
  } catch (err) {
    next(err);
  }
};

export const listSubcontractValuations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const subcontractId = toNumber(req.query.subcontract_id);
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT v.*,
                      v.valuation_no AS valuation_number,
                      v.gross_claimed AS cumulative_work_done,
                      v.current_certified AS current_work_done,
                      v.net_payable AS net_certified_amount,
                      sc.contract_no AS subcontract_number,
                      sc.trade_category AS trade,
                      COALESCE(s.supplier_name, sc.subcontractor_name, 'Specialist Contractor') AS supplier_name
               FROM pm_subcontract_valuations v
               JOIN pm_subcontracts sc ON sc.id = v.subcontract_id
               LEFT JOIN pur_suppliers s ON s.id = sc.supplier_id
               WHERE (sc.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
    if (subcontractId) {
      sql += ` AND v.subcontract_id = :subcontractId`;
      params.subcontractId = subcontractId;
    }
    if (projectId) {
      sql += ` AND (v.project_id = :projectId OR sc.project_id = :projectId)`;
      params.projectId = projectId;
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    const valNo = b.valuation_number || b.valuation_no;
    if (!b.subcontract_id || !valNo) {
      throw httpError(400, "VALIDATION_ERROR", "Subcontract and valuation number required");
    }

    const scRows = await query(
      `SELECT * FROM pm_subcontracts WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`, 
      { id: toNumber(b.subcontract_id), companyId: companyId || null }
    );
    if (!scRows.length) throw httpError(404, "NOT_FOUND", "Subcontract not found");
    const sc = scRows[0];

    const cumWorkDone = Number(b.cumulative_work_done || b.gross_claimed || 0);
    const prevCertified = Number(b.previous_certified || 0);
    const currWork = Math.max(0, cumWorkDone - prevCertified);

    const retPct = Number(sc.retention_percent ?? 5);
    const retentionDeducted = Number(((currWork * retPct) / 100).toFixed(2));

    const advRecPct = Number(sc.advance_percent ?? sc.advance_recovery_percent ?? 10);
    const advanceRecovered = Number(((currWork * advRecPct) / 100).toFixed(2));

    const otherDeductions = Number(b.other_deductions || 0);
    const netPayable = Math.max(0, currWork - retentionDeducted - advanceRecovered - otherDeductions);

    const targetCompId = companyId || sc.company_id || 1;
    const targetBranchId = branchId || sc.branch_id || 1;

    const result = await query(
      `INSERT INTO pm_subcontract_valuations 
        (company_id, branch_id, subcontract_id, project_id, valuation_no, valuation_date, period_from, period_to, gross_claimed, gross_certified, previous_certified, current_certified, retention_deducted, advance_recovered, other_deductions, net_payable, status, remarks, certified_by, certified_at)
       VALUES 
        (:companyId, :branchId, :subcontract_id, :project_id, :valuation_no, :valuation_date, :period_from, :period_to, :gross_claimed, :gross_certified, :previous_certified, :current_certified, :retention_deducted, :advance_recovered, :other_deductions, :net_payable, :status, :remarks, :certified_by, :certified_at)`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        subcontract_id: sc.id,
        project_id: sc.project_id,
        valuation_no: valNo,
        valuation_date: b.valuation_date || new Date().toISOString().split("T")[0],
        period_from: b.period_from || null,
        period_to: b.period_to || null,
        gross_claimed: cumWorkDone,
        gross_certified: cumWorkDone,
        previous_certified: prevCertified,
        current_certified: currWork,
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

    const valuationId = result.insertId;

    res.status(201).json({ id: valuationId, net_payable: netPayable, message: "Subcontract valuation recorded" });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7. CLIENT VALUATIONS
// ==========================================

export const listClientValuations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT v.*, 
                      COALESCE(v.valuation_no, v.application_no) AS valuation_number,
                      v.application_no AS application_number,
                      v.gross_claimed AS cumulative_work_done,
                      v.previous_certified AS previously_certified,
                      v.current_certified AS current_claim,
                      v.advance_recovered AS advance_recovery,
                      v.net_amount_due AS net_certified_amount,
                      p.project_name, 
                      p.project_code, 
                      COALESCE(c.customer_name, v.client_name, p.client_name, 'Client') AS client_name,
                      (SELECT COUNT(*) FROM pm_client_valuation_lines WHERE valuation_id = v.id) AS item_count
               FROM pm_client_valuations v
               JOIN pm_projects p ON p.id = v.project_id
               LEFT JOIN sal_customers c ON c.id = p.client_id
               WHERE (v.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
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

export const getClientValuationBaseline = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.params.projectId);
    if (!projectId) throw httpError(400, "VALIDATION_ERROR", "Project ID is required");

    const projRows = await query(
      `SELECT p.*, COALESCE(c.customer_name, p.client_name, 'Client') AS client_name,
              c.id AS sal_client_id, c.customer_code
       FROM pm_projects p
       LEFT JOIN sal_customers c ON c.id = p.client_id
       WHERE p.id = :id AND (p.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id: projectId, companyId: companyId || null }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const project = projRows[0];

    // Find active or approved BOQ
    const boqRows = await query(
      `SELECT * FROM pm_boqs 
       WHERE project_id = :projectId AND (company_id = :companyId OR :companyId IS NULL)
       ORDER BY CASE WHEN status = 'APPROVED' THEN 1 ELSE 2 END, id DESC LIMIT 1`,
      { projectId, companyId: companyId || null }
    );
    const boq = boqRows[0] || null;

    let boqItems = [];
    if (boq) {
      boqItems = await query(
        `SELECT bi.id, bi.boq_id, bi.item_code, bi.description, bi.uom, 
                bi.quantity AS contract_qty, bi.unit_rate AS contract_rate, 
                bi.total_amount AS contract_amount, bi.cost_category
         FROM pm_boq_items bi
         WHERE bi.boq_id = :boqId
         ORDER BY bi.sort_order ASC, bi.id ASC`,
        { boqId: boq.id }
      );
    }

    // Previous approved valuations for this project
    const valRows = await query(
      `SELECT v.id, COALESCE(v.valuation_no, v.application_no) AS valuation_no, v.valuation_date, v.gross_claimed, v.status
       FROM pm_client_valuations v
       WHERE v.project_id = :projectId AND (v.company_id = :companyId OR :companyId IS NULL)
         AND v.status IN ('APPROVED', 'CERTIFIED', 'SUBMITTED')
       ORDER BY v.id DESC`,
      { projectId, companyId: companyId || null }
    );
    const previousValuation = valRows[0] || null;

    // Map cumulative completed quantities from previous valuations
    const prevLines = await query(
      `SELECT vl.boq_item_id, vl.item_code, 
              SUM(vl.current_period_qty) AS prev_cumulative_qty,
              SUM(vl.assessed_value) AS prev_certified_value
       FROM pm_client_valuation_lines vl
       JOIN pm_client_valuations v ON v.id = vl.valuation_id
       WHERE v.project_id = :projectId AND (v.company_id = :companyId OR :companyId IS NULL)
         AND v.status IN ('APPROVED', 'CERTIFIED')
       GROUP BY vl.boq_item_id, vl.item_code`,
      { projectId, companyId: companyId || null }
    );
    const prevMap = new Map();
    for (const pl of prevLines) {
      const key = pl.boq_item_id || pl.item_code;
      if (key) prevMap.set(String(key), pl);
    }

    const itemsWithBaseline = boqItems.map(item => {
      const prev = prevMap.get(String(item.id)) || prevMap.get(String(item.item_code));
      const prevQty = Number(prev?.prev_cumulative_qty || 0);
      const prevCertVal = Number(prev?.prev_certified_value || (prevQty * Number(item.contract_rate || 0)));
      return {
        boq_item_id: item.id,
        item_code: item.item_code || "",
        description: item.description || "",
        uom: item.uom || "EA",
        contract_qty: Number(item.contract_qty || 0),
        contract_rate: Number(item.contract_rate || 0),
        contract_amount: Number(item.contract_amount || 0),
        prev_cumulative_qty: prevQty,
        current_period_qty: 0,
        cumulative_qty: prevQty,
        percentage_complete: Number(item.contract_qty) > 0 ? Number(((prevQty / Number(item.contract_qty)) * 100).toFixed(2)) : 0,
        cumulative_value: Number((prevQty * Number(item.contract_rate || 0)).toFixed(2)),
        prev_certified_value: prevCertVal,
        current_period_value: 0,
        assessed_value: 0,
        remarks: "",
        is_variation: 0,
        variation_id: null,
      };
    });

    // Approved variations for this project
    const approvedVariations = await query(
      `SELECT v.id, v.variation_no, v.title, v.scope_of_work, v.net_amount, v.status,
              vi.id AS item_id, vi.item_code, vi.description AS item_desc, vi.uom, vi.revised_qty, vi.proposed_rate, vi.cost_difference
       FROM pm_variations v
       LEFT JOIN pm_variation_items vi ON vi.variation_id = v.id
       WHERE v.project_id = :projectId AND (v.company_id = :companyId OR :companyId IS NULL)
         AND v.status = 'APPROVED'`,
      { projectId, companyId: companyId || null }
    );

    // Auto-generate next valuation ref
    const totalVals = await query(
      `SELECT COUNT(*) AS c FROM pm_client_valuations WHERE (company_id = :companyId OR :companyId IS NULL)`,
      { companyId: companyId || null }
    );
    const nextValNo = `VAL-${project.project_code || "PRJ"}-${Number(totalVals[0]?.c || 0) + 1}`;

    res.json({
      project,
      boq,
      boq_items: itemsWithBaseline,
      previous_valuation: previousValuation,
      approved_variations: approvedVariations,
      suggested_valuation_no: nextValNo
    });
  } catch (err) {
    next(err);
  }
};

export const getClientValuationById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const id = toNumber(req.params.id);
    const rows = await query(
      `SELECT v.*, 
              COALESCE(v.valuation_no, v.application_no) AS valuation_number,
              v.application_no AS application_number,
              p.project_name, p.project_code, p.contract_sum, p.revised_contract_sum,
              COALESCE(c.customer_name, v.client_name, p.client_name, 'Client') AS client_name,
              u.username AS preparer_username
       FROM pm_client_valuations v
       JOIN pm_projects p ON p.id = v.project_id
       LEFT JOIN sal_customers c ON c.id = p.client_id
       LEFT JOIN adm_users u ON u.id = v.created_by
       WHERE v.id = :id AND (v.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Client valuation not found");
    const valuation = rows[0];

    const lines = await query(
      `SELECT * FROM pm_client_valuation_lines WHERE valuation_id = :id ORDER BY id ASC`,
      { id }
    );
    valuation.items = lines;

    res.json({ item: valuation });
  } catch (err) {
    next(err);
  }
};

export const createClientValuation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    const valNo = b.valuation_no || b.valuation_number || b.application_no || b.application_number;
    if (!b.project_id || !valNo) {
      throw httpError(400, "VALIDATION_ERROR", "Project and valuation number required");
    }

    const projRows = await query(
      `SELECT * FROM pm_projects WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`, 
      { id: toNumber(b.project_id), companyId: companyId || null }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const proj = projRows[0];

    const targetCompanyId = companyId || proj.company_id || 1;
    const targetBranchId = branchId || proj.branch_id || 1;

    const items = Array.isArray(b.items) ? b.items : [];
    let grossClaimed = 0;
    let prevCertifiedTotal = 0;
    let currentWorkTotal = 0;

    for (const it of items) {
      const cVal = Number(it.cumulative_value || (Number(it.cumulative_qty || 0) * Number(it.contract_rate || 0)));
      const pVal = Number(it.prev_certified_value || 0);
      const curVal = Number(it.assessed_value || it.current_period_value || (cVal - pVal));
      grossClaimed += cVal;
      prevCertifiedTotal += pVal;
      currentWorkTotal += curVal;
    }

    if (items.length === 0) {
      grossClaimed = Number(b.cumulative_work_done || b.gross_claimed || 0);
      prevCertifiedTotal = Number(b.previously_certified || b.previous_certified || 0);
      currentWorkTotal = Math.max(0, grossClaimed - prevCertifiedTotal);
    }

    const matOnSite = Number(b.materials_on_site_value || 0);
    const dayworks = Number(b.dayworks_value || 0);
    const approvedVars = Number(b.approved_variations_total || b.approved_variations_value || 0);
    const otherAdds = Number(b.other_additions_value || 0);

    const grossAssessed = currentWorkTotal + matOnSite + dayworks + approvedVars + otherAdds;

    const retPct = Number(b.retention_percent ?? proj.retention_percent ?? 5.0);
    const retentionAmt = Number(((grossAssessed * retPct) / 100).toFixed(2));

    const advRecPct = Number(b.advance_recovery_percent ?? proj.advance_recovery_percent ?? 10.0);
    const advanceRecoveryAmt = Number(((grossAssessed * advRecPct) / 100).toFixed(2));

    const otherDeductions = Number(b.other_deductions || b.other_deductions_amount || 0);
    const netAmountDue = Math.max(0, grossAssessed - retentionAmt - advanceRecoveryAmt - otherDeductions);

    const status = b.status || "DRAFT";

    const result = await query(
      `INSERT INTO pm_client_valuations 
        (company_id, branch_id, project_id, client_id, client_name, contractor_name, contract_ref,
         valuation_no, application_no, valuation_date, period_from, period_to, valuation_type, boq_id,
         previous_valuation_id, previous_valuation_no, prepared_by_name,
         gross_claimed, gross_certified, previous_certified, current_certified,
         materials_on_site_value, dayworks_value, other_additions_value, approved_variations_total,
         retention_percent, retention_deducted, advance_recovery_percent, advance_recovered, other_deductions,
         gross_assessed_value, current_assessed_amount, net_amount_due,
         status, remarks, attachments, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :client_id, :client_name, :contractor_name, :contract_ref,
         :valuation_no, :application_no, :valuation_date, :period_from, :period_to, :valuation_type, :boq_id,
         :previous_valuation_id, :previous_valuation_no, :prepared_by_name,
         :gross_claimed, :gross_certified, :previous_certified, :current_certified,
         :materials_on_site_value, :dayworks_value, :other_additions_value, :approved_variations_total,
         :retention_percent, :retention_deducted, :advance_recovery_percent, :advance_recovered, :other_deductions,
         :gross_assessed_value, :current_assessed_amount, :net_amount_due,
         :status, :remarks, :attachments, :created_by)`,
      {
        companyId: targetCompanyId,
        branchId: targetBranchId,
        project_id: proj.id,
        client_id: proj.client_id || null,
        client_name: b.client_name || proj.client_name || "Client",
        contractor_name: b.contractor_name || "Contractor",
        contract_ref: b.contract_ref || proj.contract_ref_no || null,
        valuation_no: valNo,
        application_no: valNo,
        valuation_date: b.valuation_date || new Date().toISOString().split("T")[0],
        period_from: b.period_from || null,
        period_to: b.period_to || null,
        valuation_type: b.valuation_type || "INTERIM",
        boq_id: b.boq_id ? toNumber(b.boq_id) : null,
        previous_valuation_id: b.previous_valuation_id ? toNumber(b.previous_valuation_id) : null,
        previous_valuation_no: b.previous_valuation_no || null,
        prepared_by_name: b.prepared_by_name || req.user?.username || null,
        gross_claimed: grossClaimed,
        gross_certified: grossAssessed,
        previous_certified: prevCertifiedTotal,
        current_certified: currentWorkTotal,
        materials_on_site_value: matOnSite,
        dayworks_value: dayworks,
        other_additions_value: otherAdds,
        approved_variations_total: approvedVars,
        retention_percent: retPct,
        retention_deducted: retentionAmt,
        advance_recovery_percent: advRecPct,
        advance_recovered: advanceRecoveryAmt,
        other_deductions: otherDeductions,
        gross_assessed_value: grossAssessed,
        current_assessed_amount: netAmountDue,
        net_amount_due: netAmountDue,
        status,
        remarks: b.remarks || null,
        attachments: b.attachments ? JSON.stringify(b.attachments) : null,
        created_by: req.user?.id || null,
      }
    );

    const valuationId = result.insertId;

    // Insert line items
    for (const it of items) {
      await query(
        `INSERT INTO pm_client_valuation_lines 
          (valuation_id, boq_item_id, item_code, description, uom, boq_qty, unit_rate,
           contract_qty, contract_rate, contract_amount, prev_cumulative_qty, current_period_qty,
           cumulative_qty, percentage_complete, cumulative_value, prev_certified_value,
           current_period_value, assessed_value, remarks, is_variation, variation_id)
         VALUES 
          (:valuation_id, :boq_item_id, :item_code, :description, :uom, :boq_qty, :unit_rate,
           :contract_qty, :contract_rate, :contract_amount, :prev_cumulative_qty, :current_period_qty,
           :cumulative_qty, :percentage_complete, :cumulative_value, :prev_certified_value,
           :current_period_value, :assessed_value, :remarks, :is_variation, :variation_id)`,
        {
          valuation_id: valuationId,
          boq_item_id: it.boq_item_id ? toNumber(it.boq_item_id) : null,
          item_code: it.item_code || null,
          description: it.description || "",
          uom: it.uom || "EA",
          boq_qty: Number(it.contract_qty || it.boq_qty || 0),
          unit_rate: Number(it.contract_rate || it.unit_rate || 0),
          contract_qty: Number(it.contract_qty || 0),
          contract_rate: Number(it.contract_rate || 0),
          contract_amount: Number(it.contract_amount || (Number(it.contract_qty || 0) * Number(it.contract_rate || 0))),
          prev_cumulative_qty: Number(it.prev_cumulative_qty || 0),
          current_period_qty: Number(it.current_period_qty || 0),
          cumulative_qty: Number(it.cumulative_qty || (Number(it.prev_cumulative_qty || 0) + Number(it.current_period_qty || 0))),
          percentage_complete: Number(it.percentage_complete || 0),
          cumulative_value: Number(it.cumulative_value || 0),
          prev_certified_value: Number(it.prev_certified_value || 0),
          current_period_value: Number(it.current_period_value || 0),
          assessed_value: Number(it.assessed_value || it.current_period_value || 0),
          remarks: it.remarks || null,
          is_variation: it.is_variation ? 1 : 0,
          variation_id: it.variation_id ? toNumber(it.variation_id) : null,
        }
      );
    }

    res.status(201).json({
      id: valuationId,
      valuation_number: valNo,
      net_certified_amount: netAmountDue,
      net_amount_due: netAmountDue,
      message: "Client valuation created successfully"
    });
  } catch (err) {
    next(err);
  }
};

export const updateClientValuation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const existingRows = await query(
      `SELECT * FROM pm_client_valuations WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!existingRows.length) throw httpError(404, "NOT_FOUND", "Valuation not found");
    const existing = existingRows[0];
    if (existing.status === "APPROVED" && req.user?.role !== "admin") {
      throw httpError(403, "FORBIDDEN", "Cannot modify an approved valuation without administrator authorization");
    }

    const items = Array.isArray(b.items) ? b.items : [];
    let grossClaimed = 0;
    let prevCertifiedTotal = 0;
    let currentWorkTotal = 0;

    for (const it of items) {
      const cVal = Number(it.cumulative_value || (Number(it.cumulative_qty || 0) * Number(it.contract_rate || 0)));
      const pVal = Number(it.prev_certified_value || 0);
      const curVal = Number(it.assessed_value || it.current_period_value || (cVal - pVal));
      grossClaimed += cVal;
      prevCertifiedTotal += pVal;
      currentWorkTotal += curVal;
    }

    if (items.length === 0) {
      grossClaimed = Number(b.cumulative_work_done || b.gross_claimed || existing.gross_claimed || 0);
      prevCertifiedTotal = Number(b.previously_certified || b.previous_certified || existing.previous_certified || 0);
      currentWorkTotal = Math.max(0, grossClaimed - prevCertifiedTotal);
    }

    const matOnSite = Number(b.materials_on_site_value ?? existing.materials_on_site_value ?? 0);
    const dayworks = Number(b.dayworks_value ?? existing.dayworks_value ?? 0);
    const approvedVars = Number(b.approved_variations_total ?? b.approved_variations_value ?? existing.approved_variations_total ?? 0);
    const otherAdds = Number(b.other_additions_value ?? existing.other_additions_value ?? 0);

    const grossAssessed = currentWorkTotal + matOnSite + dayworks + approvedVars + otherAdds;

    const retPct = Number(b.retention_percent ?? existing.retention_percent ?? 5.0);
    const retentionAmt = Number(((grossAssessed * retPct) / 100).toFixed(2));

    const advRecPct = Number(b.advance_recovery_percent ?? existing.advance_recovery_percent ?? 10.0);
    const advanceRecoveryAmt = Number(((grossAssessed * advRecPct) / 100).toFixed(2));

    const otherDeductions = Number(b.other_deductions ?? b.other_deductions_amount ?? existing.other_deductions ?? 0);
    const netAmountDue = Math.max(0, grossAssessed - retentionAmt - advanceRecoveryAmt - otherDeductions);

    await query(
      `UPDATE pm_client_valuations SET 
         valuation_date = :valuation_date,
         period_from = :period_from,
         period_to = :period_to,
         valuation_type = :valuation_type,
         gross_claimed = :gross_claimed,
         gross_certified = :gross_certified,
         previous_certified = :previous_certified,
         current_certified = :current_certified,
         materials_on_site_value = :materials_on_site_value,
         dayworks_value = :dayworks_value,
         other_additions_value = :other_additions_value,
         approved_variations_total = :approved_variations_total,
         retention_percent = :retention_percent,
         retention_deducted = :retention_deducted,
         advance_recovery_percent = :advance_recovery_percent,
         advance_recovered = :advance_recovered,
         other_deductions = :other_deductions,
         gross_assessed_value = :gross_assessed_value,
         current_assessed_amount = :current_assessed_amount,
         net_amount_due = :net_amount_due,
         status = :status,
         remarks = :remarks
       WHERE id = :id`,
      {
        id,
        valuation_date: b.valuation_date || existing.valuation_date,
        period_from: b.period_from || existing.period_from,
        period_to: b.period_to || existing.period_to,
        valuation_type: b.valuation_type || existing.valuation_type || "INTERIM",
        gross_claimed: grossClaimed,
        gross_certified: grossAssessed,
        previous_certified: prevCertifiedTotal,
        current_certified: currentWorkTotal,
        materials_on_site_value: matOnSite,
        dayworks_value: dayworks,
        other_additions_value: otherAdds,
        approved_variations_total: approvedVars,
        retention_percent: retPct,
        retention_deducted: retentionAmt,
        advance_recovery_percent: advRecPct,
        advance_recovered: advanceRecoveryAmt,
        other_deductions: otherDeductions,
        gross_assessed_value: grossAssessed,
        current_assessed_amount: netAmountDue,
        net_amount_due: netAmountDue,
        status: b.status || existing.status,
        remarks: b.remarks || existing.remarks,
      }
    );

    if (items.length > 0) {
      await query(`DELETE FROM pm_client_valuation_lines WHERE valuation_id = :id`, { id });
      for (const it of items) {
        await query(
          `INSERT INTO pm_client_valuation_lines 
            (valuation_id, boq_item_id, item_code, description, uom, boq_qty, unit_rate,
             contract_qty, contract_rate, contract_amount, prev_cumulative_qty, current_period_qty,
             cumulative_qty, percentage_complete, cumulative_value, prev_certified_value,
             current_period_value, assessed_value, remarks, is_variation, variation_id)
           VALUES 
            (:valuation_id, :boq_item_id, :item_code, :description, :uom, :boq_qty, :unit_rate,
             :contract_qty, :contract_rate, :contract_amount, :prev_cumulative_qty, :current_period_qty,
             :cumulative_qty, :percentage_complete, :cumulative_value, :prev_certified_value,
             :current_period_value, :assessed_value, :remarks, :is_variation, :variation_id)`,
          {
            valuation_id: id,
            boq_item_id: it.boq_item_id ? toNumber(it.boq_item_id) : null,
            item_code: it.item_code || null,
            description: it.description || "",
            uom: it.uom || "EA",
            boq_qty: Number(it.contract_qty || it.boq_qty || 0),
            unit_rate: Number(it.contract_rate || it.unit_rate || 0),
            contract_qty: Number(it.contract_qty || 0),
            contract_rate: Number(it.contract_rate || 0),
            contract_amount: Number(it.contract_amount || (Number(it.contract_qty || 0) * Number(it.contract_rate || 0))),
            prev_cumulative_qty: Number(it.prev_cumulative_qty || 0),
            current_period_qty: Number(it.current_period_qty || 0),
            cumulative_qty: Number(it.cumulative_qty || 0),
            percentage_complete: Number(it.percentage_complete || 0),
            cumulative_value: Number(it.cumulative_value || 0),
            prev_certified_value: Number(it.prev_certified_value || 0),
            current_period_value: Number(it.current_period_value || 0),
            assessed_value: Number(it.assessed_value || it.current_period_value || 0),
            remarks: it.remarks || null,
            is_variation: it.is_variation ? 1 : 0,
            variation_id: it.variation_id ? toNumber(it.variation_id) : null,
          }
        );
      }
    }

    res.json({ id, message: "Client valuation updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateClientValuationStatus = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { status, remarks, forwarded_to_username } = req.body || {};
    if (!status) throw httpError(400, "VALIDATION_ERROR", "Status is required");

    const validStatuses = ["DRAFT", "PENDING_APPROVAL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED", "CERTIFIED", "REVERSED"];
    if (!validStatuses.includes(status)) throw httpError(400, "VALIDATION_ERROR", "Invalid valuation status");

    const existingRows = await query(
      `SELECT * FROM pm_client_valuations WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!existingRows.length) throw httpError(404, "NOT_FOUND", "Valuation not found");
    const val = existingRows[0];

    let history = [];
    try {
      history = typeof val.approval_history === "string" ? JSON.parse(val.approval_history || "[]") : (val.approval_history || []);
    } catch (_) {}
    history.push({
      action: status,
      from_status: val.status,
      to_status: status,
      user_id: req.user?.id || null,
      username: req.user?.username || "System",
      remarks: remarks || "",
      timestamp: new Date().toISOString()
    });

    await query(
      `UPDATE pm_client_valuations 
       SET status = :status, forwarded_to_username = :forwarded_to_username, remarks = COALESCE(:remarks, remarks), approval_history = :history
       WHERE id = :id`,
      { id, status, forwarded_to_username: forwarded_to_username !== undefined ? forwarded_to_username : null, remarks: remarks || null, history: JSON.stringify(history) }
    );

    res.json({ id, status, message: `Valuation status updated to ${status}` });
  } catch (err) {
    next(err);
  }
};

// ==========================================
// 7b. INTERIM PAYMENT APPLICATIONS (IPAs)
// ==========================================

export const listPaymentApplications = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    const valuationId = toNumber(req.query.valuation_id);
    let sql = `SELECT pa.*,
                      p.project_name, p.project_code,
                      COALESCE(c.customer_name, pa.client_name, p.client_name, 'Client') AS client_name,
                      v.valuation_no AS linked_valuation_no
               FROM pm_payment_applications pa
               JOIN pm_projects p ON p.id = pa.project_id
               LEFT JOIN sal_customers c ON c.id = p.client_id
               LEFT JOIN pm_client_valuations v ON v.id = pa.valuation_id
               WHERE (pa.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
    if (projectId) {
      sql += ` AND pa.project_id = :projectId`;
      params.projectId = projectId;
    }
    if (valuationId) {
      sql += ` AND pa.valuation_id = :valuationId`;
      params.valuationId = valuationId;
    }
    sql += ` ORDER BY pa.id DESC`;
    const items = await query(sql, params);
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getPaymentApplicationById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const id = toNumber(req.params.id);
    const rows = await query(
      `SELECT pa.*,
              p.project_name, p.project_code, p.contract_sum, p.revised_contract_sum,
              COALESCE(c.customer_name, pa.client_name, p.client_name, 'Client') AS client_name,
              v.valuation_no AS linked_valuation_no, v.valuation_date AS linked_valuation_date
       FROM pm_payment_applications pa
       JOIN pm_projects p ON p.id = pa.project_id
       LEFT JOIN sal_customers c ON c.id = p.client_id
       LEFT JOIN pm_client_valuations v ON v.id = pa.valuation_id
       WHERE pa.id = :id AND (pa.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Payment application not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
};

export const createPaymentApplication = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    await ensureConstructionTables();
    const b = req.body || {};
    const appNo = b.application_number;
    if (!b.project_id || !appNo) {
      throw httpError(400, "VALIDATION_ERROR", "Project and application number required");
    }

    const projRows = await query(
      `SELECT * FROM pm_projects WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`, 
      { id: toNumber(b.project_id), companyId: companyId || null }
    );
    if (!projRows.length) throw httpError(404, "NOT_FOUND", "Project not found");
    const proj = projRows[0];

    const targetCompanyId = companyId || proj.company_id || 1;
    const targetBranchId = branchId || proj.branch_id || 1;

    // Check duplicate
    const dup = await query(
      `SELECT id FROM pm_payment_applications WHERE company_id = :companyId AND application_number = :appNo LIMIT 1`,
      { companyId: targetCompanyId, appNo }
    );
    if (dup.length) throw httpError(409, "DUPLICATE", `Application number ${appNo} already exists`);

    // Financial numbers
    const workCompleted = Number(b.work_completed_value || 0);
    const approvedVars = Number(b.approved_variations_value || 0);
    const materialsOnSite = Number(b.materials_on_site_value || 0);
    const otherAdds = Number(b.other_additions_value || 0);
    const grossAssessed = Number(b.gross_amount_assessed || (workCompleted + approvedVars + materialsOnSite + otherAdds));
    const retentionAmt = Number(b.retention_amount || 0);
    const advanceRecAmt = Number(b.advance_recovery_amount || 0);
    const otherDeductions = Number(b.other_deductions_amount || 0);
    const prevCertified = Number(b.previous_certified_amount || 0);
    const adjustments = Number(b.adjustments_amount || 0);
    const netRequested = Number(b.net_amount_requested || (grossAssessed - retentionAmt - advanceRecAmt - otherDeductions - prevCertified + adjustments));

    const result = await query(
      `INSERT INTO pm_payment_applications 
        (company_id, branch_id, application_number, project_id, contract_ref, client_id, client_name, contractor_name,
         valuation_id, valuation_no, application_date, period_from, period_to, due_date, payment_terms, currency,
         application_type, status,
         work_completed_value, approved_variations_value, materials_on_site_value, other_additions_value,
         gross_amount_assessed, retention_amount, advance_recovery_amount, other_deductions_amount,
         previous_certified_amount, adjustments_amount, net_amount_requested,
         submitted_amount, assessed_amount, certified_amount, outstanding_balance, payment_status,
         attachments, created_by)
       VALUES 
        (:companyId, :branchId, :application_number, :project_id, :contract_ref, :client_id, :client_name, :contractor_name,
         :valuation_id, :valuation_no, :application_date, :period_from, :period_to, :due_date, :payment_terms, :currency,
         :application_type, :status,
         :work_completed_value, :approved_variations_value, :materials_on_site_value, :other_additions_value,
         :gross_amount_assessed, :retention_amount, :advance_recovery_amount, :other_deductions_amount,
         :previous_certified_amount, :adjustments_amount, :net_amount_requested,
         :submitted_amount, :assessed_amount, :certified_amount, :outstanding_balance, :payment_status,
         :attachments, :created_by)`,
      {
        companyId: targetCompanyId,
        branchId: targetBranchId,
        application_number: appNo,
        project_id: proj.id,
        contract_ref: b.contract_ref || proj.contract_ref_no || null,
        client_id: proj.client_id || null,
        client_name: b.client_name || proj.client_name || "Client",
        contractor_name: b.contractor_name || "Contractor",
        valuation_id: b.valuation_id ? toNumber(b.valuation_id) : null,
        valuation_no: b.valuation_no || null,
        application_date: b.application_date || new Date().toISOString().split("T")[0],
        period_from: b.period_from || null,
        period_to: b.period_to || null,
        due_date: b.due_date || null,
        payment_terms: b.payment_terms || "30 Days from Certification",
        currency: b.currency || "GHS",
        application_type: b.application_type || "INTERIM",
        status: b.status || "DRAFT",
        work_completed_value: workCompleted,
        approved_variations_value: approvedVars,
        materials_on_site_value: materialsOnSite,
        other_additions_value: otherAdds,
        gross_amount_assessed: grossAssessed,
        retention_amount: retentionAmt,
        advance_recovery_amount: advanceRecAmt,
        other_deductions_amount: otherDeductions,
        previous_certified_amount: prevCertified,
        adjustments_amount: adjustments,
        net_amount_requested: netRequested,
        submitted_amount: netRequested,
        assessed_amount: netRequested,
        certified_amount: 0,
        outstanding_balance: 0,
        payment_status: "UNPAID",
        attachments: b.attachments ? JSON.stringify(b.attachments) : null,
        created_by: req.user?.id || null,
      }
    );

    res.status(201).json({
      id: result.insertId,
      application_number: appNo,
      net_amount_requested: netRequested,
      message: "Interim Payment Application submitted successfully"
    });
  } catch (err) {
    next(err);
  }
};

export const createPaymentApplicationFromValuation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    await ensureConstructionTables();
    const valuationId = toNumber(req.params.id);

    const valRows = await query(
      `SELECT v.*, p.project_code, p.project_name, p.contract_ref_no, p.retention_percent, p.advance_recovery_percent
       FROM pm_client_valuations v
       JOIN pm_projects p ON p.id = v.project_id
       WHERE v.id = :id AND (v.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id: valuationId, companyId: companyId || null }
    );
    if (!valRows.length) throw httpError(404, "NOT_FOUND", "Valuation not found");
    const val = valRows[0];

    const targetCompanyId = companyId || val.company_id || 1;
    const targetBranchId = branchId || val.branch_id || 1;

    // Generate IPA number
    const countRows = await query(
      `SELECT COUNT(*) as c FROM pm_payment_applications WHERE company_id = :companyId`,
      { companyId: targetCompanyId }
    );
    const ipaNo = `IPA-${val.project_code || "PRJ"}-${Number(countRows[0]?.c || 0) + 1}`;

    // Get previous certified amount for this project
    const prevCertRows = await query(
      `SELECT SUM(certified_amount) as total FROM pm_payment_applications 
       WHERE project_id = :projectId AND (company_id = :companyId OR :companyId IS NULL)
         AND status IN ('CERTIFIED', 'PARTIALLY_CERTIFIED', 'PAID')`,
      { projectId: val.project_id, companyId: targetCompanyId }
    );
    const prevCertified = Number(prevCertRows[0]?.total || val.previous_certified || 0);

    const workVal = Number(val.current_certified || (val.gross_claimed - val.previous_certified) || 0);
    const varsVal = Number(val.approved_variations_total || 0);
    const matVal = Number(val.materials_on_site_value || 0);
    const otherVal = Number(val.other_additions_value || 0);
    const grossAssessed = Number(val.gross_assessed_value || (workVal + varsVal + matVal + otherVal));
    const retAmt = Number(val.retention_deducted || 0);
    const advAmt = Number(val.advance_recovered || 0);
    const otherDed = Number(val.other_deductions || 0);
    const netRequested = Number(val.net_amount_due || (grossAssessed - retAmt - advAmt - otherDed));

    const result = await query(
      `INSERT INTO pm_payment_applications 
        (company_id, branch_id, application_number, project_id, contract_ref, client_id, client_name, contractor_name,
         valuation_id, valuation_no, application_date, period_from, period_to, due_date, payment_terms, currency,
         application_type, status,
         work_completed_value, approved_variations_value, materials_on_site_value, other_additions_value,
         gross_amount_assessed, retention_amount, advance_recovery_amount, other_deductions_amount,
         previous_certified_amount, adjustments_amount, net_amount_requested,
         submitted_amount, assessed_amount, certified_amount, outstanding_balance, payment_status,
         created_by)
       VALUES 
        (:companyId, :branchId, :application_number, :project_id, :contract_ref, :client_id, :client_name, :contractor_name,
         :valuation_id, :valuation_no, :application_date, :period_from, :period_to, :due_date, :payment_terms, :currency,
         :application_type, :status,
         :work_completed_value, :approved_variations_value, :materials_on_site_value, :other_additions_value,
         :gross_amount_assessed, :retention_amount, :advance_recovery_amount, :other_deductions_amount,
         :previous_certified_amount, :adjustments_amount, :net_amount_requested,
         :submitted_amount, :assessed_amount, :certified_amount, :outstanding_balance, :payment_status,
         :created_by)`,
      {
        companyId: targetCompanyId,
        branchId: targetBranchId,
        application_number: ipaNo,
        project_id: val.project_id,
        contract_ref: val.contract_ref || val.contract_ref_no || null,
        client_id: val.client_id || null,
        client_name: val.client_name || "Client",
        contractor_name: val.contractor_name || "Contractor",
        valuation_id: val.id,
        valuation_no: val.valuation_no || val.application_no || null,
        application_date: new Date().toISOString().split("T")[0],
        period_from: val.period_from || null,
        period_to: val.period_to || null,
        due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
        payment_terms: "30 Days from Certification",
        currency: "GHS",
        application_type: val.valuation_type || "INTERIM",
        status: "DRAFT",
        work_completed_value: workVal,
        approved_variations_value: varsVal,
        materials_on_site_value: matVal,
        other_additions_value: otherVal,
        gross_amount_assessed: grossAssessed,
        retention_amount: retAmt,
        advance_recovery_amount: advAmt,
        other_deductions_amount: otherDed,
        previous_certified_amount: prevCertified,
        adjustments_amount: 0,
        net_amount_requested: netRequested,
        submitted_amount: netRequested,
        assessed_amount: netRequested,
        certified_amount: 0,
        outstanding_balance: 0,
        payment_status: "UNPAID",
        created_by: req.user?.id || null,
      }
    );

    res.status(201).json({
      id: result.insertId,
      application_number: ipaNo,
      net_amount_requested: netRequested,
      message: `Interim Payment Application ${ipaNo} prepared from Valuation`
    });
  } catch (err) {
    next(err);
  }
};

export const updatePaymentApplication = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const existingRows = await query(
      `SELECT * FROM pm_payment_applications WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!existingRows.length) throw httpError(404, "NOT_FOUND", "Payment application not found");
    const existing = existingRows[0];

    const workVal = Number(b.work_completed_value ?? existing.work_completed_value ?? 0);
    const varsVal = Number(b.approved_variations_value ?? existing.approved_variations_value ?? 0);
    const matVal = Number(b.materials_on_site_value ?? existing.materials_on_site_value ?? 0);
    const otherVal = Number(b.other_additions_value ?? existing.other_additions_value ?? 0);
    const grossAssessed = Number(b.gross_amount_assessed ?? (workVal + varsVal + matVal + otherVal));
    const retAmt = Number(b.retention_amount ?? existing.retention_amount ?? 0);
    const advAmt = Number(b.advance_recovery_amount ?? existing.advance_recovery_amount ?? 0);
    const otherDed = Number(b.other_deductions_amount ?? existing.other_deductions_amount ?? 0);
    const prevCert = Number(b.previous_certified_amount ?? existing.previous_certified_amount ?? 0);
    const adj = Number(b.adjustments_amount ?? existing.adjustments_amount ?? 0);
    const netReq = Number(b.net_amount_requested ?? (grossAssessed - retAmt - advAmt - otherDed - prevCert + adj));

    await query(
      `UPDATE pm_payment_applications SET
         application_date = :application_date,
         period_from = :period_from,
         period_to = :period_to,
         due_date = :due_date,
         payment_terms = :payment_terms,
         currency = :currency,
         application_type = :application_type,
         status = :status,
         work_completed_value = :work_completed_value,
         approved_variations_value = :approved_variations_value,
         materials_on_site_value = :materials_on_site_value,
         other_additions_value = :other_additions_value,
         gross_amount_assessed = :gross_amount_assessed,
         retention_amount = :retention_amount,
         advance_recovery_amount = :advance_recovery_amount,
         other_deductions_amount = :other_deductions_amount,
         previous_certified_amount = :previous_certified_amount,
         adjustments_amount = :adjustments_amount,
         net_amount_requested = :net_amount_requested,
         submitted_amount = :submitted_amount,
         assessed_amount = :assessed_amount
       WHERE id = :id`,
      {
        id,
        application_date: b.application_date || existing.application_date,
        period_from: b.period_from || existing.period_from,
        period_to: b.period_to || existing.period_to,
        due_date: b.due_date || existing.due_date,
        payment_terms: b.payment_terms || existing.payment_terms,
        currency: b.currency || existing.currency,
        application_type: b.application_type || existing.application_type,
        status: b.status || existing.status,
        work_completed_value: workVal,
        approved_variations_value: varsVal,
        materials_on_site_value: matVal,
        other_additions_value: otherVal,
        gross_amount_assessed: grossAssessed,
        retention_amount: retAmt,
        advance_recovery_amount: advAmt,
        other_deductions_amount: otherDed,
        previous_certified_amount: prevCert,
        adjustments_amount: adj,
        net_amount_requested: netReq,
        submitted_amount: netReq,
        assessed_amount: Number(b.assessed_amount ?? netReq),
      }
    );

    res.json({ id, message: "Payment application updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const certifyPaymentApplication = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const existingRows = await query(
      `SELECT pa.*, p.project_code FROM pm_payment_applications pa 
       JOIN pm_projects p ON p.id = pa.project_id
       WHERE pa.id = :id AND (pa.company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!existingRows.length) throw httpError(404, "NOT_FOUND", "Payment application not found");
    const existing = existingRows[0];

    const certAmount = Number(b.certified_amount ?? existing.net_amount_requested);
    const assessedAmount = Number(b.assessed_amount ?? existing.assessed_amount ?? existing.net_amount_requested);
    const rejectedAmount = Number(b.rejected_amount ?? Math.max(0, existing.net_amount_requested - certAmount));
    const status = b.status || (certAmount === 0 ? "REJECTED" : certAmount < existing.net_amount_requested ? "PARTIALLY_CERTIFIED" : "CERTIFIED");

    const certDocNo = b.certification_doc_no || `IPC-${existing.project_code || "PRJ"}-${existing.id}`;
    const outstandingBalance = Math.max(0, certAmount - Number(existing.amount_paid || 0));

    let history = [];
    try {
      history = typeof existing.approval_history === "string" ? JSON.parse(existing.approval_history || "[]") : (existing.approval_history || []);
    } catch (_) {}
    history.push({
      action: status,
      certified_amount: certAmount,
      user_id: req.user?.id || null,
      username: req.user?.username || "Certifier",
      reason: b.adjustment_reason || "",
      timestamp: new Date().toISOString()
    });

    await query(
      `UPDATE pm_payment_applications SET
         certified_amount = :certified_amount,
         assessed_amount = :assessed_amount,
         rejected_amount = :rejected_amount,
         adjustment_reason = :adjustment_reason,
         qs_comments = :qs_comments,
         pm_comments = :pm_comments,
         certified_by = :certified_by,
         certified_by_name = :certified_by_name,
         certified_at = NOW(),
         certification_doc_no = :certification_doc_no,
         outstanding_balance = :outstanding_balance,
         status = :status,
         approval_history = :approval_history
       WHERE id = :id`,
      {
        id,
        certified_amount: certAmount,
        assessed_amount: assessedAmount,
        rejected_amount: rejectedAmount,
        adjustment_reason: b.adjustment_reason || null,
        qs_comments: b.qs_comments || null,
        pm_comments: b.pm_comments || null,
        certified_by: req.user?.id || null,
        certified_by_name: req.user?.username || "Certified Engineer",
        certification_doc_no: certDocNo,
        outstanding_balance: outstandingBalance,
        status,
        approval_history: JSON.stringify(history)
      }
    );

    res.json({
      id,
      certified_amount: certAmount,
      status,
      certification_doc_no: certDocNo,
      message: `Payment application ${status.toLowerCase().replace("_", " ")} successfully`
    });
  } catch (err) {
    next(err);
  }
};

export const recordPaymentApplicationPayment = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};
    const paymentAmount = Number(b.payment_amount || 0);
    if (paymentAmount <= 0) throw httpError(400, "VALIDATION_ERROR", "Payment amount must be greater than zero");

    const existingRows = await query(
      `SELECT * FROM pm_payment_applications WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!existingRows.length) throw httpError(404, "NOT_FOUND", "Payment application not found");
    const existing = existingRows[0];

    const newAmountPaid = Number(existing.amount_paid || 0) + paymentAmount;
    const certAmount = Number(existing.certified_amount || existing.net_amount_requested || 0);
    const outstanding = Math.max(0, certAmount - newAmountPaid);
    const paymentStatus = outstanding <= 0 ? "PAID" : "PARTIALLY_PAID";
    const appStatus = outstanding <= 0 ? "PAID" : existing.status;

    await query(
      `UPDATE pm_payment_applications SET
         amount_paid = :amount_paid,
         outstanding_balance = :outstanding_balance,
         payment_status = :payment_status,
         status = :status,
         payment_voucher_ref = COALESCE(:payment_voucher_ref, payment_voucher_ref),
         payment_date = COALESCE(:payment_date, payment_date),
         payment_method = COALESCE(:payment_method, payment_method),
         finance_notes = COALESCE(:finance_notes, finance_notes)
       WHERE id = :id`,
      {
        id,
        amount_paid: newAmountPaid,
        outstanding_balance: outstanding,
        payment_status: paymentStatus,
        status: appStatus,
        payment_voucher_ref: b.payment_voucher_ref || null,
        payment_date: b.payment_date || new Date().toISOString().split("T")[0],
        payment_method: b.payment_method || "BANK_TRANSFER",
        finance_notes: b.finance_notes || null,
      }
    );

    res.json({
      id,
      amount_paid: newAmountPaid,
      outstanding_balance: outstanding,
      payment_status: paymentStatus,
      message: `Payment of GHS ${paymentAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} recorded`
    });
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
    let sql = `
      SELECT v.*, 
             p.project_name, 
             p.project_code,
             COALESCE(v.client_name, p.client_name) AS client_name,
             p.contract_sum,
             p.revised_contract_sum,
             p.budget,
             u.username AS creator_username,
             app.username AS approver_username,
             (SELECT COUNT(*) FROM pm_variation_items WHERE variation_id = v.id) AS item_count
      FROM pm_variations v 
      JOIN pm_projects p ON p.id = v.project_id 
      LEFT JOIN adm_users u ON u.id = v.created_by
      LEFT JOIN adm_users app ON app.id = v.approved_by
      WHERE (v.company_id = :companyId OR :companyId IS NULL)
    `;
    const params = { companyId: companyId || null };
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

export const getVariationDetails = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "BAD_REQUEST", "Variation ID required");

    const varRows = await query(
      `SELECT v.*, 
              p.project_name, 
              p.project_code,
              COALESCE(v.client_name, p.client_name) AS client_name,
              p.contract_sum,
              p.revised_contract_sum,
              p.budget,
              p.start_date,
              p.end_date,
              u.username AS creator_username,
              app.username AS approver_username
       FROM pm_variations v
       JOIN pm_projects p ON p.id = v.project_id
       LEFT JOIN adm_users u ON u.id = v.created_by
       LEFT JOIN adm_users app ON app.id = v.approved_by
       WHERE v.id = :id AND (v.company_id = :companyId OR :companyId IS NULL)
       LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!varRows.length) throw httpError(404, "NOT_FOUND", "Variation not found");
    const variation = varRows[0];

    // Fetch line items
    const items = await query(
      `SELECT * FROM pm_variation_items WHERE variation_id = :id ORDER BY id ASC`,
      { id }
    );

    // Fetch previously approved variation totals on this project (excluding current)
    const prevRows = await query(
      `SELECT COALESCE(SUM(amount_approved), 0) AS total_prev_approved
       FROM pm_variations 
       WHERE project_id = :projectId AND status IN ('APPROVED', 'IN_IMPLEMENTATION', 'COMPLETED') AND id != :id`,
      { projectId: variation.project_id, id }
    );
    const previouslyApproved = Number(prevRows[0]?.total_prev_approved || 0);

    // Fetch project tasks for schedule dependency impact
    let tasks = [];
    try {
      tasks = await query(
        `SELECT id, task_code, title, start_date, end_date, status 
         FROM pm_tasks WHERE project_id = :projectId ORDER BY id ASC`,
        { projectId: variation.project_id }
      );
    } catch (e) {}

    // Fetch active BOQ items for the project (to easily reference/modify/omit)
    let boqItems = [];
    try {
      const boqRows = await query(
        `SELECT id FROM pm_boqs WHERE project_id = :projectId ORDER BY CASE WHEN status = 'APPROVED' THEN 0 ELSE 1 END, id DESC LIMIT 1`,
        { projectId: variation.project_id }
      );
      if (boqRows.length) {
        boqItems = await query(
          `SELECT id, item_code, item_description, uom, quantity, unit_rate, amount, cost_category
           FROM pm_boq_items WHERE boq_id = :boqId ORDER BY item_order ASC, id ASC`,
          { boqId: boqRows[0].id }
        );
      }
    } catch (e) {}

    res.json({
      variation,
      items,
      tasks,
      boqItems,
      financials: {
        original_contract_sum: Number(variation.contract_sum || 0),
        previously_approved_variations: previouslyApproved,
        current_proposed_change: Number(variation.cost_impact || 0),
        contractor_proposed_amount: Number(variation.contractor_proposed_amount || variation.cost_impact || 0),
        assessed_amount: Number(variation.assessed_amount || 0),
        amount_approved: Number(variation.amount_approved || 0),
        revised_contract_sum: Number(variation.contract_sum || 0) + previouslyApproved + Number(variation.amount_approved || variation.cost_impact || 0),
        approved_project_budget: Number(variation.budget || 0),
      }
    });
  } catch (err) {
    next(err);
  }
};

export const createVariation = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.title) {
      throw httpError(400, "VALIDATION_ERROR", "Project and title are required");
    }

    // Generate variation number if not provided
    let variationNo = b.variation_no || b.variation_number;
    if (!variationNo) {
      const projRows = await query(
        `SELECT project_code FROM pm_projects WHERE id = :projectId LIMIT 1`,
        { projectId: toNumber(b.project_id) }
      );
      const code = projRows[0]?.project_code || "PRJ";
      const countRows = await query(
        `SELECT COUNT(*) AS total FROM pm_variations WHERE project_id = :projectId`,
        { projectId: toNumber(b.project_id) }
      );
      const seq = String(Number(countRows[0]?.total || 0) + 1).padStart(3, "0");
      const prefix = b.document_stage === "CHANGE_ORDER" ? "CO" : "VAR";
      variationNo = `${prefix}-${code}-${new Date().getFullYear()}-${seq}`;
    }

    const items = Array.isArray(b.items) ? b.items : [];
    // Compute line cost impact
    let totalCostImpact = 0;
    const processedItems = items.map(it => {
      const origQty = Number(it.original_qty || 0);
      const origRate = Number(it.original_rate || 0);
      const revQty = Number(it.revised_qty || 0);
      const propRate = Number(it.proposed_rate || 0);
      const origAmt = origQty * origRate;
      const propAmt = revQty * propRate;
      const qtyDiff = revQty - origQty;
      const costDiff = propAmt - origAmt;
      totalCostImpact += costDiff;
      return {
        ...it,
        original_qty: origQty,
        original_rate: origRate,
        original_amount: origAmt,
        revised_qty: revQty,
        proposed_rate: propRate,
        proposed_amount: propAmt,
        qty_diff: qtyDiff,
        cost_diff: costDiff
      };
    });

    const netCostImpact = Number(b.cost_impact !== undefined ? b.cost_impact : totalCostImpact);

    const result = await query(
      `INSERT INTO pm_variations 
        (company_id, branch_id, project_id, variation_no, document_stage, title, description, reason,
         change_type, priority, originator, contract_ref, client_name, contractor_name, subcontractor_id,
         date_raised, effective_date, cost_impact, contractor_proposed_amount, assessed_amount, amount_approved,
         schedule_impact_days, original_completion_date, revised_completion_date, affected_tasks,
         risk_assessment, hsq_implications, funding_source, contingency_impact, direct_cost, overhead_cost,
         markup_percent, tax_amount, supporting_documents, status, workflow_stage, remarks, created_by)
       VALUES 
        (:companyId, :branchId, :project_id, :variation_no, :document_stage, :title, :description, :reason,
         :change_type, :priority, :originator, :contract_ref, :client_name, :contractor_name, :subcontractor_id,
         :date_raised, :effective_date, :cost_impact, :contractor_proposed_amount, :assessed_amount, :amount_approved,
         :schedule_impact_days, :original_completion_date, :revised_completion_date, :affected_tasks,
         :risk_assessment, :hsq_implications, :funding_source, :contingency_impact, :direct_cost, :overhead_cost,
         :markup_percent, :tax_amount, :supporting_documents, :status, :workflow_stage, :remarks, :created_by)`,
      {
        companyId,
        branchId: branchId || null,
        project_id: toNumber(b.project_id),
        variation_no: variationNo,
        document_stage: b.document_stage || "VARIATION_REQUEST",
        title: b.title,
        description: b.description || "",
        reason: b.reason || "CLIENT_REQUEST",
        change_type: b.change_type || "SCOPE_QUANTITY",
        priority: b.priority || "NORMAL",
        originator: b.originator || b.initiator || "CLIENT",
        contract_ref: b.contract_ref || null,
        client_name: b.client_name || null,
        contractor_name: b.contractor_name || null,
        subcontractor_id: b.subcontractor_id ? toNumber(b.subcontractor_id) : null,
        date_raised: b.date_raised || new Date().toISOString().split("T")[0],
        effective_date: b.effective_date || null,
        cost_impact: netCostImpact,
        contractor_proposed_amount: Number(b.contractor_proposed_amount || netCostImpact),
        assessed_amount: Number(b.assessed_amount || netCostImpact),
        amount_approved: Number(b.amount_approved || 0),
        schedule_impact_days: Number(b.schedule_impact_days || 0),
        original_completion_date: b.original_completion_date || null,
        revised_completion_date: b.revised_completion_date || null,
        affected_tasks: b.affected_tasks || null,
        risk_assessment: b.risk_assessment || null,
        hsq_implications: b.hsq_implications || null,
        funding_source: b.funding_source || "CLIENT_FUNDED",
        contingency_impact: Number(b.contingency_impact || 0),
        direct_cost: Number(b.direct_cost || 0),
        overhead_cost: Number(b.overhead_cost || 0),
        markup_percent: Number(b.markup_percent || 0),
        tax_amount: Number(b.tax_amount || 0),
        supporting_documents: b.supporting_documents ? JSON.stringify(b.supporting_documents) : null,
        status: b.status || "DRAFT",
        workflow_stage: b.workflow_stage || 1,
        remarks: b.remarks || null,
        created_by: req.user?.id || null
      }
    );

    const variationId = result.insertId;

    // Insert line items
    for (const it of processedItems) {
      await query(
        `INSERT INTO pm_variation_items
          (variation_id, company_id, boq_item_id, item_code, item_description, change_action,
           uom, original_qty, original_rate, original_amount, revised_qty, proposed_rate,
           proposed_amount, qty_diff, cost_diff, cost_category, reason_and_spec)
         VALUES
          (:variation_id, :companyId, :boq_item_id, :item_code, :item_description, :change_action,
           :uom, :original_qty, :original_rate, :original_amount, :revised_qty, :proposed_rate,
           :proposed_amount, :qty_diff, :cost_diff, :cost_category, :reason_and_spec)`,
        {
          variation_id: variationId,
          companyId,
          boq_item_id: it.boq_item_id || null,
          item_code: it.item_code || null,
          item_description: it.item_description || "",
          change_action: it.change_action || "MODIFY",
          uom: it.uom || "Each",
          original_qty: it.original_qty,
          original_rate: it.original_rate,
          original_amount: it.original_amount,
          revised_qty: it.revised_qty,
          proposed_rate: it.proposed_rate,
          proposed_amount: it.proposed_amount,
          qty_diff: it.qty_diff,
          cost_diff: it.cost_diff,
          cost_category: it.cost_category || "MATERIALS",
          reason_and_spec: it.reason_and_spec || null
        }
      );
    }

    res.status(201).json({ id: variationId, variation_no: variationNo, message: "Variation request created successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateVariation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const varRows = await query(
      `SELECT * FROM pm_variations WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!varRows.length) throw httpError(404, "NOT_FOUND", "Variation not found");
    const v = varRows[0];

    // Compute line items cost impact
    const items = Array.isArray(b.items) ? b.items : [];
    let totalCostImpact = 0;
    const processedItems = items.map(it => {
      const origQty = Number(it.original_qty || 0);
      const origRate = Number(it.original_rate || 0);
      const revQty = Number(it.revised_qty || 0);
      const propRate = Number(it.proposed_rate || 0);
      const origAmt = origQty * origRate;
      const propAmt = revQty * propRate;
      const qtyDiff = revQty - origQty;
      const costDiff = propAmt - origAmt;
      totalCostImpact += costDiff;
      return {
        ...it,
        original_qty: origQty,
        original_rate: origRate,
        original_amount: origAmt,
        revised_qty: revQty,
        proposed_rate: propRate,
        proposed_amount: propAmt,
        qty_diff: qtyDiff,
        cost_diff: costDiff
      };
    });

    const netCostImpact = Number(b.cost_impact !== undefined ? b.cost_impact : (items.length ? totalCostImpact : v.cost_impact));

    await query(
      `UPDATE pm_variations SET
        title = :title,
        document_stage = :document_stage,
        description = :description,
        reason = :reason,
        change_type = :change_type,
        priority = :priority,
        originator = :originator,
        contract_ref = :contract_ref,
        client_name = :client_name,
        contractor_name = :contractor_name,
        subcontractor_id = :subcontractor_id,
        date_raised = :date_raised,
        effective_date = :effective_date,
        cost_impact = :cost_impact,
        contractor_proposed_amount = :contractor_proposed_amount,
        assessed_amount = :assessed_amount,
        schedule_impact_days = :schedule_impact_days,
        original_completion_date = :original_completion_date,
        revised_completion_date = :revised_completion_date,
        affected_tasks = :affected_tasks,
        risk_assessment = :risk_assessment,
        hsq_implications = :hsq_implications,
        funding_source = :funding_source,
        contingency_impact = :contingency_impact,
        direct_cost = :direct_cost,
        overhead_cost = :overhead_cost,
        markup_percent = :markup_percent,
        tax_amount = :tax_amount,
        supporting_documents = :supporting_documents,
        remarks = :remarks
       WHERE id = :id`,
      {
        id,
        title: b.title || v.title,
        document_stage: b.document_stage || v.document_stage,
        description: b.description !== undefined ? b.description : v.description,
        reason: b.reason || v.reason,
        change_type: b.change_type || v.change_type,
        priority: b.priority || v.priority,
        originator: b.originator || v.originator,
        contract_ref: b.contract_ref !== undefined ? b.contract_ref : v.contract_ref,
        client_name: b.client_name !== undefined ? b.client_name : v.client_name,
        contractor_name: b.contractor_name !== undefined ? b.contractor_name : v.contractor_name,
        subcontractor_id: b.subcontractor_id ? toNumber(b.subcontractor_id) : null,
        date_raised: b.date_raised || v.date_raised,
        effective_date: b.effective_date !== undefined ? b.effective_date : v.effective_date,
        cost_impact: netCostImpact,
        contractor_proposed_amount: Number(b.contractor_proposed_amount !== undefined ? b.contractor_proposed_amount : v.contractor_proposed_amount),
        assessed_amount: Number(b.assessed_amount !== undefined ? b.assessed_amount : v.assessed_amount),
        schedule_impact_days: Number(b.schedule_impact_days !== undefined ? b.schedule_impact_days : v.schedule_impact_days),
        original_completion_date: b.original_completion_date || v.original_completion_date,
        revised_completion_date: b.revised_completion_date || v.revised_completion_date,
        affected_tasks: b.affected_tasks !== undefined ? b.affected_tasks : v.affected_tasks,
        risk_assessment: b.risk_assessment !== undefined ? b.risk_assessment : v.risk_assessment,
        hsq_implications: b.hsq_implications !== undefined ? b.hsq_implications : v.hsq_implications,
        funding_source: b.funding_source || v.funding_source,
        contingency_impact: Number(b.contingency_impact !== undefined ? b.contingency_impact : v.contingency_impact),
        direct_cost: Number(b.direct_cost !== undefined ? b.direct_cost : v.direct_cost),
        overhead_cost: Number(b.overhead_cost !== undefined ? b.overhead_cost : v.overhead_cost),
        markup_percent: Number(b.markup_percent !== undefined ? b.markup_percent : v.markup_percent),
        tax_amount: Number(b.tax_amount !== undefined ? b.tax_amount : v.tax_amount),
        supporting_documents: b.supporting_documents ? JSON.stringify(b.supporting_documents) : (v.supporting_documents ? JSON.stringify(v.supporting_documents) : null),
        remarks: b.remarks !== undefined ? b.remarks : v.remarks
      }
    );

    // Sync line items if provided
    if (Array.isArray(b.items)) {
      await query(`DELETE FROM pm_variation_items WHERE variation_id = :id`, { id });
      for (const it of processedItems) {
        await query(
          `INSERT INTO pm_variation_items
            (variation_id, company_id, boq_item_id, item_code, item_description, change_action,
             uom, original_qty, original_rate, original_amount, revised_qty, proposed_rate,
             proposed_amount, qty_diff, cost_diff, cost_category, reason_and_spec)
           VALUES
            (:variation_id, :companyId, :boq_item_id, :item_code, :item_description, :change_action,
             :uom, :original_qty, :original_rate, :original_amount, :revised_qty, :proposed_rate,
             :proposed_amount, :qty_diff, :cost_diff, :cost_category, :reason_and_spec)`,
          {
            variation_id: id,
            companyId: v.company_id,
            boq_item_id: it.boq_item_id || null,
            item_code: it.item_code || null,
            item_description: it.item_description || "",
            change_action: it.change_action || "MODIFY",
            uom: it.uom || "Each",
            original_qty: it.original_qty,
            original_rate: it.original_rate,
            original_amount: it.original_amount,
            revised_qty: it.revised_qty,
            proposed_rate: it.proposed_rate,
            proposed_amount: it.proposed_amount,
            qty_diff: it.qty_diff,
            cost_diff: it.cost_diff,
            cost_category: it.cost_category || "MATERIALS",
            reason_and_spec: it.reason_and_spec || null
          }
        );
      }
    }

    res.json({ ok: true, message: "Variation updated successfully" });
  } catch (err) {
    next(err);
  }
};

export const advanceVariationWorkflow = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const {
      target_status,
      comments,
      amount_approved,
      schedule_impact_days,
      update_contract_sum = true,
      update_project_budget = false,
      budget_adjustment_amount = 0
    } = req.body || {};

    const varRows = await query(
      `SELECT * FROM pm_variations WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!varRows.length) throw httpError(404, "NOT_FOUND", "Variation not found");
    const v = varRows[0];

    const STAGE_MAP = {
      DRAFT: 1,
      PENDING_APPROVAL: 2,
      SUBMITTED: 2,
      UNDER_ASSESSMENT: 3,
      PENDING_AUTHORIZATION: 4,
      APPROVED: 5,
      IN_IMPLEMENTATION: 6,
      COMPLETED: 7,
      REJECTED: 0,
      WITHDRAWN: 0,
      RETURNED: 1,
      REVERSED: 1
    };

    const newStage = STAGE_MAP[target_status] !== undefined ? STAGE_MAP[target_status] : v.workflow_stage;
    const finalApprovedAmt = amount_approved !== undefined ? Number(amount_approved) : Number(v.assessed_amount || v.cost_impact);
    const finalDays = schedule_impact_days !== undefined ? Number(schedule_impact_days) : Number(v.schedule_impact_days || 0);

    const forwarded_to_username = req.body?.forwarded_to_username !== undefined ? req.body.forwarded_to_username : (target_status === "DRAFT" || target_status === "REVERSED" ? null : v.forwarded_to_username);
    let updateFields = `status = :target_status, workflow_stage = :newStage, forwarded_to_username = :forwarded_to_username`;
    const params = {
      id,
      target_status,
      newStage,
      forwarded_to_username
    };

    if (target_status === "APPROVED") {
      updateFields += `, amount_approved = :finalApprovedAmt, schedule_impact_days = :finalDays, approved_by = :approved_by, approved_at = NOW()`;
      params.finalApprovedAmt = finalApprovedAmt;
      params.finalDays = finalDays;
      params.approved_by = req.user?.id || null;

      // Downstream project integration based on user specification
      if (update_contract_sum && finalApprovedAmt !== 0) {
        await query(
          `UPDATE pm_projects SET revised_contract_sum = revised_contract_sum + :finalApprovedAmt WHERE id = :projectId`,
          { finalApprovedAmt, projectId: v.project_id }
        );
      }
      if (update_project_budget && Number(budget_adjustment_amount) !== 0) {
        await query(
          `UPDATE pm_projects SET budget = budget + :budgetAdj WHERE id = :projectId`,
          { budgetAdj: Number(budget_adjustment_amount), projectId: v.project_id }
        );
      }
      if (finalDays > 0) {
        await query(
          `UPDATE pm_projects SET end_date = DATE_ADD(end_date, INTERVAL :finalDays DAY) WHERE id = :projectId AND end_date IS NOT NULL`,
          { finalDays, projectId: v.project_id }
        );
      }
    } else if (target_status === "REJECTED") {
      updateFields += `, rejection_reason = :comments`;
      params.comments = comments || null;
    } else if (target_status === "RETURNED") {
      updateFields += `, remarks = CONCAT(COALESCE(remarks, ''), '\n[Returned for revision]: ', :comments)`;
      params.comments = comments || "";
    }

    await query(`UPDATE pm_variations SET ${updateFields} WHERE id = :id`, params);

    res.json({
      ok: true,
      status: target_status,
      workflow_stage: newStage,
      message: `Variation status updated to ${target_status}`
    });
  } catch (err) {
    next(err);
  }
};

export const approveVariation = async (req, res, next) => {
  req.body = { ...req.body, target_status: "APPROVED" };
  return advanceVariationWorkflow(req, res, next);
};

export const deleteVariation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const varRows = await query(
      `SELECT * FROM pm_variations WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL) LIMIT 1`,
      { id, companyId: companyId || null }
    );
    if (!varRows.length) throw httpError(404, "NOT_FOUND", "Variation not found");
    if (varRows[0].status !== "DRAFT") {
      throw httpError(400, "BAD_REQUEST", "Only draft variations can be deleted");
    }

    await query(`DELETE FROM pm_variation_items WHERE variation_id = :id`, { id });
    await query(`DELETE FROM pm_variations WHERE id = :id`, { id });

    res.json({ ok: true, message: "Variation deleted successfully" });
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
    let sql = `SELECT i.*, 
                      COALESCE(i.injured_person_name, i.persons_involved) AS injured_person_name,
                      COALESCE(i.persons_involved, i.injured_person_name) AS persons_involved,
                      COALESCE(i.days_lost, i.lost_workdays, 0) AS days_lost,
                      COALESCE(i.lost_workdays, i.days_lost, 0) AS lost_workdays,
                      COALESCE(i.root_cause, i.investigation_findings) AS root_cause,
                      COALESCE(i.corrective_action, i.corrective_actions) AS corrective_action,
                      COALESCE(i.reported_to_authority, 'N') AS reported_to_authority,
                      p.project_name, p.project_code
               FROM pm_safety_incidents i 
               JOIN pm_projects p ON p.id = i.project_id 
               WHERE i.company_id = :companyId`;
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.description) throw httpError(400, "VALIDATION_ERROR", "Project and incident description required");

    await ensureConstructionTables();

    const incidentNo = b.incident_no || b.incident_number || `INC-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const branch_id = branchId || 1;
    const reported_by = b.reported_by || req.user?.username || req.user?.name || "Safety Officer";
    const location = b.location || "Site";
    const person = b.injured_person_name || b.persons_involved || null;
    const days = Number(b.days_lost ?? b.lost_workdays ?? b.lost_work_days ?? 0);
    const cause = b.root_cause || b.investigation_findings || null;
    const action = b.corrective_action || b.corrective_actions || null;
    const reportedToAuth = b.reported_to_authority || (b.regulatory_notified ? "Y" : "N") || "N";
    const incType = b.incident_type || "NEAR_MISS";
    const severity = b.severity || "LOW";

    const result = await query(
      `INSERT INTO pm_safety_incidents 
        (company_id, branch_id, project_id, incident_no, incident_date, incident_type, severity, location, 
         description, persons_involved, injured_person_name, lost_workdays, days_lost, 
         immediate_action_taken, investigation_findings, root_cause, corrective_actions, corrective_action, 
         reported_to_authority, status, reported_by)
       VALUES 
        (:companyId, :branch_id, :project_id, :incident_no, :incident_date, :incident_type, :severity, :location,
         :description, :persons_involved, :injured_person_name, :lost_workdays, :days_lost,
         :immediate_action_taken, :investigation_findings, :root_cause, :corrective_actions, :corrective_action,
         :reported_to_authority, :status, :reported_by)`,
      {
        companyId,
        branch_id,
        project_id: toNumber(b.project_id),
        incident_no: incidentNo,
        incident_date: b.incident_date || new Date().toISOString().split("T")[0],
        incident_type: incType,
        severity,
        location,
        description: b.description,
        persons_involved: person,
        injured_person_name: person,
        lost_workdays: days,
        days_lost: days,
        immediate_action_taken: b.immediate_action_taken || null,
        investigation_findings: cause,
        root_cause: cause,
        corrective_actions: action,
        corrective_action: action,
        reported_to_authority: reportedToAuth,
        status: b.status || "REPORTED",
        reported_by,
      }
    );
    res.status(201).json({ id: result.insertId, incident_no: incidentNo, message: "Safety incident logged" });
  } catch (err) {
    next(err);
  }
};

export const listToolboxTalks = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    await ensureConstructionTables();
    const projectId = toNumber(req.query.project_id);
    let sql = `SELECT t.*, 
                      COALESCE(t.conductor_name, t.delivered_by) AS conductor_name,
                      COALESCE(t.delivered_by, t.conductor_name) AS delivered_by,
                      COALESCE(t.attendee_count, t.attendees_count, 0) AS attendee_count,
                      COALESCE(t.attendees_count, t.attendee_count, 0) AS attendees_count,
                      COALESCE(t.notes, t.summary_points) AS notes,
                      COALESCE(t.summary_points, t.notes) AS summary_points,
                      p.project_name, p.project_code 
               FROM pm_toolbox_talks t 
               JOIN pm_projects p ON p.id = t.project_id 
               WHERE t.company_id = :companyId`;
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.topic) throw httpError(400, "VALIDATION_ERROR", "Project and topic required");

    await ensureConstructionTables();

    const branch_id = branchId || 1;
    const conductor = b.conductor_name || b.delivered_by || req.user?.username || req.user?.name || "Safety Officer";
    const count = Number(b.attendee_count ?? b.attendees_count ?? 0);
    const notes = b.notes || b.summary_points || null;

    const result = await query(
      `INSERT INTO pm_toolbox_talks 
        (company_id, branch_id, project_id, talk_date, topic, delivered_by, conductor_name, 
         attendees_count, attendee_count, summary_points, notes)
       VALUES 
        (:companyId, :branch_id, :project_id, :talk_date, :topic, :delivered_by, :conductor_name, 
         :attendees_count, :attendee_count, :summary_points, :notes)`,
      {
        companyId,
        branch_id,
        project_id: toNumber(b.project_id),
        talk_date: b.talk_date || new Date().toISOString().split("T")[0],
        topic: b.topic,
        delivered_by: conductor,
        conductor_name: conductor,
        attendees_count: count,
        attendee_count: count,
        summary_points: notes,
        notes: notes,
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
    let sql = `SELECT d.*, 
                      COALESCE(d.document_number, d.doc_number) AS document_number,
                      COALESCE(d.discipline, d.doc_category) AS discipline,
                      p.project_name, p.project_code
               FROM pm_documents d 
               JOIN pm_projects p ON p.id = d.project_id 
               WHERE d.company_id = :companyId`;
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.document_number || !b.title) throw httpError(400, "VALIDATION_ERROR", "Project, document number, and title required");

    await ensureConstructionTables();

    const branch_id = branchId || 1;
    const attachmentsJson = b.attachments_json
      ? (typeof b.attachments_json === "string" ? b.attachments_json : JSON.stringify(b.attachments_json))
      : (Array.isArray(b.attachments) ? JSON.stringify(b.attachments) : null);
    const fileUrl = b.file_url || (Array.isArray(b.attachments) && b.attachments[0]?.url) || null;

    const result = await query(
      `INSERT INTO pm_documents 
        (company_id, branch_id, project_id, doc_number, document_number, title, discipline, doc_category, category, current_revision, status, file_url, attachments_json, uploaded_by)
       VALUES 
        (:companyId, :branch_id, :project_id, :document_number, :document_number, :title, :discipline, :category, :category, :current_revision, :status, :file_url, :attachments_json, :uploaded_by)`,
      {
        companyId,
        branch_id,
        project_id: toNumber(b.project_id),
        document_number: b.document_number,
        title: b.title,
        discipline: b.discipline || "ARCHITECTURAL",
        category: b.category || "DRAWING",
        current_revision: b.current_revision || "0",
        status: b.status || "APPROVED_FOR_CONSTRUCTION",
        file_url: fileUrl,
        attachments_json: attachmentsJson,
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
    let sql = `SELECT r.*, 
                      COALESCE(r.rfi_number, r.rfi_no) AS rfi_number,
                      COALESCE(r.drawing_reference, r.drawing_ref) AS drawing_reference,
                      COALESCE(r.cost_impact, r.has_cost_impact, 'N') AS cost_impact,
                      COALESCE(r.schedule_impact, r.has_schedule_impact, 'N') AS schedule_impact,
                      COALESCE(r.answer, r.response) AS answer,
                      p.project_name, p.project_code
               FROM pm_rfis r 
               JOIN pm_projects p ON p.id = r.project_id 
               WHERE r.company_id = :companyId`;
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.subject || !b.question) throw httpError(400, "VALIDATION_ERROR", "Project, subject, and question required");

    await ensureConstructionTables();

    const branch_id = branchId || 1;
    const rfiNo = b.rfi_number || b.rfi_no || `RFI-${Date.now().toString().slice(-6)}`;
    const drawingRef = b.drawing_reference || b.drawing_ref || null;
    const costImp = b.cost_impact || b.has_cost_impact || "N";
    const schedImp = b.schedule_impact || b.has_schedule_impact || "N";
    const attachmentsJson = b.attachments_json
      ? (typeof b.attachments_json === "string" ? b.attachments_json : JSON.stringify(b.attachments_json))
      : (Array.isArray(b.attachments) ? JSON.stringify(b.attachments) : null);
    const fileUrl = b.file_url || (Array.isArray(b.attachments) && b.attachments[0]?.url) || null;

    const result = await query(
      `INSERT INTO pm_rfis 
        (company_id, branch_id, project_id, rfi_no, rfi_number, subject, question, drawing_ref, drawing_reference, 
         file_url, attachments_json, date_issued, date_raised, due_date, has_cost_impact, cost_impact, 
         has_schedule_impact, schedule_impact, status, created_by, raised_by)
       VALUES 
        (:companyId, :branch_id, :project_id, :rfi_no, :rfi_number, :subject, :question, :drawing_ref, :drawing_reference,
         :file_url, :attachments_json, :date_raised, :date_raised, :due_date, :cost_impact, :cost_impact,
         :schedule_impact, :schedule_impact, :status, :created_by, :raised_by)`,
      {
        companyId,
        branch_id,
        project_id: toNumber(b.project_id),
        rfi_no: rfiNo,
        rfi_number: rfiNo,
        subject: b.subject,
        question: b.question,
        drawing_ref: drawingRef,
        drawing_reference: drawingRef,
        file_url: fileUrl,
        attachments_json: attachmentsJson,
        date_raised: b.date_raised || b.date_issued || new Date().toISOString().split("T")[0],
        due_date: b.due_date || null,
        cost_impact: costImp,
        schedule_impact: schedImp,
        status: "OPEN",
        created_by: req.user?.id || null,
        raised_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, rfi_number: rfiNo, message: "RFI raised successfully" });
  } catch (err) {
    next(err);
  }
};

export const updateRFI = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body || {};

    const ans = b.answer || b.response || null;
    const ansDate = ans ? new Date().toISOString().split("T")[0] : null;

    await query(
      `UPDATE pm_rfis SET 
        answer = :answer, 
        response = :answer,
        answered_by = :answered_by, 
        responded_by = :answered_by,
        answered_date = :answered_date,
        response_date = :answered_date,
        status = :status
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        answer: ans,
        answered_by: req.user?.id || null,
        answered_date: ansDate,
        status: b.status || (ans ? "CLOSED" : "OPEN"),
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
    let sql = `SELECT l.*,
                      COALESCE(l.operating_hours, l.hours_worked, 0) AS hours_worked,
                      COALESCE(l.idle_hours, l.hours_idle, 0) AS hours_idle,
                      COALESCE(l.breakdown_hours, l.hours_breakdown, 0) AS hours_breakdown,
                      COALESCE(l.fuel_litres, l.fuel_consumed_litres, 0) AS fuel_consumed_litres,
                      COALESCE(l.hourly_cost_rate, l.hourly_rate, 0) AS hourly_rate,
                      COALESCE(eq.name, l.equipment_name, 'Heavy Equipment') AS equipment_name,
                      p.project_name,
                      p.project_code
               FROM pm_equipment_logs l
               LEFT JOIN pm_projects p ON p.id = l.project_id
               LEFT JOIN pm_equipments eq ON eq.id = l.equipment_id
               WHERE (l.company_id = :companyId OR :companyId IS NULL)`;
    const params = { companyId: companyId || null };
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
    const { companyId, branchId } = req.scope || {};
    const b = req.body || {};
    if (!b.project_id || !b.equipment_id) throw httpError(400, "VALIDATION_ERROR", "Project and equipment required");

    await ensureConstructionTables();

    const projRows = await query(`SELECT id, company_id, branch_id FROM pm_projects WHERE id = :id LIMIT 1`, { id: toNumber(b.project_id) });
    const targetCompId = companyId || projRows[0]?.company_id || 1;
    const targetBranchId = branchId || projRows[0]?.branch_id || 1;

    let eqName = b.equipment_name;
    if (!eqName) {
      const eqRows = await query(`SELECT name FROM pm_equipments WHERE id = :id LIMIT 1`, { id: toNumber(b.equipment_id) });
      eqName = eqRows[0]?.name || "Heavy Equipment";
    }

    const hrsWorked = Number(b.hours_worked || b.operating_hours || 0);
    const hrsIdle = Number(b.hours_idle || b.idle_hours || 0);
    const hrsBreakdown = Number(b.hours_breakdown || b.breakdown_hours || 0);
    const fuelLitres = Number(b.fuel_consumed_litres || b.fuel_litres || 0);
    const hourlyRate = Number(b.hourly_rate || b.hourly_cost_rate || 0);
    const calculatedCost = hrsWorked * hourlyRate;

    const result = await query(
      `INSERT INTO pm_equipment_logs 
        (company_id, branch_id, project_id, equipment_id, equipment_name, log_date, start_hours, end_hours, operating_hours, hours_worked, idle_hours, hours_idle, breakdown_hours, hours_breakdown, fuel_litres, fuel_consumed_litres, hourly_cost_rate, hourly_rate, total_cost, operator_name, remarks, created_by, logged_by)
       VALUES 
        (:companyId, :branchId, :project_id, :equipment_id, :equipment_name, :log_date, 0.00, 0.00, :operating_hours, :hours_worked, :idle_hours, :hours_idle, :breakdown_hours, :hours_breakdown, :fuel_litres, :fuel_consumed_litres, :hourly_cost_rate, :hourly_rate, :total_cost, :operator_name, :remarks, :created_by, :logged_by)`,
      {
        companyId: targetCompId,
        branchId: targetBranchId,
        project_id: toNumber(b.project_id),
        equipment_id: toNumber(b.equipment_id),
        equipment_name: eqName,
        log_date: b.log_date || new Date().toISOString().split("T")[0],
        operating_hours: hrsWorked,
        hours_worked: hrsWorked,
        idle_hours: hrsIdle,
        hours_idle: hrsIdle,
        breakdown_hours: hrsBreakdown,
        hours_breakdown: hrsBreakdown,
        fuel_litres: fuelLitres,
        fuel_consumed_litres: fuelLitres,
        hourly_cost_rate: hourlyRate,
        hourly_rate: hourlyRate,
        total_cost: calculatedCost,
        operator_name: b.operator_name || null,
        remarks: b.remarks || null,
        created_by: req.user?.id || null,
        logged_by: req.user?.id || null,
      }
    );
    res.status(201).json({ id: result.insertId, total_cost: calculatedCost, message: "Equipment operating log recorded" });
  } catch (err) {
    next(err);
  }
};

export const deleteEquipmentLog = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM pm_equipment_logs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || null });
    res.json({ success: true, message: "Equipment operating log deleted" });
  } catch (err) {
    next(err);
  }
};

export const submitBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { workflow_id, target_user_id, comments } = req.body || {};

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    let targetUserName = null;
    if (target_user_id) {
      const uRows = await query(`SELECT username FROM adm_users WHERE id = :uid LIMIT 1`, { uid: target_user_id });
      if (uRows.length) targetUserName = uRows[0].username;
    }

    await query(
      `UPDATE pm_boqs SET 
         status = 'PENDING_APPROVAL', 
         forwarded_to_user_id = :target_user_id, 
         forwarded_to_username = :target_user_name,
         remarks = COALESCE(:comments, remarks)
       WHERE id = :id`,
      {
        target_user_id: target_user_id || null,
        target_user_name: targetUserName,
        comments: comments || null,
        id
      }
    );

    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks
        ) VALUES (
          :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, 'PENDING_APPROVAL', :remarks
        )`,
        {
          boq_id: id,
          version: boq.version || "1.0",
          prepared_by: boq.prepared_by_name || req.user?.username || "Estimator",
          reviewed_by: targetUserName || null,
          approved_by: null,
          subtotal: boq.subtotal,
          contingency_amount: boq.contingency_amount,
          tax_amount: boq.tax_amount,
          total_amount: boq.total_amount,
          remarks: comments || `Forwarded for approval to ${targetUserName || 'Approver'}`
        }
      );
    } catch (e) {}

    try {
      if (workflow_id) {
        await query(
          `INSERT INTO adm_document_workflows 
             (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
           VALUES 
             (:companyId, :workflow_id, :id, 'PROJECT_BOQ', :amount, 1, 'PENDING', :assignedTo)`,
          {
            companyId: companyId || 1,
            workflow_id,
            id,
            amount: boq.total_amount,
            assignedTo: target_user_id || null,
          }
        );
      }
    } catch (e) {}

    res.json({
      ok: true,
      status: "PENDING_APPROVAL",
      forwarded_to_username: targetUserName,
      message: "BOQ forwarded for approval"
    });
  } catch (err) {
    next(err);
  }
};

export const approveBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { comments, approved_by_name } = req.body || {};

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    const approver = approved_by_name || req.user?.username || req.user?.name || "Project Approver";

    await query(
      `UPDATE pm_boqs SET 
         status = 'APPROVED', 
         approved_by_name = :approver, 
         approved_date = CURRENT_DATE(), 
         approval_remarks = :comments 
       WHERE id = :id`,
      {
        approver,
        comments: comments || null,
        id
      }
    );

    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks
        ) VALUES (
          :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, 'APPROVED', :remarks
        )`,
        {
          boq_id: id,
          version: boq.version || "1.0",
          prepared_by: boq.prepared_by_name,
          reviewed_by: boq.reviewed_by_name,
          approved_by: approver,
          subtotal: boq.subtotal,
          contingency_amount: boq.contingency_amount,
          tax_amount: boq.tax_amount,
          total_amount: boq.total_amount,
          remarks: comments || "BOQ Approved"
        }
      );
    } catch (e) {}

    res.json({ ok: true, status: "APPROVED", message: "BOQ successfully approved" });
  } catch (err) {
    next(err);
  }
};

export const rejectBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { rejection_reason } = req.body || {};

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    await query(
      `UPDATE pm_boqs SET 
         status = 'REJECTED', 
         approval_remarks = :rejection_reason 
       WHERE id = :id`,
      {
        rejection_reason: rejection_reason || "Rejected by reviewer",
        id
      }
    );

    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks
        ) VALUES (
          :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, 'REJECTED', :remarks
        )`,
        {
          boq_id: id,
          version: boq.version || "1.0",
          prepared_by: boq.prepared_by_name,
          reviewed_by: boq.reviewed_by_name,
          approved_by: req.user?.username || "Reviewer",
          subtotal: boq.subtotal,
          contingency_amount: boq.contingency_amount,
          tax_amount: boq.tax_amount,
          total_amount: boq.total_amount,
          remarks: rejection_reason || "BOQ Rejected"
        }
      );
    } catch (e) {}

    res.json({ ok: true, status: "REJECTED", message: "BOQ rejected" });
  } catch (err) {
    next(err);
  }
};

export const reverseBOQ = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const { reason } = req.body || {};

    const boqRows = await query(`SELECT * FROM pm_boqs WHERE id = :id AND (company_id = :companyId OR :companyId IS NULL)`, { id, companyId: companyId || 1 });
    if (!boqRows.length) throw httpError(404, "NOT_FOUND", "BOQ not found");
    const boq = boqRows[0];

    await query(
      `UPDATE pm_boqs SET 
         status = 'DRAFT', 
         forwarded_to_user_id = NULL, 
         forwarded_to_username = NULL,
         approval_remarks = :reason 
       WHERE id = :id`,
      {
        reason: reason || "Approval reversed",
        id
      }
    );

    try {
      await query(
        `INSERT INTO pm_boq_revisions (
          boq_id, version, revision_date, prepared_by, reviewed_by, approved_by,
          subtotal, contingency_amount, tax_amount, total_amount, status, remarks
        ) VALUES (
          :boq_id, :version, CURRENT_DATE(), :prepared_by, :reviewed_by, :approved_by,
          :subtotal, :contingency_amount, :tax_amount, :total_amount, 'REVERSED', :remarks
        )`,
        {
          boq_id: id,
          version: boq.version || "1.0",
          prepared_by: boq.prepared_by_name,
          reviewed_by: null,
          approved_by: null,
          subtotal: boq.subtotal,
          contingency_amount: boq.contingency_amount,
          tax_amount: boq.tax_amount,
          total_amount: boq.total_amount,
          remarks: reason || "Approval reversed, returned to DRAFT"
        }
      );
    } catch (e) {}

    res.json({ ok: true, status: "DRAFT", message: "Approval reversed, BOQ returned to DRAFT" });
  } catch (err) {
    next(err);
  }
};
