import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ─────────────────────────────────────────────────────────────
// 1. FM TASKS & EXECUTION
// ─────────────────────────────────────────────────────────────

export async function getNextTaskNo(companyId, branchId) {
  const rows = await query(
    `SELECT task_no FROM fm_tasks
     WHERE company_id = :companyId
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].task_no) {
    const prev = String(rows[0].task_no);
    const n = parseInt(prev.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `FMT-${String(nextNum).padStart(6, "0")}`;
}

export async function listFMTasks(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { property_id, status, priority, search, assigned_to_id } = req.query;

    let where = "WHERE t.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(t.branch_id, :branchIdsStr)) AND COALESCE(t.is_active, 'Y') = 'Y'";
    const params = { companyId, branchId, branchIdsStr };

    if (property_id) {
      where += " AND t.property_id = :property_id";
      params.property_id = property_id;
    }
    if (status) {
      where += " AND t.status = :status";
      params.status = status;
    }
    if (priority) {
      where += " AND t.priority = :priority";
      params.priority = priority;
    }
    if (assigned_to_id) {
      where += " AND t.assigned_to_id = :assigned_to_id";
      params.assigned_to_id = assigned_to_id;
    }
    if (search && search.trim()) {
      where += " AND (t.task_no LIKE :search OR t.task_title LIKE :search OR t.assigned_to_name LIKE :search OR t.property_name LIKE :search)";
      params.search = `%${search.trim()}%`;
    }

    const rows = await query(
      `SELECT t.*, p.property_name AS linked_property_name, p.property_code
       FROM fm_tasks t
       LEFT JOIN fm_properties p ON p.id = t.property_id
       ${where}
       ORDER BY t.created_at DESC`,
      params
    );

    // Compute dynamic due status
    const today = new Date().toISOString().slice(0, 10);
    const items = rows.map((r) => {
      let computedDue = "ON_SCHEDULE";
      let dueLabel = "On Schedule";
      if (r.status === "COMPLETED") {
        computedDue = "COMPLETED";
        dueLabel = "Completed";
      } else if (r.end_date) {
        const ed = String(r.end_date).slice(0, 10);
        if (ed < today) {
          computedDue = "OVERDUE";
          dueLabel = "Overdue";
        } else if (ed === today) {
          computedDue = "DUE_TODAY";
          dueLabel = "Due Today";
        }
      }
      return {
        ...r,
        property_name: r.property_name || r.linked_property_name || "Facility Site",
        due_status: computedDue,
        due_label: dueLabel,
      };
    });

    res.json({ success: true, items, data: items });
  } catch (err) {
    next(err);
  }
}

export async function getFMTaskById(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid task id");

    const rows = await query(
      `SELECT t.*, p.property_name AS linked_property_name, p.property_code
       FROM fm_tasks t
       LEFT JOIN fm_properties p ON p.id = t.property_id
       WHERE t.id = :id AND t.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(t.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "FM Task not found");

    res.json({ success: true, data: rows[0], item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function createFMTask(req, res, next) {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const userId = req.user?.sub || null;

    const {
      property_id,
      property_name,
      building_zone,
      service_category,
      work_order_no,
      ticket_id,
      task_title,
      task_description,
      assigned_to_id,
      assigned_to_name,
      supervisor_name,
      priority = "MEDIUM",
      status = "PENDING",
      start_date,
      end_date,
      estimated_hours = 0,
      actual_hours = 0,
      completion_percent = 0,
      checklist_data,
    } = req.body;

    if (!task_title || !task_title.trim()) {
      throw httpError(400, "VALIDATION_ERROR", "Task title is required");
    }

    const task_no = await getNextTaskNo(companyId, branchId);

    const checklistJson = checklist_data
      ? typeof checklist_data === "string"
        ? checklist_data
        : JSON.stringify(checklist_data)
      : null;

    const result = await query(
      `INSERT INTO fm_tasks (
        company_id, branch_id, task_no, property_id, property_name, building_zone,
        service_category, work_order_no, ticket_id, task_title, task_description,
        assigned_to_id, assigned_to_name, supervisor_name, priority, status,
        start_date, end_date, estimated_hours, actual_hours, completion_percent,
        checklist_data, created_by
      ) VALUES (
        :companyId, :branchId, :task_no, :property_id, :property_name, :building_zone,
        :service_category, :work_order_no, :ticket_id, :task_title, :task_description,
        :assigned_to_id, :assigned_to_name, :supervisor_name, :priority, :status,
        :start_date, :end_date, :estimated_hours, :actual_hours, :completion_percent,
        :checklistJson, :userId
      )`,
      {
        companyId,
        branchId: branchId || 1,
        task_no,
        property_id: property_id || null,
        property_name: property_name || null,
        building_zone: building_zone || null,
        service_category: service_category || null,
        work_order_no: work_order_no || null,
        ticket_id: ticket_id || null,
        task_title: task_title.trim(),
        task_description: task_description || null,
        assigned_to_id: assigned_to_id || null,
        assigned_to_name: assigned_to_name || null,
        supervisor_name: supervisor_name || null,
        priority: priority || "MEDIUM",
        status: status || "PENDING",
        start_date: start_date || null,
        end_date: end_date || null,
        estimated_hours: estimated_hours || 0,
        actual_hours: actual_hours || 0,
        completion_percent: completion_percent || 0,
        checklistJson,
        userId,
      }
    );

    res.status(201).json({
      success: true,
      message: "Task created successfully",
      id: result.insertId,
      task_no,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateFMTask(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid task id");

    const {
      property_id,
      property_name,
      building_zone,
      service_category,
      work_order_no,
      task_title,
      task_description,
      assigned_to_id,
      assigned_to_name,
      supervisor_name,
      priority,
      status,
      start_date,
      end_date,
      estimated_hours,
      actual_hours,
      completion_percent,
      reason_for_delay,
      checklist_data,
    } = req.body;

    const checklistJson =
      checklist_data !== undefined
        ? typeof checklist_data === "string"
          ? checklist_data
          : JSON.stringify(checklist_data)
        : undefined;

    await query(
      `UPDATE fm_tasks SET
        property_id = COALESCE(:property_id, property_id),
        property_name = COALESCE(:property_name, property_name),
        building_zone = COALESCE(:building_zone, building_zone),
        service_category = COALESCE(:service_category, service_category),
        work_order_no = COALESCE(:work_order_no, work_order_no),
        task_title = COALESCE(:task_title, task_title),
        task_description = COALESCE(:task_description, task_description),
        assigned_to_id = COALESCE(:assigned_to_id, assigned_to_id),
        assigned_to_name = COALESCE(:assigned_to_name, assigned_to_name),
        supervisor_name = COALESCE(:supervisor_name, supervisor_name),
        priority = COALESCE(:priority, priority),
        status = COALESCE(:status, status),
        start_date = COALESCE(:start_date, start_date),
        end_date = COALESCE(:end_date, end_date),
        estimated_hours = COALESCE(:estimated_hours, estimated_hours),
        actual_hours = COALESCE(:actual_hours, actual_hours),
        completion_percent = COALESCE(:completion_percent, completion_percent),
        reason_for_delay = COALESCE(:reason_for_delay, reason_for_delay),
        checklist_data = COALESCE(:checklistJson, checklist_data)
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchIdsStr,
        property_id: property_id ?? null,
        property_name: property_name ?? null,
        building_zone: building_zone ?? null,
        service_category: service_category ?? null,
        work_order_no: work_order_no ?? null,
        task_title: task_title ?? null,
        task_description: task_description ?? null,
        assigned_to_id: assigned_to_id ?? null,
        assigned_to_name: assigned_to_name ?? null,
        supervisor_name: supervisor_name ?? null,
        priority: priority ?? null,
        status: status ?? null,
        start_date: start_date ?? null,
        end_date: end_date ?? null,
        estimated_hours: estimated_hours ?? null,
        actual_hours: actual_hours ?? null,
        completion_percent: completion_percent ?? null,
        reason_for_delay: reason_for_delay ?? null,
        checklistJson: checklistJson ?? null,
      }
    );

    res.json({ success: true, message: "Task updated successfully" });
  } catch (err) {
    next(err);
  }
}

export async function deleteFMTask(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid task id");

    await query(
      `UPDATE fm_tasks SET is_active = 'N' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr }
    );

    res.json({ success: true, message: "Task removed successfully" });
  } catch (err) {
    next(err);
  }
}

export async function reassignFMTask(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    const { assigned_to_id, assigned_to_name } = req.body;
    if (!id || !assigned_to_id) {
      throw httpError(400, "VALIDATION_ERROR", "Task id and new assignee are required");
    }

    await query(
      `UPDATE fm_tasks SET
        assigned_to_id = :assigned_to_id,
        assigned_to_name = :assigned_to_name
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr, assigned_to_id, assigned_to_name }
    );

    res.json({ success: true, message: `Task reassigned to ${assigned_to_name || "new personnel"}` });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 2. FM PURCHASE REQUISITIONS
// ─────────────────────────────────────────────────────────────

export async function getNextPurchaseReqNo(companyId, branchId) {
  const rows = await query(
    `SELECT requisition_no FROM fm_purchase_requisitions
     WHERE company_id = :companyId
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].requisition_no) {
    const prev = String(rows[0].requisition_no);
    const n = parseInt(prev.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `FMPR-${String(nextNum).padStart(6, "0")}`;
}

export async function listFMPurchaseRequisitions(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { status, from_date, to_date, property_id, search } = req.query;

    let where = "WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) AND COALESCE(r.is_active, 'Y') = 'Y'";
    const params = { companyId, branchId, branchIdsStr };

    if (status) {
      where += " AND r.status = :status";
      params.status = status;
    }
    if (property_id) {
      where += " AND r.property_id = :property_id";
      params.property_id = property_id;
    }
    if (from_date) {
      where += " AND r.requisition_date >= :from_date";
      params.from_date = from_date;
    }
    if (to_date) {
      where += " AND r.requisition_date <= :to_date";
      params.to_date = to_date;
    }
    if (search && search.trim()) {
      where += " AND (r.requisition_no LIKE :search OR r.property_name LIKE :search OR r.requested_by LIKE :search OR r.purpose LIKE :search)";
      params.search = `%${search.trim()}%`;
    }

    const rows = await query(
      `SELECT r.*,
              COALESCE(SUM(i.estimated_total), 0) AS total_estimated_cost,
              COUNT(i.id) AS item_count,
              u.username AS created_by_name
       FROM fm_purchase_requisitions r
       LEFT JOIN fm_purchase_requisition_items i ON i.requisition_id = r.id
       LEFT JOIN adm_users u ON u.id = r.created_by
       ${where}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );

    res.json({ success: true, items: rows, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getFMPurchaseRequisitionById(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    const rows = await query(
      `SELECT r.*, u.username AS created_by_name
       FROM fm_purchase_requisitions r
       LEFT JOIN adm_users u ON u.id = r.created_by
       WHERE r.id = :id AND r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Purchase requisition not found");

    const items = await query(
      `SELECT pi.*, inv.item_code, inv.item_name
       FROM fm_purchase_requisition_items pi
       LEFT JOIN inv_items inv ON inv.id = pi.item_id
       WHERE pi.requisition_id = :id
       ORDER BY pi.id ASC`,
      { id }
    );

    res.json({ success: true, ...rows[0], data: { ...rows[0], items }, items });
  } catch (err) {
    next(err);
  }
}

export async function createFMPurchaseRequisition(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null } = req.scope || {};
    const userId = req.user?.sub || null;

    const {
      requisition_date = new Date().toISOString().slice(0, 10),
      property_id,
      property_name,
      contract_id,
      task_id,
      work_order_ref,
      department = "Facilities Management",
      requested_by,
      purpose,
      priority = "MEDIUM",
      required_date,
      status = "DRAFT",
      remarks,
      timeline,
      items = [],
    } = req.body;

    const lineItems = Array.isArray(items) ? items.filter((i) => i.description || i.item_name) : [];
    if (!lineItems.length) {
      throw httpError(400, "VALIDATION_ERROR", "At least one requisition item is required");
    }

    const requisition_no = await getNextPurchaseReqNo(companyId, branchId);
    const finalStatus = status === "SUBMITTED" ? "PENDING_APPROVAL" : "DRAFT";

    const [hdrResult] = await conn.execute(
      `INSERT INTO fm_purchase_requisitions (
        company_id, branch_id, requisition_no, requisition_date,
        property_id, property_name, contract_id, task_id, work_order_ref,
        department, requested_by, purpose, priority, required_date,
        status, remarks, timeline, created_by
      ) VALUES (
        :companyId, :branchId, :requisition_no, :requisition_date,
        :property_id, :property_name, :contract_id, :task_id, :work_order_ref,
        :department, :requested_by, :purpose, :priority, :required_date,
        :finalStatus, :remarks, :timeline, :userId
      )`,
      {
        companyId,
        branchId: branchId || 1,
        requisition_no,
        requisition_date: requisition_date || new Date().toISOString().slice(0, 10),
        property_id: property_id || null,
        property_name: property_name || null,
        contract_id: contract_id || null,
        task_id: task_id || null,
        work_order_ref: work_order_ref || null,
        department: department || "Facilities Management",
        requested_by: requested_by || null,
        purpose: purpose || null,
        priority: priority || "MEDIUM",
        required_date: required_date || null,
        finalStatus,
        remarks: remarks || null,
        timeline: timeline || null,
        userId,
      }
    );

    const requisition_id = hdrResult.insertId;

    for (const item of lineItems) {
      const qty = parseFloat(item.qty || item.quantity || 1);
      const estimated_unit_cost = parseFloat(item.estimated_unit_cost || item.unit_price || 0);
      const estimated_total = parseFloat(item.estimated_total || qty * estimated_unit_cost);

      await conn.execute(
        `INSERT INTO fm_purchase_requisition_items (
          requisition_id, item_id, description, qty, uom, estimated_unit_cost, estimated_total, remarks
        ) VALUES (
          :requisition_id, :item_id, :description, :qty, :uom, :estimated_unit_cost, :estimated_total, :remarks
        )`,
        {
          requisition_id,
          item_id: item.item_id || null,
          description: item.description || item.item_name || "Facility Spare / Consumable",
          qty,
          uom: item.uom || "PCS",
          estimated_unit_cost,
          estimated_total,
          remarks: item.remarks || null,
        }
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Purchase requisition created successfully",
      id: requisition_id,
      requisition_no,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function updateFMPurchaseRequisition(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    const {
      requisition_date,
      property_id,
      property_name,
      contract_id,
      task_id,
      work_order_ref,
      department,
      requested_by,
      purpose,
      priority,
      required_date,
      status,
      remarks,
      timeline,
      items,
    } = req.body;

    await conn.execute(
      `UPDATE fm_purchase_requisitions SET
        requisition_date = COALESCE(:requisition_date, requisition_date),
        property_id = COALESCE(:property_id, property_id),
        property_name = COALESCE(:property_name, property_name),
        contract_id = COALESCE(:contract_id, contract_id),
        task_id = COALESCE(:task_id, task_id),
        work_order_ref = COALESCE(:work_order_ref, work_order_ref),
        department = COALESCE(:department, department),
        requested_by = COALESCE(:requested_by, requested_by),
        purpose = COALESCE(:purpose, purpose),
        priority = COALESCE(:priority, priority),
        required_date = COALESCE(:required_date, required_date),
        status = COALESCE(:status, status),
        remarks = COALESCE(:remarks, remarks),
        timeline = COALESCE(:timeline, timeline)
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchIdsStr,
        requisition_date: requisition_date ?? null,
        property_id: property_id ?? null,
        property_name: property_name ?? null,
        contract_id: contract_id ?? null,
        task_id: task_id ?? null,
        work_order_ref: work_order_ref ?? null,
        department: department ?? null,
        requested_by: requested_by ?? null,
        purpose: purpose ?? null,
        priority: priority ?? null,
        required_date: required_date ?? null,
        status: status ?? null,
        remarks: remarks ?? null,
        timeline: timeline ?? null,
      }
    );

    if (Array.isArray(items) && items.length > 0) {
      await conn.execute(`DELETE FROM fm_purchase_requisition_items WHERE requisition_id = :id`, { id });
      for (const item of items) {
        if (!item.description && !item.item_name) continue;
        const qty = parseFloat(item.qty || 1);
        const estimated_unit_cost = parseFloat(item.estimated_unit_cost || 0);
        const estimated_total = parseFloat(item.estimated_total || qty * estimated_unit_cost);

        await conn.execute(
          `INSERT INTO fm_purchase_requisition_items (
            requisition_id, item_id, description, qty, uom, estimated_unit_cost, estimated_total, remarks
          ) VALUES (
            :id, :item_id, :description, :qty, :uom, :estimated_unit_cost, :estimated_total, :remarks
          )`,
          {
            id,
            item_id: item.item_id || null,
            description: item.description || item.item_name || "Facility Item",
            qty,
            uom: item.uom || "PCS",
            estimated_unit_cost,
            estimated_total,
            remarks: item.remarks || null,
          }
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Purchase requisition updated successfully" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function submitFMPurchaseRequisition(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    await query(
      `UPDATE fm_purchase_requisitions SET status = 'PENDING_APPROVAL'
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr }
    );

    res.json({ success: true, message: "Requisition submitted for approval" });
  } catch (err) {
    next(err);
  }
}

export async function deleteFMPurchaseRequisition(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    await query(
      `UPDATE fm_purchase_requisitions SET is_active = 'N', status = 'CANCELLED'
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr }
    );

    res.json({ success: true, message: "Purchase requisition cancelled" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 3. FM MATERIAL REQUISITIONS
// ─────────────────────────────────────────────────────────────

export async function getNextMaterialReqNo(companyId, branchId) {
  const rows = await query(
    `SELECT requisition_no FROM fm_material_requisitions
     WHERE company_id = :companyId
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].requisition_no) {
    const prev = String(rows[0].requisition_no);
    const n = parseInt(prev.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `FMMR-${String(nextNum).padStart(6, "0")}`;
}

export async function listFMMaterialRequisitions(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { status, property_id, search } = req.query;

    let where = "WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) AND COALESCE(r.is_active, 'Y') = 'Y'";
    const params = { companyId, branchId, branchIdsStr };

    if (status) {
      where += " AND r.status = :status";
      params.status = status;
    }
    if (property_id) {
      where += " AND r.property_id = :property_id";
      params.property_id = property_id;
    }
    if (search && search.trim()) {
      where += " AND (r.requisition_no LIKE :search OR r.property_name LIKE :search OR r.requested_by LIKE :search)";
      params.search = `%${search.trim()}%`;
    }

    const rows = await query(
      `SELECT r.*,
              w.warehouse_name,
              d.name AS department_name,
              COUNT(i.id) AS item_count
       FROM fm_material_requisitions r
       LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
       LEFT JOIN adm_departments d ON d.id = r.department_id
       LEFT JOIN fm_material_requisition_items i ON i.requisition_id = r.id
       ${where}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );

    res.json({ success: true, items: rows, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getFMMaterialRequisitionById(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    const rows = await query(
      `SELECT r.*, w.warehouse_name, d.name AS department_name
       FROM fm_material_requisitions r
       LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
       LEFT JOIN adm_departments d ON d.id = r.department_id
       WHERE r.id = :id AND r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Material requisition not found");

    const items = await query(
      `SELECT mi.*, inv.item_code, inv.item_name
       FROM fm_material_requisition_items mi
       LEFT JOIN inv_items inv ON inv.id = mi.item_id
       WHERE mi.requisition_id = :id
       ORDER BY mi.id ASC`,
      { id }
    );

    res.json({ success: true, ...rows[0], data: { ...rows[0], items }, items });
  } catch (err) {
    next(err);
  }
}

export async function createFMMaterialRequisition(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null } = req.scope || {};
    const userId = req.user?.sub || null;

    const {
      requisitionDate,
      requisition_date = requisitionDate || new Date().toISOString().slice(0, 10),
      property_id,
      propertyId = property_id,
      property_name,
      task_id,
      taskId = task_id,
      task_name,
      warehouse_id,
      warehouseId = warehouse_id,
      department_id,
      departmentId = department_id,
      priority = "MEDIUM",
      requested_by,
      requestedBy = requested_by,
      remarks,
      status = "DRAFT",
      items = [],
    } = req.body;

    const lineItems = Array.isArray(items) ? items.filter((i) => i.item_id) : [];
    if (!lineItems.length) {
      throw httpError(400, "VALIDATION_ERROR", "At least one requisition item is required");
    }

    const requisition_no = await getNextMaterialReqNo(companyId, branchId);

    const [hdrResult] = await conn.execute(
      `INSERT INTO fm_material_requisitions (
        company_id, branch_id, requisition_no, requisition_date,
        property_id, property_name, task_id, task_name,
        warehouse_id, department_id, priority, requested_by, remarks,
        status, created_by
      ) VALUES (
        :companyId, :branchId, :requisition_no, :requisition_date,
        :propertyId, :property_name, :taskId, :task_name,
        :warehouseId, :departmentId, :priority, :requestedBy, :remarks,
        :status, :userId
      )`,
      {
        companyId,
        branchId: branchId || 1,
        requisition_no,
        requisition_date,
        propertyId: propertyId || null,
        property_name: property_name || null,
        taskId: taskId || null,
        task_name: task_name || null,
        warehouseId: warehouseId || null,
        departmentId: departmentId || null,
        priority: priority || "MEDIUM",
        requestedBy: requestedBy || null,
        remarks: remarks || null,
        status: status || "DRAFT",
        userId,
      }
    );

    const requisition_id = hdrResult.insertId;

    for (const item of lineItems) {
      await conn.execute(
        `INSERT INTO fm_material_requisition_items (
          requisition_id, item_id, qty_requested, qty_received, uom, batch_no
        ) VALUES (
          :requisition_id, :item_id, :qty_requested, :qty_received, :uom, :batch_no
        )`,
        {
          requisition_id,
          item_id: item.item_id,
          qty_requested: parseFloat(item.qty_requested || item.qtyRequested || 1),
          qty_received: parseFloat(item.qty_received || item.qtyReceived || 0),
          uom: item.uom || "PCS",
          batch_no: item.batch_no || item.batchNo || null,
        }
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Material requisition created successfully",
      id: requisition_id,
      requisition_no,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function updateFMMaterialRequisition(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    const {
      requisitionDate,
      requisition_date = requisitionDate,
      property_id,
      propertyId = property_id,
      property_name,
      task_id,
      taskId = task_id,
      warehouse_id,
      warehouseId = warehouse_id,
      department_id,
      departmentId = department_id,
      priority,
      requested_by,
      requestedBy = requested_by,
      remarks,
      status,
      items,
    } = req.body;

    await conn.execute(
      `UPDATE fm_material_requisitions SET
        requisition_date = COALESCE(:requisition_date, requisition_date),
        property_id = COALESCE(:propertyId, property_id),
        property_name = COALESCE(:property_name, property_name),
        task_id = COALESCE(:taskId, task_id),
        warehouse_id = COALESCE(:warehouseId, warehouse_id),
        department_id = COALESCE(:departmentId, department_id),
        priority = COALESCE(:priority, priority),
        requested_by = COALESCE(:requestedBy, requested_by),
        remarks = COALESCE(:remarks, remarks),
        status = COALESCE(:status, status)
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      {
        id,
        companyId,
        branchIdsStr,
        requisition_date: requisition_date ?? null,
        propertyId: propertyId ?? null,
        property_name: property_name ?? null,
        taskId: taskId ?? null,
        warehouseId: warehouseId ?? null,
        departmentId: departmentId ?? null,
        priority: priority ?? null,
        requestedBy: requestedBy ?? null,
        remarks: remarks ?? null,
        status: status ?? null,
      }
    );

    if (Array.isArray(items) && items.length > 0) {
      await conn.execute(`DELETE FROM fm_material_requisition_items WHERE requisition_id = :id`, { id });
      for (const item of items) {
        if (!item.item_id) continue;
        await conn.execute(
          `INSERT INTO fm_material_requisition_items (
            requisition_id, item_id, qty_requested, qty_received, uom, batch_no
          ) VALUES (
            :id, :item_id, :qty_requested, :qty_received, :uom, :batch_no
          )`,
          {
            id,
            item_id: item.item_id,
            qty_requested: parseFloat(item.qty_requested || item.qtyRequested || 1),
            qty_received: parseFloat(item.qty_received || item.qtyReceived || 0),
            uom: item.uom || "PCS",
            batch_no: item.batch_no || item.batchNo || null,
          }
        );
      }
    }

    await conn.commit();
    res.json({ success: true, message: "Material requisition updated successfully" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function submitFMMaterialRequisition(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid requisition id");

    await query(
      `UPDATE fm_material_requisitions SET status = 'PENDING_APPROVAL'
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr }
    );

    res.json({ success: true, message: "Material requisition confirmed and submitted" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 4. FM MATERIAL RECEIPTS
// ─────────────────────────────────────────────────────────────

export async function getNextMaterialReceiptNo(companyId, branchId) {
  const rows = await query(
    `SELECT receipt_no FROM fm_material_receipts
     WHERE company_id = :companyId
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].receipt_no) {
    const prev = String(rows[0].receipt_no);
    const n = parseInt(prev.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `FMRC-${String(nextNum).padStart(6, "0")}`;
}

export async function listFMMaterialReceipts(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { property_id, search } = req.query;

    let where = "WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))";
    const params = { companyId, branchId, branchIdsStr };

    if (property_id) {
      where += " AND r.property_id = :property_id";
      params.property_id = property_id;
    }
    if (search && search.trim()) {
      where += " AND (r.receipt_no LIKE :search OR r.property_name LIKE :search OR r.source_doc LIKE :search)";
      params.search = `%${search.trim()}%`;
    }

    const rows = await query(
      `SELECT r.*,
              w.warehouse_name,
              d.name AS department_name,
              COUNT(i.id) AS item_count
       FROM fm_material_receipts r
       LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
       LEFT JOIN adm_departments d ON d.id = r.department_id
       LEFT JOIN fm_material_receipt_items i ON i.receipt_id = r.id
       ${where}
       GROUP BY r.id
       ORDER BY r.created_at DESC`,
      params
    );

    res.json({ success: true, items: rows, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getFMMaterialReceiptById(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid receipt id");

    const rows = await query(
      `SELECT r.*, w.warehouse_name, d.name AS department_name
       FROM fm_material_receipts r
       LEFT JOIN inv_warehouses w ON w.id = r.warehouse_id
       LEFT JOIN adm_departments d ON d.id = r.department_id
       WHERE r.id = :id AND r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Material receipt not found");

    const items = await query(
      `SELECT ri.*, inv.item_code
       FROM fm_material_receipt_items ri
       LEFT JOIN inv_items inv ON inv.id = ri.item_id
       WHERE ri.receipt_id = :id
       ORDER BY ri.id ASC`,
      { id }
    );

    res.json({ success: true, ...rows[0], data: { ...rows[0], items }, items });
  } catch (err) {
    next(err);
  }
}

export async function createFMMaterialReceipt(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null } = req.scope || {};
    const userId = req.user?.sub || null;

    const {
      receipt_date = new Date().toISOString().slice(0, 10),
      property_id,
      property_name,
      issue_id,
      source_doc,
      warehouse_id,
      department_id,
      remarks,
      status = "RECEIVED",
      items = [],
    } = req.body;

    const lineItems = Array.isArray(items) ? items.filter((i) => i.item_id) : [];
    if (!lineItems.length) {
      throw httpError(400, "VALIDATION_ERROR", "At least one receipt item is required");
    }

    const receipt_no = await getNextMaterialReceiptNo(companyId, branchId);

    const [hdrResult] = await conn.execute(
      `INSERT INTO fm_material_receipts (
        company_id, branch_id, receipt_no, receipt_date, property_id, property_name,
        issue_id, source_doc, warehouse_id, department_id, remarks, status, created_by
      ) VALUES (
        :companyId, :branchId, :receipt_no, :receipt_date, :property_id, :property_name,
        :issue_id, :source_doc, :warehouse_id, :department_id, :remarks, :status, :userId
      )`,
      {
        companyId,
        branchId: branchId || 1,
        receipt_no,
        receipt_date,
        property_id: property_id || null,
        property_name: property_name || null,
        issue_id: issue_id || null,
        source_doc: source_doc || null,
        warehouse_id: warehouse_id || null,
        department_id: department_id || null,
        remarks: remarks || null,
        status: status || "RECEIVED",
        userId,
      }
    );

    const receipt_id = hdrResult.insertId;

    for (const item of lineItems) {
      await conn.execute(
        `INSERT INTO fm_material_receipt_items (
          receipt_id, item_id, item_name, uom, transfer_qty, receipt_qty, batch_no, expiry_date, mfg_date
        ) VALUES (
          :receipt_id, :item_id, :item_name, :uom, :transfer_qty, :receipt_qty, :batch_no, :expiry_date, :mfg_date
        )`,
        {
          receipt_id,
          item_id: item.item_id,
          item_name: item.item_name || item.name || "Received Item",
          uom: item.uom || "PCS",
          transfer_qty: parseFloat(item.transfer_qty || item.transferQty || item.qty || 0),
          receipt_qty: parseFloat(item.receipt_qty || item.receiptQty || item.qty || 0),
          batch_no: item.batch_no || item.batchNo || null,
          expiry_date: item.expiry_date || item.expiryDate || null,
          mfg_date: item.mfg_date || item.mfgDate || null,
        }
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Material receipt recorded successfully",
      id: receipt_id,
      receipt_no,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function getPendingIssueToRequirementFM(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};

    const rows = await query(
      `SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.department_id, i.issued_to, i.status, i.remarks,
              w.warehouse_name, d.name AS department_name
       FROM inv_issue_to_requirement i
       LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
       LEFT JOIN adm_departments d ON i.department_id = d.id
       WHERE i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr))
         AND i.status IN ('POSTED', 'ISSUED')
         AND i.id NOT IN (SELECT issue_id FROM fm_material_receipts WHERE issue_id IS NOT NULL)
       ORDER BY i.issue_date DESC`,
      { companyId, branchId, branchIdsStr }
    );

    res.json({ success: true, items: rows, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getIssueToRequirementDetailFM(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const issueId = toNumber(req.params.issueId);
    if (!issueId) throw httpError(400, "VALIDATION_ERROR", "Invalid issue id");

    const headers = await query(
      `SELECT i.id, i.issue_no, i.issue_date, i.warehouse_id, i.department_id, i.remarks,
              w.warehouse_name, d.name AS department_name
       FROM inv_issue_to_requirement i
       LEFT JOIN inv_warehouses w ON i.warehouse_id = w.id
       LEFT JOIN adm_departments d ON i.department_id = d.id
       WHERE i.id = :issueId AND i.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(i.branch_id, :branchIdsStr))
       LIMIT 1`,
      { issueId, companyId, branchIdsStr }
    );
    if (!headers.length) throw httpError(404, "NOT_FOUND", "Issue document not found");

    const items = await query(
      `SELECT ii.item_id, ii.qty AS transfer_qty, ii.uom, ii.batch_no, ii.expiry_date,
              inv.item_name, inv.item_code
       FROM inv_issue_to_requirement_items ii
       LEFT JOIN inv_items inv ON inv.id = ii.item_id
       WHERE ii.issue_id = :issueId`,
      { issueId }
    );

    res.json({ success: true, ...headers[0], items });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// 5. FM MATERIAL UTILIZATION
// ─────────────────────────────────────────────────────────────

export async function getNextMaterialUtilizationNo(companyId, branchId) {
  const rows = await query(
    `SELECT utilization_no FROM fm_material_utilization
     WHERE company_id = :companyId
     ORDER BY id DESC LIMIT 1`,
    { companyId }
  );
  let nextNum = 1;
  if (rows.length > 0 && rows[0].utilization_no) {
    const prev = String(rows[0].utilization_no);
    const n = parseInt(prev.replace(/[^0-9]/g, ""), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `FMUT-${String(nextNum).padStart(6, "0")}`;
}

export async function listFMMaterialUtilizations(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { property_id, status, search } = req.query;

    let where = "WHERE u.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(u.branch_id, :branchIdsStr))";
    const params = { companyId, branchId, branchIdsStr };

    if (property_id) {
      where += " AND u.property_id = :property_id";
      params.property_id = property_id;
    }
    if (status) {
      where += " AND u.status = :status";
      params.status = status;
    }
    if (search && search.trim()) {
      where += " AND (u.utilization_no LIKE :search OR u.property_name LIKE :search OR u.task_summary LIKE :search)";
      params.search = `%${search.trim()}%`;
    }

    const rows = await query(
      `SELECT u.*,
              w.warehouse_name,
              COUNT(i.id) AS item_count
       FROM fm_material_utilization u
       LEFT JOIN inv_warehouses w ON w.id = u.warehouse_id
       LEFT JOIN fm_material_utilization_items i ON i.utilization_id = u.id
       ${where}
       GROUP BY u.id
       ORDER BY u.created_at DESC`,
      params
    );

    res.json({ success: true, items: rows, data: rows });
  } catch (err) {
    next(err);
  }
}

export async function getFMMaterialUtilizationById(req, res, next) {
  try {
    const { companyId, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid utilization id");

    const rows = await query(
      `SELECT u.*, w.warehouse_name
       FROM fm_material_utilization u
       LEFT JOIN inv_warehouses w ON w.id = u.warehouse_id
       WHERE u.id = :id AND u.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(u.branch_id, :branchIdsStr))
       LIMIT 1`,
      { id, companyId, branchIdsStr }
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Material utilization not found");

    const items = await query(
      `SELECT ui.*, inv.item_code
       FROM fm_material_utilization_items ui
       LEFT JOIN inv_items inv ON inv.id = ui.item_id
       WHERE ui.utilization_id = :id
       ORDER BY ui.id ASC`,
      { id }
    );

    res.json({ success: true, ...rows[0], data: { ...rows[0], items }, items });
  } catch (err) {
    next(err);
  }
}

export async function createFMMaterialUtilization(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null } = req.scope || {};
    const userId = req.user?.sub || null;

    const {
      utilizationDate,
      utilization_date = utilizationDate || new Date().toISOString().slice(0, 10),
      property_id,
      propertyId = property_id,
      property_name,
      task_id,
      taskId = task_id,
      task_summary,
      taskSummary = task_summary,
      location,
      warehouse_id,
      warehouseId = warehouse_id,
      remarks,
      status = "DRAFT",
      items = [],
    } = req.body;

    const lineItems = Array.isArray(items) ? items.filter((i) => i.item_id) : [];
    if (!lineItems.length) {
      throw httpError(400, "VALIDATION_ERROR", "At least one utilization item is required");
    }

    const utilization_no = await getNextMaterialUtilizationNo(companyId, branchId);

    const [hdrResult] = await conn.execute(
      `INSERT INTO fm_material_utilization (
        company_id, branch_id, utilization_no, utilization_date,
        property_id, property_name, task_id, task_summary,
        location, warehouse_id, remarks, status, created_by
      ) VALUES (
        :companyId, :branchId, :utilization_no, :utilization_date,
        :propertyId, :property_name, :taskId, :taskSummary,
        :location, :warehouseId, :remarks, :status, :userId
      )`,
      {
        companyId,
        branchId: branchId || 1,
        utilization_no,
        utilization_date,
        propertyId: propertyId || null,
        property_name: property_name || null,
        taskId: taskId || null,
        taskSummary: taskSummary || null,
        location: location || null,
        warehouseId: warehouseId || null,
        remarks: remarks || null,
        status: status || "DRAFT",
        userId,
      }
    );

    const utilization_id = hdrResult.insertId;

    for (const item of lineItems) {
      await conn.execute(
        `INSERT INTO fm_material_utilization_items (
          utilization_id, item_id, item_name, uom, required_qty, qty_in_stock, cost_price
        ) VALUES (
          :utilization_id, :item_id, :item_name, :uom, :required_qty, :qty_in_stock, :cost_price
        )`,
        {
          utilization_id,
          item_id: item.item_id,
          item_name: item.item_name || item.name || "Used Material",
          uom: item.uom || "PCS",
          required_qty: parseFloat(item.required_qty || item.requiredQty || item.qty || 1),
          qty_in_stock: parseFloat(item.qty_in_stock || item.qtyInStock || 0),
          cost_price: parseFloat(item.cost_price || item.costPrice || 0),
        }
      );
    }

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Material utilization logged successfully",
      id: utilization_id,
      utilization_no,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function confirmFMMaterialUtilization(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid utilization id");

    const [hdr] = await conn.execute(
      `SELECT id, status, warehouse_id, utilization_no, property_name FROM fm_material_utilization
       WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
      { id, companyId, branchIdsStr }
    );
    if (!hdr?.length) throw httpError(404, "NOT_FOUND", "Material utilization record not found");

    const current = hdr[0];
    if (current.status !== "DRAFT") {
      throw httpError(400, "VALIDATION_ERROR", `Cannot confirm utilization with status ${current.status}`);
    }

    const warehouseId = toNumber(current.warehouse_id);
    const [items] = await conn.execute(
      `SELECT item_id, item_name, required_qty FROM fm_material_utilization_items WHERE utilization_id = :id`,
      { id }
    );

    const userId = req.user?.sub || null;

    // Deduct stock if warehouse is specified
    if (warehouseId) {
      for (const d of items) {
        const itemId = toNumber(d.item_id);
        const reqQty = Number(d.required_qty || 0);
        if (!itemId || reqQty <= 0) continue;

        const [rows] = await conn.execute(
          `SELECT id, qty FROM inv_stock_balances
           WHERE company_id = :companyId
             AND warehouse_id = :warehouseId AND item_id = :itemId
           LIMIT 1`,
          { companyId, warehouseId, itemId }
        );

        const currentQty = Number(rows?.[0]?.qty || 0);
        if (rows && rows.length > 0) {
          await conn.execute(
            `UPDATE inv_stock_balances SET qty = GREATEST(qty - :reqQty, 0) WHERE id = :id`,
            { reqQty, id: rows[0].id }
          );
        }

        try {
          await conn.execute(
            `INSERT INTO inv_stock_ledger (
              company_id, branch_id, warehouse_id, item_id, transaction_type,
              qty_change, source_ref, created_by
            ) VALUES (
              :companyId, :branchId, :warehouseId, :itemId, :transactionType,
              :qtyChange, :sourceRef, :createdBy
            )`,
            {
              companyId,
              branchId: branchId || 1,
              warehouseId,
              itemId,
              transactionType: "FACILITIES_MATERIAL_UTILIZATION",
              qtyChange: -reqQty,
              sourceRef: current.utilization_no,
              createdBy: userId,
            }
          );
        } catch {}
      }
    }

    await conn.execute(`UPDATE fm_material_utilization SET status = 'CONFIRMED' WHERE id = :id`, { id });

    await conn.commit();
    res.json({ success: true, message: "Utilization confirmed and inventory ledger updated" });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}
