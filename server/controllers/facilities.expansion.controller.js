/**
 * Facilities Management Expansion Controller
 * Covers: Property Onboarding, Hard Services, Helpdesk Tickets, Inspections/CAPA,
 * Security/Access, Workforce Rosters, Compliance Obligations, SLA Policies, Hazard Assessments
 */

import { pool, query } from "../db/pool.js";

// ─────────────────────────────────────────────
// PROPERTY ONBOARDING & HANDOVER
// ─────────────────────────────────────────────

export async function listPropertyOnboarding(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { stage, propertyId, search } = req.query;

    let where = "o.company_id = ?";
    const params = [companyId];

    if (stage) { where += " AND o.stage = ?"; params.push(stage); }
    if (propertyId) { where += " AND o.property_id = ?"; params.push(propertyId); }
    if (search) {
      where += " AND (o.onboarding_no LIKE ? OR p.property_name LIKE ? OR o.property_manager_name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT o.*, p.property_name, p.property_code, p.property_type,
             c.customer_name AS client_name
      FROM fm_property_onboarding o
      LEFT JOIN fm_properties p ON p.id = o.property_id
      LEFT JOIN sal_customers c ON c.id = o.client_id
      WHERE ${where}
      ORDER BY o.created_at DESC
      LIMIT 200
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function getPropertyOnboardingById(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;

    const [rows] = await pool.query(`
      SELECT o.*, p.property_name, p.property_code, p.property_type,
             c.customer_name AS client_name
      FROM fm_property_onboarding o
      LEFT JOIN fm_properties p ON p.id = o.property_id
      LEFT JOIN sal_customers c ON c.id = o.client_id
      WHERE o.id = ? AND o.company_id = ?
    `, [id, companyId]);

    if (!rows.length) return res.status(404).json({ error: "NOT_FOUND", message: "Onboarding record not found" });

    const [checklist] = await pool.query(
      "SELECT * FROM fm_onboarding_checklists WHERE onboarding_id = ? ORDER BY id ASC",
      [id]
    );

    res.json({ success: true, data: { ...rows[0], checklist } });
  } catch (err) { next(err); }
}

export async function createPropertyOnboarding(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const { property_id, client_id, target_handover_date, property_manager_name, condition_summary, checklist_items = [] } = req.body;

    if (!property_id) return res.status(400).json({ error: "VALIDATION", message: "Property is required" });

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_property_onboarding WHERE company_id = ?", [companyId]);
    const seq = String(countRow[0].cnt + 1).padStart(3, "0");
    const onboarding_no = `ONB-${new Date().getFullYear()}-${seq}`;

    const [result] = await pool.query(`
      INSERT INTO fm_property_onboarding
        (company_id, branch_id, onboarding_no, property_id, client_id, target_handover_date, property_manager_name, condition_summary, total_checklist_items)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, branchId || null, onboarding_no, property_id, client_id || null, target_handover_date || null,
        property_manager_name || null, condition_summary || null, checklist_items.length]);

    const obId = result.insertId;

    // Insert default checklist items if none provided
    const defaultItems = checklist_items.length ? checklist_items : [
      { category: "LEGAL_CONTRACTS", title: "Execute FM Service Agreement & Scope Matrix", is_mandatory: 1 },
      { category: "ASSET_INVENTORY", title: "Complete Equipment Register (Plant & Machinery)", is_mandatory: 1 },
      { category: "BUILDING_DRAWINGS", title: "Upload As-Built & MEP Drawings", is_mandatory: 1 },
      { category: "UTILITY_SETUP", title: "Electricity, Water & Gas Account Transfer", is_mandatory: 1 },
      { category: "EMERGENCY_HSE", title: "Fire Safety Audit & Evacuation Plan Sign-off", is_mandatory: 1 },
      { category: "ACCESS_KEYS", title: "Master Key Schedule & Access Badge Handover", is_mandatory: 1 },
      { category: "SERVICE_SCHEDULES", title: "PPM & Soft Services Schedules Loaded in System", is_mandatory: 1 },
    ];

    for (const item of defaultItems) {
      await pool.query(`
        INSERT INTO fm_onboarding_checklists (onboarding_id, category, title, description, is_mandatory, status, assigned_to)
        VALUES (?, ?, ?, ?, ?, 'PENDING', ?)
      `, [obId, item.category || "ASSET_INVENTORY", item.title, item.description || null,
          item.is_mandatory !== undefined ? item.is_mandatory : 1, item.assigned_to || null]);
    }

    res.status(201).json({ success: true, data: { id: obId, onboarding_no } });
  } catch (err) { next(err); }
}

export async function updatePropertyOnboarding(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const { stage, target_handover_date, actual_handover_date, property_manager_name,
            condition_summary, approval_notes, approved_by } = req.body;

    const updates = [];
    const vals = [];
    if (stage !== undefined) { updates.push("stage = ?"); vals.push(stage); }
    if (target_handover_date !== undefined) { updates.push("target_handover_date = ?"); vals.push(target_handover_date); }
    if (actual_handover_date !== undefined) { updates.push("actual_handover_date = ?"); vals.push(actual_handover_date); }
    if (property_manager_name !== undefined) { updates.push("property_manager_name = ?"); vals.push(property_manager_name); }
    if (condition_summary !== undefined) { updates.push("condition_summary = ?"); vals.push(condition_summary); }
    if (approval_notes !== undefined) { updates.push("approval_notes = ?"); vals.push(approval_notes); }
    if (approved_by !== undefined) {
      updates.push("approved_by = ?"); vals.push(approved_by);
      updates.push("approved_at = NOW()");
    }
    updates.push("updated_at = NOW()");
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_property_onboarding SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "Onboarding updated" });
  } catch (err) { next(err); }
}

export async function updateOnboardingChecklistItem(req, res, next) {
  try {
    const { id } = req.params;
    const { status, completed_by, notes } = req.body;

    await pool.query(`
      UPDATE fm_onboarding_checklists
      SET status = ?, completed_by = ?, notes = ?,
          completed_at = CASE WHEN ? = 'COMPLETED' THEN NOW() ELSE completed_at END
      WHERE id = ?
    `, [status, completed_by || null, notes || null, status, id]);

    // Recalculate onboarding progress
    const [item] = await pool.query("SELECT onboarding_id FROM fm_onboarding_checklists WHERE id = ?", [id]);
    if (item.length) {
      const obId = item[0].onboarding_id;
      const [counts] = await pool.query(`
        SELECT COUNT(*) AS total, SUM(status = 'COMPLETED') AS done
        FROM fm_onboarding_checklists WHERE onboarding_id = ?
      `, [obId]);
      await pool.query(
        "UPDATE fm_property_onboarding SET total_checklist_items = ?, completed_checklist_items = ? WHERE id = ?",
        [counts[0].total, counts[0].done || 0, obId]
      );
    }

    res.json({ success: true, message: "Checklist item updated" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// HARD SERVICES & BUILDING ENGINEERING SYSTEMS
// ─────────────────────────────────────────────

export async function listHardServices(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, category, status, search } = req.query;

    let where = "h.company_id = ?";
    const params = [companyId];

    if (propertyId) { where += " AND h.property_id = ?"; params.push(propertyId); }
    if (category) { where += " AND h.system_category = ?"; params.push(category); }
    if (status) { where += " AND h.operational_status = ?"; params.push(status); }
    if (search) {
      where += " AND (h.system_name LIKE ? OR h.system_code LIKE ? OR h.serial_no LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT h.*, p.property_name, p.property_code
      FROM fm_hard_services_systems h
      LEFT JOIN fm_properties p ON p.id = h.property_id
      WHERE ${where}
      ORDER BY h.next_service_due ASC, h.system_name ASC
      LIMIT 500
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createHardService(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      property_id, building_id, space_id, system_category, system_name,
      asset_id, contract_id, manufacturer, model_no, serial_no,
      installation_date, warranty_expiry, criticality, responsible_technician,
      service_interval_days, replacement_cost_estimate, notes
    } = req.body;

    if (!property_id || !system_name) {
      return res.status(400).json({ error: "VALIDATION", message: "Property and system name are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_hard_services_systems WHERE company_id = ?", [companyId]);
    const system_code = `SYS-${String(countRow[0].cnt + 1).padStart(4, "0")}`;

    const interval = parseInt(service_interval_days) || 90;
    const nextService = installation_date
      ? new Date(new Date(installation_date).getTime() + interval * 86400000).toISOString().slice(0, 10)
      : new Date(Date.now() + interval * 86400000).toISOString().slice(0, 10);

    const [result] = await pool.query(`
      INSERT INTO fm_hard_services_systems
        (company_id, branch_id, system_code, property_id, building_id, space_id, system_category, system_name,
         asset_id, contract_id, manufacturer, model_no, serial_no, installation_date, warranty_expiry,
         criticality, responsible_technician, service_interval_days, next_service_due, replacement_cost_estimate, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, branchId || null, system_code, property_id, building_id || null, space_id || null,
        system_category || "HVAC", system_name, asset_id || null, contract_id || null,
        manufacturer || null, model_no || null, serial_no || null,
        installation_date || null, warranty_expiry || null,
        criticality || "MEDIUM", responsible_technician || null,
        interval, nextService, replacement_cost_estimate || 0, notes || null]);

    res.status(201).json({ success: true, data: { id: result.insertId, system_code } });
  } catch (err) { next(err); }
}

export async function updateHardService(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const allowed = ["system_name", "system_category", "manufacturer", "model_no", "serial_no",
      "installation_date", "warranty_expiry", "criticality", "operational_status", "responsible_technician",
      "service_interval_days", "last_serviced_date", "next_service_due", "replacement_cost_estimate", "notes"];

    const updates = [];
    const vals = [];
    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        vals.push(req.body[field]);
      }
    }
    if (!updates.length) return res.status(400).json({ error: "VALIDATION", message: "No fields to update" });
    updates.push("updated_at = NOW()");
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_hard_services_systems SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "System updated" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// HELPDESK & SERVICE REQUESTS
// ─────────────────────────────────────────────

export async function listHelpdeskTickets(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { status, priority, propertyId, search, page = 1, limit = 50 } = req.query;

    let where = "t.company_id = ?";
    const params = [companyId];

    if (status && status !== "ALL") { where += " AND t.status = ?"; params.push(status); }
    if (priority) { where += " AND t.priority = ?"; params.push(priority); }
    if (propertyId) { where += " AND t.property_id = ?"; params.push(propertyId); }
    if (search) {
      where += " AND (t.ticket_no LIKE ? OR t.subject LIKE ? OR t.requester_name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM fm_helpdesk_tickets t WHERE ${where}`, params);

    const rows = await query(`
      SELECT t.*, p.property_name, c.customer_name AS client_name,
        CASE 
          WHEN t.status IN ('RESOLVED','CLOSED') THEN 'MET'
          WHEN t.sla_resolution_due IS NOT NULL AND t.sla_resolution_due < NOW() THEN 'BREACHED'
          WHEN t.sla_resolution_due IS NOT NULL AND TIMESTAMPDIFF(MINUTE, NOW(), t.sla_resolution_due) <= 60 THEN 'AT_RISK'
          ELSE 'ON_TRACK'
        END AS computed_sla_status
      FROM fm_helpdesk_tickets t
      LEFT JOIN fm_properties p ON p.id = t.property_id
      LEFT JOIN sal_customers c ON c.id = t.client_id
      WHERE ${where}
      ORDER BY FIELD(t.priority,'EMERGENCY','CRITICAL','HIGH','MEDIUM','LOW'), t.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    res.json({
      success: true,
      data: rows,
      pagination: { total: countRows[0].total, page: parseInt(page), limit: parseInt(limit) }
    });
  } catch (err) { next(err); }
}

export async function createHelpdeskTicket(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      property_id, client_id, building_id, space_id, asset_id, hard_service_id,
      service_category, subject, description, priority,
      requester_name, requester_email, requester_phone, preferred_access_time,
      source_channel, assigned_to_name, sla_target_hours
    } = req.body;

    if (!property_id || !subject || !requester_name) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, subject, and requester name are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_helpdesk_tickets WHERE company_id = ?", [companyId]);
    const seq = String(countRow[0].cnt + 1).padStart(6, "0");
    const ticket_no = `HT-${seq}`;

    const slaHours = parseFloat(sla_target_hours) || 24;
    const sla_resolution_due = new Date(Date.now() + slaHours * 3600000);

    const [result] = await pool.query(`
      INSERT INTO fm_helpdesk_tickets
        (company_id, branch_id, ticket_no, source_channel, client_id, property_id, building_id, space_id,
         asset_id, hard_service_id, service_category, subject, description, priority,
         requester_name, requester_email, requester_phone, preferred_access_time,
         assigned_to_name, sla_target_hours, sla_resolution_due, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'NEW')
    `, [companyId, branchId || null, ticket_no, source_channel || "WEB_PORTAL",
        client_id || null, property_id, building_id || null, space_id || null,
        asset_id || null, hard_service_id || null,
        service_category || "GENERAL_FACILITIES", subject, description || null,
        priority || "MEDIUM", requester_name, requester_email || null, requester_phone || null,
        preferred_access_time || null, assigned_to_name || null, slaHours,
        sla_resolution_due.toISOString().slice(0, 19).replace("T", " ")]);

    res.status(201).json({ success: true, data: { id: result.insertId, ticket_no } });
  } catch (err) { next(err); }
}

export async function updateHelpdeskTicket(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const allowed = ["status", "priority", "assigned_to_name", "assigned_to_user_id",
      "resolution_code", "root_cause", "resolution_notes", "client_satisfaction_rating",
      "client_feedback", "work_order_id", "sla_paused", "sla_pause_reason"];

    const updates = [];
    const vals = [];

    for (const field of allowed) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = ?`);
        vals.push(req.body[field]);
      }
    }

    const newStatus = req.body.status;
    if (newStatus === "RESOLVED") { updates.push("resolved_at = NOW()"); }
    if (newStatus === "CLOSED") { updates.push("closed_at = NOW()"); }

    updates.push("updated_at = NOW()");
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_helpdesk_tickets SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "Ticket updated" });
  } catch (err) { next(err); }
}

export async function addTicketNote(req, res, next) {
  try {
    const { id } = req.params;
    const { user_name, note_type, note_text } = req.body;

    if (!note_text) return res.status(400).json({ error: "VALIDATION", message: "Note text is required" });

    await pool.query(`
      INSERT INTO fm_ticket_notes (ticket_id, user_name, note_type, note_text)
      VALUES (?, ?, ?, ?)
    `, [id, user_name || "System", note_type || "INTERNAL", note_text]);

    res.status(201).json({ success: true, message: "Note added" });
  } catch (err) { next(err); }
}

export async function getTicketNotes(req, res, next) {
  try {
    const { id } = req.params;
    const rows = await query("SELECT * FROM fm_ticket_notes WHERE ticket_id = ? ORDER BY created_at ASC", [id]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function getHelpdeskDashboard(req, res, next) {
  try {
    const { companyId } = req.scope || {};

    const [summary] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'NEW') AS new_tickets,
        SUM(status NOT IN ('RESOLVED','CLOSED','REOPENED')) AS open_tickets,
        SUM(status IN ('RESOLVED','CLOSED')) AS closed_tickets,
        SUM(
          status NOT IN ('RESOLVED','CLOSED') AND
          sla_resolution_due IS NOT NULL AND
          sla_resolution_due < NOW()
        ) AS sla_breached,
        SUM(priority IN ('CRITICAL','EMERGENCY') AND status NOT IN ('RESOLVED','CLOSED')) AS critical_open
      FROM fm_helpdesk_tickets WHERE company_id = ?
    `, [companyId]);

    const recentTickets = await query(`
      SELECT t.*, p.property_name,
        CASE
          WHEN t.status IN ('RESOLVED','CLOSED') THEN 'MET'
          WHEN t.sla_resolution_due IS NOT NULL AND t.sla_resolution_due < NOW() THEN 'BREACHED'
          WHEN t.sla_resolution_due IS NOT NULL AND TIMESTAMPDIFF(MINUTE, NOW(), t.sla_resolution_due) <= 60 THEN 'AT_RISK'
          ELSE 'ON_TRACK'
        END AS computed_sla_status
      FROM fm_helpdesk_tickets t
      LEFT JOIN fm_properties p ON p.id = t.property_id
      WHERE t.company_id = ?
      ORDER BY FIELD(t.priority,'EMERGENCY','CRITICAL','HIGH','MEDIUM','LOW'), t.created_at DESC
      LIMIT 20
    `, [companyId]);

    res.json({ success: true, data: { summary: summary[0], recent_tickets: recentTickets } });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// INSPECTION RUNS & CORRECTIVE ACTIONS
// ─────────────────────────────────────────────

export async function listInspectionRuns(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, type, search } = req.query;

    let where = "r.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND r.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND r.status = ?"; params.push(status); }
    if (type) { where += " AND r.inspection_type = ?"; params.push(type); }
    if (search) {
      where += " AND (r.run_no LIKE ? OR r.template_name LIKE ? OR r.inspector_name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT r.*, p.property_name
      FROM fm_inspection_runs r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      WHERE ${where}
      ORDER BY r.scheduled_date DESC
      LIMIT 300
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createInspectionRun(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      template_id, template_name, property_id, building_id, space_id, asset_id,
      inspector_name, supervisor_name, inspection_type, scheduled_date, checklist_payload
    } = req.body;

    if (!property_id || !inspector_name || !scheduled_date) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, inspector, and date are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_inspection_runs WHERE company_id = ?", [companyId]);
    const run_no = `INS-${new Date().getFullYear()}-${String(countRow[0].cnt + 1).padStart(4, "0")}`;

    const [result] = await pool.query(`
      INSERT INTO fm_inspection_runs
        (company_id, branch_id, run_no, template_id, template_name, property_id, building_id, space_id, asset_id,
         inspector_name, supervisor_name, inspection_type, scheduled_date, status, checklist_payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', ?)
    `, [companyId, branchId || null, run_no, template_id || null, template_name || "Site Inspection",
        property_id, building_id || null, space_id || null, asset_id || null,
        inspector_name, supervisor_name || null, inspection_type || "ROUTINE_DAILY",
        scheduled_date, checklist_payload ? JSON.stringify(checklist_payload) : null]);

    res.status(201).json({ success: true, data: { id: result.insertId, run_no } });
  } catch (err) { next(err); }
}

export async function completeInspectionRun(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const { overall_score_pct, pass_fail_result, findings_summary, defects_count, checklist_payload } = req.body;

    const newStatus = (pass_fail_result === "FAIL" || parseInt(defects_count) > 0) ? "FLAGGED_DEFECTS" : "COMPLETED";

    await pool.query(`
      UPDATE fm_inspection_runs
      SET status = ?, executed_date = NOW(), overall_score_pct = ?,
          pass_fail_result = ?, findings_summary = ?, defects_count = ?,
          checklist_payload = COALESCE(?, checklist_payload)
      WHERE id = ? AND company_id = ?
    `, [newStatus, overall_score_pct || 100, pass_fail_result || "PASS",
        findings_summary || null, defects_count || 0,
        checklist_payload ? JSON.stringify(checklist_payload) : null, id, companyId]);

    res.json({ success: true, message: "Inspection completed" });
  } catch (err) { next(err); }
}

export async function listCorrectiveActions(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, inspectionId, search } = req.query;

    let where = "ca.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND ca.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND ca.status = ?"; params.push(status); }
    if (inspectionId) { where += " AND ca.inspection_run_id = ?"; params.push(inspectionId); }
    if (search) {
      where += " AND (ca.action_no LIKE ? OR ca.title LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s);
    }

    const rows = await query(`
      SELECT ca.*, p.property_name
      FROM fm_corrective_actions ca
      LEFT JOIN fm_properties p ON p.id = ca.property_id
      WHERE ${where}
      ORDER BY ca.deadline_date ASC
      LIMIT 300
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createCorrectiveAction(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { inspection_run_id, property_id, title, description, severity, assigned_to_name, deadline_date } = req.body;

    if (!property_id || !title || !assigned_to_name || !deadline_date) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, title, assignee, and deadline are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_corrective_actions WHERE company_id = ?", [companyId]);
    const action_no = `CA-${new Date().getFullYear()}-${String(countRow[0].cnt + 1).padStart(4, "0")}`;

    const [result] = await pool.query(`
      INSERT INTO fm_corrective_actions
        (company_id, action_no, inspection_run_id, property_id, title, description, severity, assigned_to_name, deadline_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, action_no, inspection_run_id || null, property_id, title, description || null,
        severity || "MINOR", assigned_to_name, deadline_date]);

    res.status(201).json({ success: true, data: { id: result.insertId, action_no } });
  } catch (err) { next(err); }
}

export async function updateCorrectiveAction(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const { status, corrective_action_taken, verification_notes, verified_by, work_order_id } = req.body;

    const updates = [];
    const vals = [];
    if (status !== undefined) { updates.push("status = ?"); vals.push(status); }
    if (corrective_action_taken !== undefined) { updates.push("corrective_action_taken = ?"); vals.push(corrective_action_taken); }
    if (verification_notes !== undefined) { updates.push("verification_notes = ?"); vals.push(verification_notes); }
    if (work_order_id !== undefined) { updates.push("work_order_id = ?"); vals.push(work_order_id); }
    if (verified_by) {
      updates.push("verified_by = ?", "verified_at = NOW()");
      vals.push(verified_by);
    }
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_corrective_actions SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "Corrective action updated" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// SECURITY & ACCESS MANAGEMENT
// ─────────────────────────────────────────────

export async function listVisitors(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, date, search } = req.query;

    let where = "v.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND v.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND v.status = ?"; params.push(status); }
    if (date) { where += " AND DATE(v.check_in_time) = ?"; params.push(date); }
    if (search) {
      where += " AND (v.full_name LIKE ? OR v.company_name LIKE ? OR v.visitor_no LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT v.*, p.property_name FROM fm_security_visitors v
      LEFT JOIN fm_properties p ON p.id = v.property_id
      WHERE ${where} ORDER BY v.check_in_time DESC LIMIT 200
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createVisitor(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      property_id, full_name, phone, email, company_name, id_card_type, id_card_number,
      visitor_badge_no, host_employee_name, host_department, visit_purpose, access_zone_permitted, notes
    } = req.body;

    if (!property_id || !full_name || !host_employee_name || !visit_purpose) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, visitor name, host, and purpose are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_security_visitors WHERE company_id = ?", [companyId]);
    const visitor_no = `VIS-${String(countRow[0].cnt + 1).padStart(5, "0")}`;

    const [result] = await pool.query(`
      INSERT INTO fm_security_visitors
        (company_id, branch_id, visitor_no, property_id, full_name, phone, email, company_name,
         id_card_type, id_card_number, visitor_badge_no, host_employee_name, host_department,
         visit_purpose, access_zone_permitted, check_in_time, status, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), 'CHECKED_IN', ?)
    `, [companyId, branchId || null, visitor_no, property_id, full_name, phone || null, email || null,
        company_name || null, id_card_type || "NATIONAL_ID", id_card_number || null, visitor_badge_no || null,
        host_employee_name, host_department || null, visit_purpose,
        access_zone_permitted || "LOBBY_AND_MEETING_ROOMS", notes || null]);

    res.status(201).json({ success: true, data: { id: result.insertId, visitor_no } });
  } catch (err) { next(err); }
}

export async function checkOutVisitor(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    await pool.query(
      "UPDATE fm_security_visitors SET status = 'CHECKED_OUT', check_out_time = NOW() WHERE id = ? AND company_id = ?",
      [id, companyId]
    );
    res.json({ success: true, message: "Visitor checked out" });
  } catch (err) { next(err); }
}

export async function listKeyRegister(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status } = req.query;

    let where = "k.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND k.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND k.status = ?"; params.push(status); }

    const rows = await query(`
      SELECT k.*, p.property_name FROM fm_security_key_register k
      LEFT JOIN fm_properties p ON p.id = k.property_id
      WHERE ${where} ORDER BY k.space_or_door_name ASC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createKeyRecord(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { property_id, key_or_card_code, space_or_door_name, key_type, notes } = req.body;

    if (!property_id || !key_or_card_code || !space_or_door_name) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, key/card code, and location are required" });
    }

    const [result] = await pool.query(`
      INSERT INTO fm_security_key_register (company_id, property_id, key_or_card_code, space_or_door_name, key_type, status, notes)
      VALUES (?, ?, ?, ?, ?, 'AVAILABLE', ?)
    `, [companyId, property_id, key_or_card_code, space_or_door_name, key_type || "PHYSICAL_KEY", notes || null]);

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) { next(err); }
}

export async function issueKey(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const { issued_to_name, issued_to_phone, expected_return_date } = req.body;

    await pool.query(`
      UPDATE fm_security_key_register
      SET status = 'ISSUED', issued_to_name = ?, issued_to_phone = ?,
          issued_date = NOW(), expected_return_date = ?
      WHERE id = ? AND company_id = ?
    `, [issued_to_name, issued_to_phone || null, expected_return_date || null, id, companyId]);

    res.json({ success: true, message: "Key issued" });
  } catch (err) { next(err); }
}

export async function returnKey(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    await pool.query(`
      UPDATE fm_security_key_register
      SET status = 'AVAILABLE', returned_date = NOW(), issued_to_name = NULL, issued_to_phone = NULL
      WHERE id = ? AND company_id = ?
    `, [id, companyId]);
    res.json({ success: true, message: "Key returned" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// WORKFORCE ROSTERS
// ─────────────────────────────────────────────

export async function listWorkforceRosters(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, search } = req.query;

    let where = "r.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND r.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND r.status = ?"; params.push(status); }
    if (search) {
      where += " AND (r.employee_name LIKE ? OR r.role_required LIKE ? OR r.shift_name LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT r.*, p.property_name FROM fm_workforce_rosters r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      WHERE ${where} ORDER BY r.start_date DESC LIMIT 500
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createWorkforceRoster(req, res, next) {
  try {
    const { companyId, branchId } = req.scope || {};
    const {
      property_id, contract_id, shift_id, shift_name, role_required,
      employee_id, employee_name, start_date, end_date, days_of_week,
      hours_per_shift, hourly_rate
    } = req.body;

    if (!property_id || !employee_name || !start_date || !end_date) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, employee, start and end date are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_workforce_rosters WHERE company_id = ?", [companyId]);
    const roster_no = `RST-${new Date().getFullYear()}-${String(countRow[0].cnt + 1).padStart(4, "0")}`;

    const [result] = await pool.query(`
      INSERT INTO fm_workforce_rosters
        (company_id, branch_id, roster_no, property_id, contract_id, shift_id, shift_name, role_required,
         employee_id, employee_name, start_date, end_date, days_of_week, hours_per_shift, hourly_rate, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED')
    `, [companyId, branchId || null, roster_no, property_id, contract_id || null,
        shift_id || null, shift_name || "Day Shift", role_required || "Facilities Staff",
        employee_id || null, employee_name, start_date, end_date,
        days_of_week || "MON,TUE,WED,THU,FRI",
        parseFloat(hours_per_shift) || 8.00, parseFloat(hourly_rate) || 25.00]);

    res.status(201).json({ success: true, data: { id: result.insertId, roster_no } });
  } catch (err) { next(err); }
}

export async function updateWorkforceRoster(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const { status, attendance_status, overtime_hours } = req.body;

    const updates = [];
    const vals = [];
    if (status !== undefined) { updates.push("status = ?"); vals.push(status); }
    if (attendance_status !== undefined) { updates.push("attendance_status = ?"); vals.push(attendance_status); }
    if (overtime_hours !== undefined) { updates.push("overtime_hours = ?"); vals.push(overtime_hours); }
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_workforce_rosters SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "Roster updated" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// COMPLIANCE OBLIGATIONS
// ─────────────────────────────────────────────

export async function listComplianceObligations(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status, category, search } = req.query;

    let where = "o.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND o.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND o.status = ?"; params.push(status); }
    if (category) { where += " AND o.category = ?"; params.push(category); }
    if (search) {
      where += " AND (o.title LIKE ? OR o.obligation_code LIKE ? OR o.issuing_authority LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s);
    }

    const rows = await query(`
      SELECT o.*, p.property_name FROM fm_compliance_obligations o
      LEFT JOIN fm_properties p ON p.id = o.property_id
      WHERE ${where} ORDER BY o.expiry_date ASC LIMIT 300
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createComplianceObligation(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const {
      property_id, asset_id, contractor_id, title, category, issuing_authority,
      document_ref, document_url, document_name, attachments_json, file_url, attachments,
      issue_date, expiry_date, renewal_lead_days, responsible_person, notes
    } = req.body;

    if (!property_id || !title || !issuing_authority || !expiry_date) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, title, issuing authority, and expiry date are required" });
    }

    const [countRow] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_compliance_obligations WHERE company_id = ?", [companyId]);
    const obligation_code = `COM-${String(countRow[0].cnt + 1).padStart(4, "0")}`;

    // Auto-compute status
    const expiry = new Date(expiry_date);
    const now = new Date();
    const leadDays = parseInt(renewal_lead_days) || 30;
    const alertDate = new Date(expiry.getTime() - leadDays * 86400000);
    let status = "VALID";
    if (now > expiry) status = "EXPIRED";
    else if (now >= alertDate) status = "EXPIRING_SOON";

    const docUrl = document_url || file_url || (Array.isArray(attachments) && attachments[0]?.url) || null;
    const docName = document_name || (Array.isArray(attachments) && attachments[0]?.filename) || (docUrl ? docUrl.split("/").pop() : null);
    const attJson = attachments_json || (Array.isArray(attachments) ? JSON.stringify(attachments) : null);

    const [result] = await pool.query(`
      INSERT INTO fm_compliance_obligations
        (company_id, obligation_code, property_id, asset_id, contractor_id, title, category,
         issuing_authority, document_ref, document_url, document_name, attachments_json,
         issue_date, expiry_date, renewal_lead_days, status, responsible_person, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, obligation_code, property_id, asset_id || null, contractor_id || null,
        title, category || "STATUTORY", issuing_authority, document_ref || null,
        docUrl, docName, attJson,
        issue_date || null, expiry_date, leadDays, status, responsible_person || null, notes || null]);

    res.status(201).json({ success: true, data: { id: result.insertId, obligation_code, status } });
  } catch (err) { next(err); }
}

export async function updateComplianceObligation(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const {
      status, expiry_date, document_ref, document_url, document_name,
      attachments_json, file_url, attachments, notes
    } = req.body;

    const updates = [];
    const vals = [];
    if (status !== undefined) { updates.push("status = ?"); vals.push(status); }
    if (expiry_date !== undefined) { updates.push("expiry_date = ?"); vals.push(expiry_date); }
    if (document_ref !== undefined) { updates.push("document_ref = ?"); vals.push(document_ref); }
    if (document_url !== undefined || file_url !== undefined) {
      const docUrl = document_url !== undefined ? document_url : file_url;
      updates.push("document_url = ?");
      vals.push(docUrl || null);
    }
    if (document_name !== undefined) {
      updates.push("document_name = ?");
      vals.push(document_name || null);
    }
    if (attachments_json !== undefined || attachments !== undefined) {
      const attJson = attachments_json !== undefined ? attachments_json : (Array.isArray(attachments) ? JSON.stringify(attachments) : null);
      updates.push("attachments_json = ?");
      vals.push(attJson || null);
    }
    if (notes !== undefined) { updates.push("notes = ?"); vals.push(notes); }
    vals.push(id, companyId);

    if (updates.length > 0) {
      await pool.query(`UPDATE fm_compliance_obligations SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    }
    res.json({ success: true, message: "Compliance record updated" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// SLA POLICIES MANAGEMENT
// ─────────────────────────────────────────────

export async function listSLAPolicies(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const rows = await query(`
      SELECT s.*, c.customer_name AS client_name
      FROM fm_sla_policies s
      LEFT JOIN sal_customers c ON c.id = s.client_id
      WHERE s.company_id = ?
      ORDER BY FIELD(s.priority,'EMERGENCY','CRITICAL','HIGH','MEDIUM','LOW')
    `, [companyId]);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createSLAPolicy(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const {
      policy_name, client_id, contract_id, service_category, priority,
      ack_target_minutes, response_time_minutes, attendance_target_hours,
      resolution_time_hours, operating_hours
    } = req.body;

    if (!policy_name || !priority) {
      return res.status(400).json({ error: "VALIDATION", message: "Policy name and priority are required" });
    }

    const [result] = await pool.query(`
      INSERT INTO fm_sla_policies
        (company_id, policy_name, client_id, contract_id, service_category, priority,
         ack_target_minutes, response_time_minutes, attendance_target_hours, resolution_time_hours, operating_hours, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [companyId, policy_name, client_id || null, contract_id || null,
        service_category || "GENERAL_FACILITIES", priority,
        ack_target_minutes || 15, response_time_minutes || 120,
        attendance_target_hours || 4, resolution_time_hours || 24,
        operating_hours || "08:00-18:00"]);

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) { next(err); }
}

export async function updateSLAPolicy(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    const allowed = ["policy_name", "service_category", "priority", "ack_target_minutes",
      "response_time_minutes", "attendance_target_hours", "resolution_time_hours", "operating_hours", "is_active"];

    const updates = [];
    const vals = [];
    for (const f of allowed) {
      if (req.body[f] !== undefined) { updates.push(`${f} = ?`); vals.push(req.body[f]); }
    }
    vals.push(id, companyId);

    await pool.query(`UPDATE fm_sla_policies SET ${updates.join(", ")} WHERE id = ? AND company_id = ?`, vals);
    res.json({ success: true, message: "SLA policy updated" });
  } catch (err) { next(err); }
}

export async function deleteSLAPolicy(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { id } = req.params;
    await pool.query("DELETE FROM fm_sla_policies WHERE id = ? AND company_id = ?", [id, companyId]);
    res.json({ success: true, message: "Policy deleted" });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// HAZARD ASSESSMENTS
// ─────────────────────────────────────────────

export async function listHazardAssessments(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, status } = req.query;

    let where = "h.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND h.property_id = ?"; params.push(propertyId); }
    if (status) { where += " AND h.status = ?"; params.push(status); }

    const rows = await query(`
      SELECT h.*, p.property_name FROM fm_hazard_assessments h
      LEFT JOIN fm_properties p ON p.id = h.property_id
      WHERE ${where} ORDER BY FIELD(h.risk_rating,'CRITICAL','HIGH','MEDIUM','LOW'), h.created_at DESC
    `, params);

    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
}

export async function createHazardAssessment(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const {
      property_id, hazard_title, work_activity, likelihood_score, severity_score,
      existing_controls, additional_mitigations, action_owner, review_date
    } = req.body;

    if (!property_id || !hazard_title || !work_activity) {
      return res.status(400).json({ error: "VALIDATION", message: "Property, hazard, and work activity are required" });
    }

    const likelihood = parseInt(likelihood_score) || 2;
    const severity = parseInt(severity_score) || 3;
    const riskScore = likelihood * severity;
    let risk_rating = "LOW";
    if (riskScore >= 12) risk_rating = "CRITICAL";
    else if (riskScore >= 8) risk_rating = "HIGH";
    else if (riskScore >= 4) risk_rating = "MEDIUM";

    const [result] = await pool.query(`
      INSERT INTO fm_hazard_assessments
        (company_id, property_id, hazard_title, work_activity, likelihood_score, severity_score, risk_rating,
         existing_controls, additional_mitigations, action_owner, review_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [companyId, property_id, hazard_title, work_activity, likelihood, severity, risk_rating,
        existing_controls || null, additional_mitigations || null,
        action_owner || null, review_date || null]);

    res.status(201).json({ success: true, data: { id: result.insertId, risk_rating } });
  } catch (err) { next(err); }
}

// ─────────────────────────────────────────────
// MANAGEMENT REPORTS & ANALYTICS
// ─────────────────────────────────────────────

export async function getFMOperationsDashboard(req, res, next) {
  try {
    const { companyId } = req.scope || {};

    const [properties] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_properties WHERE (company_id = ? OR company_id IS NULL)", [companyId]);
    const [contracts] = await pool.query("SELECT COUNT(*) AS cnt FROM fm_service_contracts WHERE (company_id = ? OR company_id IS NULL) AND (contract_status = 'ACTIVE' OR contract_status IS NULL)", [companyId]);
    const [tickets] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status NOT IN ('RESOLVED','CLOSED')) AS open_tickets,
        SUM(status IN ('RESOLVED','CLOSED')) AS closed_tickets,
        SUM(priority IN ('CRITICAL','EMERGENCY') AND status NOT IN ('RESOLVED','CLOSED')) AS critical_open,
        SUM(sla_resolution_due IS NOT NULL AND sla_resolution_due < NOW() AND status NOT IN ('RESOLVED','CLOSED')) AS sla_breached
      FROM fm_helpdesk_tickets WHERE company_id = ?
    `, [companyId]);
    const [hardServices] = await pool.query(`
      SELECT COUNT(*) AS total, SUM(operational_status = 'OFFLINE') AS offline,
             SUM(operational_status = 'DEGRADED') AS degraded,
             SUM(next_service_due IS NOT NULL AND next_service_due <= CURRENT_DATE) AS overdue
      FROM fm_hard_services_systems WHERE company_id = ?
    `, [companyId]);
    const [compliance] = await pool.query(`
      SELECT COUNT(*) AS total, SUM(status = 'EXPIRED') AS expired, SUM(status = 'EXPIRING_SOON') AS expiring_soon
      FROM fm_compliance_obligations WHERE company_id = ?
    `, [companyId]);
    const [inspections] = await pool.query(`
      SELECT COUNT(*) AS total, SUM(status = 'FLAGGED_DEFECTS') AS with_defects,
             SUM(status = 'SCHEDULED' AND scheduled_date < CURRENT_DATE) AS overdue
      FROM fm_inspection_runs WHERE company_id = ?
    `, [companyId]);
    const [visitors] = await pool.query(`
      SELECT COUNT(*) AS checked_in_today
      FROM fm_security_visitors
      WHERE company_id = ? AND DATE(check_in_time) = CURRENT_DATE AND status = 'CHECKED_IN'
    `, [companyId]);
    const [softTasks] = await pool.query(`
      SELECT COUNT(*) AS total_today,
             SUM(status = 'COMPLETED') AS completed_today,
             SUM(status = 'PENDING') AS pending_today,
             SUM(scheduled_date < CURRENT_DATE AND status NOT IN ('COMPLETED','VERIFIED','CANCELLED')) AS overdue
      FROM fm_soft_tasks WHERE company_id = ? AND scheduled_date = CURRENT_DATE
    `, [companyId]);

    res.json({
      success: true,
      data: {
        properties: properties[0].cnt,
        active_contracts: contracts[0].cnt,
        tickets: tickets[0],
        hard_services: hardServices[0],
        compliance: compliance[0],
        inspections: inspections[0],
        visitors_today: visitors[0].checked_in_today,
        soft_tasks_today: softTasks[0]
      }
    });
  } catch (err) { next(err); }
}

export async function getFMComplianceReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId } = req.query;

    let where = "o.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND o.property_id = ?"; params.push(propertyId); }

    const obligations = await query(`
      SELECT o.*, p.property_name FROM fm_compliance_obligations o
      LEFT JOIN fm_properties p ON p.id = o.property_id
      WHERE ${where} ORDER BY o.expiry_date ASC
    `, params);

    const [summary] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'VALID') AS valid,
        SUM(status = 'EXPIRING_SOON') AS expiring_soon,
        SUM(status = 'EXPIRED') AS expired,
        SUM(status = 'UNDER_RENEWAL') AS under_renewal
      FROM fm_compliance_obligations o WHERE ${where}
    `, params);

    const hazards = await query(`
      SELECT h.*, p.property_name FROM fm_hazard_assessments h
      LEFT JOIN fm_properties p ON p.id = h.property_id
      WHERE h.company_id = ? AND h.status = 'ACTIVE'
      ORDER BY FIELD(h.risk_rating,'CRITICAL','HIGH','MEDIUM','LOW')
    `, [companyId]);

    res.json({ success: true, data: { obligations, summary: summary[0], hazards } });
  } catch (err) { next(err); }
}

export async function getFMWorkforceReport(req, res, next) {
  try {
    const { companyId } = req.scope || {};
    const { propertyId, startDate, endDate } = req.query;

    let where = "r.company_id = ?";
    const params = [companyId];
    if (propertyId) { where += " AND r.property_id = ?"; params.push(propertyId); }
    if (startDate) { where += " AND r.start_date >= ?"; params.push(startDate); }
    if (endDate) { where += " AND r.end_date <= ?"; params.push(endDate); }

    const rosters = await query(`
      SELECT r.*, p.property_name FROM fm_workforce_rosters r
      LEFT JOIN fm_properties p ON p.id = r.property_id
      WHERE ${where} ORDER BY r.start_date DESC LIMIT 300
    `, params);

    const [summary] = await pool.query(`
      SELECT COUNT(*) AS total, SUM(status = 'ACTIVE') AS active,
             SUM(attendance_status = 'ABSENT') AS absent, SUM(attendance_status = 'LATE') AS late,
             SUM(overtime_hours) AS total_overtime_hours,
             SUM(hours_per_shift * hourly_rate) AS total_labor_cost
      FROM fm_workforce_rosters r WHERE ${where}
    `, params);

    res.json({ success: true, data: { rosters, summary: summary[0] } });
  } catch (err) { next(err); }
}
