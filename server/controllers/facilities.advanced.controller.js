/**
 * @fileoverview Facilities Advanced Controller
 * Handles Soft Tasks, HSA Compliance, Utilities, Vendors, Budgets, Space, and Sustainability.
 */

import { query } from "../db/pool.js";

// Helper for tenant & scope isolation
const getScope = (req) => {
  const companyId = req.scope?.companyId || 1;
  const branchId = req.scope?.branchId || null;
  return { companyId, branchId };
};

// ==========================================
// 1. SOFT FACILITIES DAILY TASKS & OPERATIONS
// ==========================================
export async function listSoftTasks(req, res) {
  try {
    const { companyId } = getScope(req);
    const { property_id, date, status, category } = req.query;

    let sql = `
      SELECT t.*, p.property_name, p.property_code
      FROM fm_soft_tasks t
      LEFT JOIN fm_properties p ON p.id = t.property_id
      WHERE t.company_id = ?
    `;
    const params = [companyId];

    if (property_id) {
      sql += " AND t.property_id = ?";
      params.push(property_id);
    }
    if (date) {
      sql += " AND t.scheduled_date = ?";
      params.push(date);
    }
    if (status && status !== "ALL") {
      sql += " AND t.status = ?";
      params.push(status);
    }
    if (category && category !== "ALL") {
      sql += " AND t.task_category = ?";
      params.push(category);
    }

    sql += " ORDER BY t.scheduled_date DESC, t.id DESC LIMIT 300";
    const items = await query(sql, params);
    res.json({ success: true, data: items });
  } catch (err) {
    console.error("listSoftTasks error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSoftTask(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const b = req.body;

    const dates = Array.isArray(b.scheduled_dates) && b.scheduled_dates.length > 0
      ? b.scheduled_dates
      : [b.scheduled_date || new Date().toISOString().slice(0, 10)];

    const createdIds = [];
    const createdTaskNos = [];

    for (let i = 0; i < dates.length; i++) {
      const scheduledDate = dates[i];
      const task_no = `ST-${Date.now().toString().slice(-6)}${i > 0 ? `-${i + 1}` : ""}`;
      const result = await query(
        `INSERT INTO fm_soft_tasks (
          company_id, branch_id, task_no, property_id, building_id, zone_id, space_id,
          task_category, title, description, assignment_type, scheduled_date, shift,
          assigned_to_user_id, assigned_to_name, supervisor_id, supervisor_name,
          checklist_template_id, priority, status, checklist_data
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          branchId,
          task_no,
          b.property_id || 1,
          b.building_id || null,
          b.zone_id || null,
          b.space_id || null,
          b.task_category || "JANITORIAL",
          b.title || "Daily Operational Task",
          b.description || "",
          b.assignment_type || (dates.length > 1 ? "SCHEDULED_DAILY" : "MANUAL"),
          scheduledDate,
          b.shift || "MORNING",
          b.assigned_to_user_id || null,
          b.assigned_to_name || "Unassigned",
          b.supervisor_id || null,
          b.supervisor_name || req.user?.username || "Supervisor",
          b.checklist_template_id || null,
          b.priority || "MEDIUM",
          b.status || "ASSIGNED",
          typeof b.checklist_data === "object" ? JSON.stringify(b.checklist_data) : b.checklist_data || null,
        ]
      );
      createdIds.push(result.insertId);
      createdTaskNos.push(task_no);
    }

    res.status(201).json({
      success: true,
      message: dates.length > 1
        ? `Successfully assigned ${dates.length} tasks across scheduled dates`
        : "Daily soft facilities task assigned successfully",
      taskId: createdIds[0],
      taskIds: createdIds,
      task_nos: createdTaskNos,
      task_no: createdTaskNos[0],
    });
  } catch (err) {
    console.error("createSoftTask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function executeSoftTask(req, res) {
  try {
    const id = req.params.id;
    const { checklist_data, completion_notes, completion_photos } = req.body;

    await query(
      `UPDATE fm_soft_tasks SET
        status = 'COMPLETED',
        completed_at = NOW(),
        checklist_data = ?,
        completion_notes = ?,
        completion_photos = ?
      WHERE id = ?`,
      [
        typeof checklist_data === "object" ? JSON.stringify(checklist_data) : checklist_data || null,
        completion_notes || "Task completed by personnel",
        completion_photos || null,
        id,
      ]
    );

    res.json({ success: true, message: "Task marked as completed successfully" });
  } catch (err) {
    console.error("executeSoftTask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function verifySoftTask(req, res) {
  try {
    const id = req.params.id;
    const { supervisor_rating, supervisor_comments, supervisor_name } = req.body;

    await query(
      `UPDATE fm_soft_tasks SET
        status = 'VERIFIED',
        verified_by_supervisor = 1,
        verified_at = NOW(),
        supervisor_rating = ?,
        supervisor_comments = ?,
        supervisor_name = COALESCE(?, supervisor_name)
      WHERE id = ?`,
      [
        supervisor_rating || 5,
        supervisor_comments || "Verified and approved by supervisor",
        supervisor_name || req.user?.username || null,
        id,
      ]
    );

    res.json({ success: true, message: "Task verified and approved by supervisor" });
  } catch (err) {
    console.error("verifySoftTask error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 2. HEALTH, SAFETY & COMPLIANCE (HSA)
// ==========================================
export async function listSafetyIncidents(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT i.*, p.property_name FROM fm_safety_incidents i 
       LEFT JOIN fm_properties p ON p.id = i.property_id 
       WHERE i.company_id = ? ORDER BY i.incident_date DESC LIMIT 200`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createSafetyIncident(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const b = req.body;
    const incident_no = b.incident_no || `INC-${Date.now().toString().slice(-6)}`;

    await query(
      `INSERT INTO fm_safety_incidents (
        company_id, branch_id, incident_no, property_id, incident_date, incident_type,
        severity, location_details, reported_by, affected_person_name, incident_description,
        immediate_action_taken, root_cause, corrective_actions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId,
        incident_no,
        b.property_id || 1,
        b.incident_date || new Date(),
        b.incident_type || "NEAR_MISS",
        b.severity || "MEDIUM",
        b.location_details || "Facility Grounds",
        b.reported_by || req.user?.username || "Staff",
        b.affected_person_name || null,
        b.incident_description || "",
        b.immediate_action_taken || "",
        b.root_cause || "",
        b.corrective_actions || "",
        b.status || "REPORTED",
      ]
    );
    res.status(201).json({ success: true, message: "Incident report logged", incident_no });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listPermitsToWork(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT ptw.*, p.property_name FROM fm_permits_to_work ptw 
       LEFT JOIN fm_properties p ON p.id = ptw.property_id 
       WHERE ptw.company_id = ? ORDER BY ptw.start_validity DESC LIMIT 200`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createPermitToWork(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const b = req.body;
    const permit_no = b.permit_no || `PTW-${Date.now().toString().slice(-6)}`;

    await query(
      `INSERT INTO fm_permits_to_work (
        company_id, branch_id, permit_no, property_id, permit_type, work_description,
        contractor_or_team, authorized_supervisor, lead_worker_name, start_validity,
        end_validity, gas_test_performed, gas_test_results, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId,
        permit_no,
        b.property_id || 1,
        b.permit_type || "HOT_WORK",
        b.work_description || "",
        b.contractor_or_team || "Maintenance Team",
        b.authorized_supervisor || req.user?.username || "Safety Officer",
        b.lead_worker_name || "Lead Tech",
        b.start_validity || new Date(),
        b.end_validity || new Date(Date.now() + 8 * 3600 * 1000),
        b.gas_test_performed ? 1 : 0,
        b.gas_test_results || "N/A",
        b.status || "ACTIVE_PERMITTED",
      ]
    );
    res.status(201).json({ success: true, message: "Permit to Work issued", permit_no });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listComplianceCertificates(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT c.*, p.property_name,
        DATEDIFF(c.expiry_date, CURDATE()) AS days_until_expiry
       FROM fm_compliance_certificates c
       LEFT JOIN fm_properties p ON p.id = c.property_id
       WHERE c.company_id = ? ORDER BY c.expiry_date ASC LIMIT 200`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createComplianceCertificate(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const b = req.body;
    await query(
      `INSERT INTO fm_compliance_certificates (
        company_id, branch_id, certificate_no, property_id, certificate_type,
        issuing_authority, issue_date, expiry_date, renewal_lead_days, inspector_name, compliance_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        branchId,
        b.certificate_no || `CERT-${Date.now().toString().slice(-6)}`,
        b.property_id || 1,
        b.certificate_type || "FIRE_SAFETY_PERMIT",
        b.issuing_authority || "National Fire Service",
        b.issue_date || new Date(),
        b.expiry_date || new Date(Date.now() + 365 * 24 * 3600 * 1000),
        b.renewal_lead_days || 30,
        b.inspector_name || "",
        b.compliance_status || "VALID_COMPLIANT",
      ]
    );
    res.status(201).json({ success: true, message: "Compliance certificate saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 3. UTILITIES AND ENERGY MANAGEMENT
// ==========================================
export async function listUtilityMeters(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT m.*, p.property_name,
        (SELECT current_reading FROM fm_utility_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) AS last_reading,
        (SELECT reading_date FROM fm_utility_readings WHERE meter_id = m.id ORDER BY reading_date DESC LIMIT 1) AS last_reading_date
       FROM fm_utility_meters m
       LEFT JOIN fm_properties p ON p.id = m.property_id
       WHERE m.company_id = ? ORDER BY m.id ASC`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createUtilityMeter(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;
    if (!b.property_id || !b.meter_code) {
      return res.status(400).json({ success: false, message: "Property and Meter Code are required" });
    }
    const result = await query(
      `INSERT INTO fm_utility_meters (
        company_id, property_id, meter_code, utility_type, location_description, meter_serial_number, unit_of_measure, tariff_rate_per_unit, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        b.property_id,
        b.meter_code,
        b.utility_type || 'ELECTRICITY_GRID',
        b.location_description || '',
        b.meter_serial_number || '',
        b.unit_of_measure || 'kWh',
        parseFloat(b.tariff_rate_per_unit) || 0,
        b.status || 'ACTIVE'
      ]
    );
    res.status(201).json({ success: true, message: "Utility meter registered successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createUtilityReading(req, res) {
  try {
    const b = req.body;
    const previous = parseFloat(b.previous_reading) || 0;
    const current = parseFloat(b.current_reading) || 0;
    const consumption = Math.max(0, current - previous);
    const total_cost = consumption * (parseFloat(b.tariff_rate) || 1.85);

    await query(
      `INSERT INTO fm_utility_readings (
        meter_id, reading_date, previous_reading, current_reading, consumption, total_cost, recorded_by, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.meter_id,
        b.reading_date || new Date().toISOString().slice(0, 10),
        previous,
        current,
        consumption,
        total_cost,
        b.recorded_by || req.user?.username || "Technician",
        b.notes || "",
      ]
    );
    res.status(201).json({ success: true, message: "Meter reading logged successfully", consumption, total_cost });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listGeneratorLogs(req, res) {
  try {
    const { property_id } = req.query;
    let sql = "SELECT * FROM fm_generator_logs WHERE 1=1";
    const params = [];
    if (property_id) {
      sql += " AND property_id = ?";
      params.push(property_id);
    }
    sql += " ORDER BY log_date DESC LIMIT 100";
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createGeneratorLog(req, res) {
  try {
    const b = req.body;
    const start_h = parseFloat(b.start_run_hours) || 0;
    const end_h = parseFloat(b.end_run_hours) || 0;
    const total_hours = Math.max(0, end_h - start_h);
    const fuel_consumed = parseFloat(b.fuel_consumed_liters) || 0;
    const kwh = parseFloat(b.kwh_generated) || total_hours * 180;
    const eff = fuel_consumed > 0 ? (kwh / fuel_consumed).toFixed(2) : 3.2;

    await query(
      `INSERT INTO fm_generator_logs (
        property_id, log_date, generator_name, start_run_hours, end_run_hours,
        total_hours_run, fuel_added_liters, fuel_consumed_liters, current_fuel_level_percent,
        kwh_generated, fuel_efficiency_kwh_per_liter, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.property_id || 1,
        b.log_date || new Date().toISOString().slice(0, 10),
        b.generator_name || "Standby Generator 1",
        start_h,
        end_h,
        total_hours,
        parseFloat(b.fuel_added_liters) || 0,
        fuel_consumed,
        parseInt(b.current_fuel_level_percent) || 75,
        kwh,
        eff,
        b.notes || "",
      ]
    );
    res.status(201).json({ success: true, message: "Generator operation logged" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listUtilityBills(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT b.*, p.property_name FROM fm_utility_bills b
       LEFT JOIN fm_properties p ON p.id = b.property_id
       WHERE b.company_id = ? ORDER BY b.billing_month DESC, b.id DESC LIMIT 100`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createUtilityBill(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;
    if (!b.property_id || !b.bill_reference) {
      return res.status(400).json({ success: false, message: "Property and Bill Reference are required" });
    }
    const result = await query(
      `INSERT INTO fm_utility_bills (
        company_id, property_id, utility_type, service_provider, account_number, bill_reference, billing_month, total_consumption, bill_amount, due_date, payment_status, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        b.property_id,
        b.utility_type || 'ELECTRICITY',
        b.service_provider || '',
        b.account_number || '',
        b.bill_reference,
        b.billing_month || new Date().toISOString().slice(0, 7),
        parseFloat(b.total_consumption) || 0,
        parseFloat(b.bill_amount) || 0,
        b.due_date || null,
        b.payment_status || 'PENDING',
        b.notes || ''
      ]
    );
    res.status(201).json({ success: true, message: "Utility bill recorded successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



// ==========================================
// 4. CONTRACTOR AND VENDOR MANAGEMENT
// ==========================================
export async function listVendors(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT v.*,
        (SELECT COUNT(*) FROM fm_vendor_contracts WHERE vendor_id = v.id AND status = 'ACTIVE') AS active_contracts_count
       FROM fm_vendors v WHERE v.company_id = ? ORDER BY v.vendor_name ASC`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createVendor(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;
    const vendor_code = b.vendor_code || `VND-${Date.now().toString().slice(-5)}`;

    await query(
      `INSERT INTO fm_vendors (
        company_id, vendor_code, vendor_name, service_specialty, contact_person,
        phone, email, address, insurance_policy_no, insurance_expiry, average_rating, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        vendor_code,
        b.vendor_name,
        b.service_specialty || "General FM Services",
        b.contact_person || "",
        b.phone || "",
        b.email || "",
        b.address || "",
        b.insurance_policy_no || "",
        b.insurance_expiry || null,
        b.average_rating || 5.0,
        b.status || "ACTIVE_APPROVED",
      ]
    );
    res.status(201).json({ success: true, message: "Vendor created successfully", vendor_code });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listVendorContracts(req, res) {
  try {
    const rows = await query(
      `SELECT vc.*, v.vendor_name, v.service_specialty, p.property_name 
       FROM fm_vendor_contracts vc
       LEFT JOIN fm_vendors v ON v.id = vc.vendor_id
       LEFT JOIN fm_properties p ON p.id = vc.property_id
       ORDER BY vc.end_date ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function rateVendor(req, res) {
  try {
    const b = req.body;
    const overall = (
      (parseFloat(b.quality_rating || 5) +
        parseFloat(b.timeliness_rating || 5) +
        parseFloat(b.safety_compliance_rating || 5)) /
      3
    ).toFixed(2);

    await query(
      `INSERT INTO fm_vendor_ratings (
        vendor_id, job_reference, rated_by, rating_date, quality_rating,
        timeliness_rating, safety_compliance_rating, overall_rating, feedback_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.vendor_id,
        b.job_reference || "Maintenance Work Order",
        b.rated_by || req.user?.username || "FM Manager",
        new Date().toISOString().slice(0, 10),
        b.quality_rating || 5,
        b.timeliness_rating || 5,
        b.safety_compliance_rating || 5,
        overall,
        b.feedback_notes || "",
      ]
    );

    // Update vendor average rating
    const [avgRow] = await query(
      `SELECT AVG(overall_rating) AS avg_score FROM fm_vendor_ratings WHERE vendor_id = ?`,
      [b.vendor_id]
    );
    if (avgRow?.avg_score) {
      await query(`UPDATE fm_vendors SET average_rating = ? WHERE id = ?`, [
        parseFloat(avgRow.avg_score).toFixed(2),
        b.vendor_id,
      ]);
    }

    res.status(201).json({ success: true, message: "Vendor performance rating saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 5. BUDGETING AND FINANCIAL MANAGEMENT
// ==========================================
export async function listBudgets(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT b.*, p.property_name, p.total_area_sqm,
        ROUND(b.actual_spent / NULLIF(p.total_area_sqm, 0), 2) AS cost_per_sqm
       FROM fm_budgets b
       LEFT JOIN fm_properties p ON p.id = b.property_id
       WHERE b.company_id = ? ORDER BY b.fiscal_year DESC`,
      [companyId]
    );

    // Compute real-time spending for each budget linked to properties, service bills & utilities
    for (const bg of rows) {
      const propId = bg.property_id;

      // 1. Utility bills spending
      const [uRows] = await query(
        `SELECT COALESCE(SUM(bill_amount), 0) AS util_spend FROM fm_utility_bills WHERE property_id = ? AND company_id = ?`,
        [propId, companyId]
      );
      const utilSpend = parseFloat(uRows?.util_spend) || 0;

      // 2. Facilities service bills spending (FB- bills)
      const [sbRows] = await query(
        `SELECT COALESCE(SUM(total_amount), 0) AS bills_spend FROM fm_service_bills WHERE property_id = ? AND company_id = ?`,
        [propId, companyId]
      );
      const billsSpend = parseFloat(sbRows?.bills_spend) || 0;

      // 3. Maintenance Work orders spending
      const [woRows] = await query(
        `SELECT COALESCE(SUM(actual_cost), 0) AS wo_spend FROM maint_job_orders WHERE property_id = ? AND company_id = ?`,
        [propId, companyId]
      );
      const woSpend = parseFloat(woRows?.wo_spend) || 0;

      // 4. Committed contract fees
      const [ctrRows] = await query(
        `SELECT COALESCE(SUM(billing_amount), 0) AS ctr_spend FROM fm_service_contracts WHERE (property_id = ? OR id IN (SELECT contract_id FROM fm_contract_properties WHERE property_id = ?)) AND contract_status = 'ACTIVE'`,
        [propId, propId]
      );
      const ctrSpend = parseFloat(ctrRows?.ctr_spend) || 0;

      const realtimeSpent = utilSpend + billsSpend + woSpend;
      const totalAllocated = parseFloat(bg.total_allocated) || 0;
      const variance = Math.max(0, totalAllocated - realtimeSpent);
      const burnRate = totalAllocated > 0 ? Math.min(100, Math.round((realtimeSpent / totalAllocated) * 100)) : 0;

      bg.actual_spent = realtimeSpent;
      bg.committed_contract_spend = ctrSpend;
      bg.variance_amount = variance;
      bg.burn_rate_percent = burnRate;
      bg.breakdown = {
        utility_spend: utilSpend,
        service_bills_spend: billsSpend,
        maintenance_spend: woSpend,
        committed_contracts: ctrSpend,
      };

      // Fetch line items and attach category real-time actuals
      const lines = await query(
        `SELECT * FROM fm_budget_line_items WHERE budget_id = ? ORDER BY allocated_budget DESC`,
        [bg.id]
      );
      for (const line of lines) {
        if (line.cost_category === "UTILITIES_ENERGY") {
          line.actual_spent = utilSpend;
        } else if (line.cost_category === "MAINTENANCE_REPAIRS") {
          line.actual_spent = woSpend;
        } else if (line.cost_category === "JANITORIAL_CLEANING") {
          line.actual_spent = billsSpend;
        }
        line.variance = (parseFloat(line.allocated_budget) || 0) - (parseFloat(line.actual_spent) || 0);
        line.percent_spent = line.allocated_budget > 0 ? Math.min(100, Math.round((line.actual_spent / line.allocated_budget) * 100)) : 0;
      }
      bg.lines = lines;
    }

    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createBudget(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;
    const totalAllocated = parseFloat(b.total_allocated) || 0;

    const resB = await query(
      `INSERT INTO fm_budgets (
        company_id, fiscal_year, property_id, cost_center_id, cost_center_name, budget_name, total_allocated,
        actual_spent, committed_contract_spend, variance_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 0.00, 0.00, ?, 'APPROVED')`,
      [
        companyId,
        b.fiscal_year || new Date().getFullYear(),
        b.property_id || 1,
        b.cost_center_id || null,
        b.cost_center_name || null,
        b.budget_name,
        totalAllocated,
        totalAllocated,
      ]
    );

    const budgetId = resB.insertId;
    if (Array.isArray(b.lines)) {
      for (const line of b.lines) {
        await query(
          `INSERT INTO fm_budget_line_items (budget_id, cost_category, item_description, allocated_budget, actual_spent)
           VALUES (?, ?, ?, ?, 0.00)`,
          [budgetId, line.cost_category, line.item_description, parseFloat(line.allocated_budget) || 0]
        );
      }
    }

    res.status(201).json({ success: true, message: "Facility budget created and linked to Finance cost center", budgetId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 6. SPACE AND OCCUPANCY MANAGEMENT
// ==========================================
export async function listRoomBookings(req, res) {
  try {
    const { companyId } = getScope(req);
    const { date } = req.query;
    let sql = `SELECT b.*, p.property_name FROM fm_room_bookings b 
               LEFT JOIN fm_properties p ON p.id = b.property_id 
               WHERE b.company_id = ?`;
    const params = [companyId];
    if (date) {
      sql += " AND b.booking_date = ?";
      params.push(date);
    }
    sql += " ORDER BY b.booking_date DESC, b.start_time ASC LIMIT 200";
    const rows = await query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createRoomBooking(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;

    await query(
      `INSERT INTO fm_room_bookings (
        company_id, property_id, space_or_room_name, booked_by_name, department_or_tenant,
        booking_date, start_time, end_time, purpose, attendees_count, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED')`,
      [
        companyId,
        b.property_id || 1,
        b.space_or_room_name || "Boardroom A",
        b.booked_by_name || req.user?.username || "Employee",
        b.department_or_tenant || "Operations",
        b.booking_date || new Date().toISOString().slice(0, 10),
        b.start_time || "09:00:00",
        b.end_time || "10:30:00",
        b.purpose || "Executive Meeting",
        b.attendees_count || 6,
      ]
    );
    res.status(201).json({ success: true, message: "Room booking confirmed" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listTenants(req, res) {
  try {
    const { companyId } = getScope(req);
    const rows = await query(
      `SELECT t.*, p.property_name FROM fm_tenant_records t 
       LEFT JOIN fm_properties p ON p.id = t.property_id 
       WHERE t.company_id = ? ORDER BY t.tenant_name ASC`,
      [companyId]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}



export async function createTenant(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;

    await query(
      `INSERT INTO fm_tenant_records (
        company_id, property_id, tenant_name, contact_person, contact_email, contact_phone,
        allocated_space_sqm, occupied_rooms_or_units, headcount, lease_start_date, lease_end_date,
        monthly_service_charge, occupancy_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        b.property_id || 1,
        b.tenant_name,
        b.contact_person || "",
        b.contact_email || "",
        b.contact_phone || "",
        parseFloat(b.allocated_space_sqm) || 100,
        b.occupied_rooms_or_units || "Office Suite 101",
        parseInt(b.headcount) || 5,
        b.lease_start_date || new Date().toISOString().slice(0, 10),
        b.lease_end_date || new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString().slice(0, 10),
        parseFloat(b.monthly_service_charge) || 0,
        b.occupancy_status || "ACTIVE_OCCUPIED",
      ]
    );
    res.status(201).json({ success: true, message: "Tenant record registered" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 7. SUSTAINABILITY AND ENVIRONMENTAL
// ==========================================
export async function listSustainabilityMetrics(req, res) {
  try {
    const { companyId } = getScope(req);
    const metrics = await query(
      `SELECT s.*, p.property_name FROM fm_sustainability_metrics s
       LEFT JOIN fm_properties p ON p.id = s.property_id
       WHERE s.company_id = ? ORDER BY s.reporting_period DESC`,
      [companyId]
    );
    const initiatives = await query(
      `SELECT i.*, p.property_name FROM fm_green_initiatives i
       LEFT JOIN fm_properties p ON p.id = i.property_id
       WHERE i.company_id = ? ORDER BY i.id DESC`,
      [companyId]
    );

    res.json({
      success: true,
      data: {
        metrics,
        initiatives,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createGreenInitiative(req, res) {
  try {
    const { companyId } = getScope(req);
    const b = req.body;

    await query(
      `INSERT INTO fm_green_initiatives (
        company_id, property_id, initiative_name, category, target_description,
        estimated_annual_co2_reduction_tons, estimated_annual_cost_savings, status, target_completion_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        companyId,
        b.property_id || 1,
        b.initiative_name,
        b.category || "ENERGY_EFFICIENCY",
        b.target_description || "",
        parseFloat(b.estimated_annual_co2_reduction_tons) || 0,
        parseFloat(b.estimated_annual_cost_savings) || 0,
        b.status || "PLANNING",
        b.target_completion_date || null,
      ]
    );
    res.status(201).json({ success: true, message: "Environmental initiative added" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ==========================================
// 8. FACILITIES OPERATIONS SETUP (Shifts, Supervisors, Personnel)
// ==========================================

export async function getSetupOverview(req, res) {
  try {
    const { companyId } = getScope(req);
    const shifts = await query(
      "SELECT * FROM fm_shifts WHERE company_id = ? AND is_active = 1 ORDER BY start_time ASC",
      [companyId]
    );
    const supervisors = await query(
      "SELECT * FROM fm_supervisors WHERE company_id = ? AND is_active = 1 ORDER BY name ASC",
      [companyId]
    );
    const personnel = await query(
      "SELECT * FROM fm_personnel WHERE company_id = ? AND is_active = 1 ORDER BY name ASC",
      [companyId]
    );
    const categories = await query(
      "SELECT * FROM fm_service_categories WHERE company_id = ? AND is_active = 1 ORDER BY category_name ASC",
      [companyId]
    );

    res.json({
      success: true,
      data: {
        shifts,
        supervisors,
        personnel,
        categories: categories || [],
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listShifts(req, res) {
  try {
    const { companyId } = getScope(req);
    const shifts = await query(
      "SELECT * FROM fm_shifts WHERE company_id = ? ORDER BY start_time ASC",
      [companyId]
    );
    res.json({ success: true, data: shifts });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createShift(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const { name, code, start_time, end_time, description, is_active } = req.body;
    if (!name || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: "Shift name, start time, and end time are required" });
    }
    const cleanCode = (code || name.replace(/[^A-Za-z0-9]/g, "_").toUpperCase()).slice(0, 50);

    const result = await query(
      `INSERT INTO fm_shifts (company_id, branch_id, name, code, start_time, end_time, description, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, branchId, name, cleanCode, start_time, end_time, description || "", is_active !== false ? 1 : 0]
    );
    res.status(201).json({ success: true, message: "Shift created successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateShift(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    const { name, code, start_time, end_time, description, is_active } = req.body;

    await query(
      `UPDATE fm_shifts SET name = ?, code = ?, start_time = ?, end_time = ?, description = ?, is_active = ?
       WHERE id = ? AND company_id = ?`,
      [name, code, start_time, end_time, description, is_active ? 1 : 0, id, companyId]
    );
    res.json({ success: true, message: "Shift updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteShift(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    await query("DELETE FROM fm_shifts WHERE id = ? AND company_id = ?", [id, companyId]);
    res.json({ success: true, message: "Shift deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listSupervisors(req, res) {
  try {
    const { companyId } = getScope(req);
    const supervisors = await query(
      "SELECT * FROM fm_supervisors WHERE company_id = ? ORDER BY is_active DESC, name ASC",
      [companyId]
    );
    res.json({ success: true, data: supervisors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createSupervisor(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const { employee_id, name, employee_code, phone, email, shift_id, shift_name, department, notes, is_active } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Supervisor name is required" });
    }

    const result = await query(
      `INSERT INTO fm_supervisors (company_id, branch_id, employee_id, name, employee_code, phone, email, shift_id, shift_name, department, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, branchId, employee_id || null, name, employee_code || null, phone || null, email || null, shift_id || null, shift_name || null, department || null, notes || null, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ success: true, message: "Supervisor created successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateSupervisor(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    const { employee_id, name, employee_code, phone, email, shift_id, shift_name, department, notes, is_active } = req.body;

    await query(
      `UPDATE fm_supervisors SET employee_id = ?, name = ?, employee_code = ?, phone = ?, email = ?, shift_id = ?, shift_name = ?, department = ?, notes = ?, is_active = ?
       WHERE id = ? AND company_id = ?`,
      [employee_id || null, name, employee_code || null, phone || null, email || null, shift_id || null, shift_name || null, department || null, notes || null, is_active ? 1 : 0, id, companyId]
    );
    res.json({ success: true, message: "Supervisor updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteSupervisor(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    await query("DELETE FROM fm_supervisors WHERE id = ? AND company_id = ?", [id, companyId]);
    res.json({ success: true, message: "Supervisor deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function listPersonnel(req, res) {
  try {
    const { companyId } = getScope(req);
    const personnel = await query(
      "SELECT * FROM fm_personnel WHERE company_id = ? ORDER BY is_active DESC, name ASC",
      [companyId]
    );
    res.json({ success: true, data: personnel });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createPersonnel(req, res) {
  try {
    const { companyId, branchId } = getScope(req);
    const { employee_id, name, employee_code, category, phone, email, shift_id, shift_name, supervisor_id, supervisor_name, notes, is_active } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: "Personnel name is required" });
    }

    const result = await query(
      `INSERT INTO fm_personnel (company_id, branch_id, employee_id, name, employee_code, category, phone, email, shift_id, shift_name, supervisor_id, supervisor_name, notes, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [companyId, branchId, employee_id || null, name, employee_code || null, category || "JANITORIAL", phone || null, email || null, shift_id || null, shift_name || null, supervisor_id || null, supervisor_name || null, notes || null, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ success: true, message: "Personnel created successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updatePersonnel(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    const { employee_id, name, employee_code, category, phone, email, shift_id, shift_name, supervisor_id, supervisor_name, notes, is_active } = req.body;

    await query(
      `UPDATE fm_personnel SET employee_id = ?, name = ?, employee_code = ?, category = ?, phone = ?, email = ?, shift_id = ?, shift_name = ?, supervisor_id = ?, supervisor_name = ?, notes = ?, is_active = ?
       WHERE id = ? AND company_id = ?`,
      [employee_id || null, name, employee_code || null, category || "JANITORIAL", phone || null, email || null, shift_id || null, shift_name || null, supervisor_id || null, supervisor_name || null, notes || null, is_active ? 1 : 0, id, companyId]
    );
    res.json({ success: true, message: "Personnel updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deletePersonnel(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    await query("DELETE FROM fm_personnel WHERE id = ? AND company_id = ?", [id, companyId]);
    res.json({ success: true, message: "Personnel deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function getHREmployeesList(req, res) {
  try {
    const { companyId } = getScope(req);
    const employees = await query(
      `SELECT id, emp_code, first_name, last_name, email, phone, dept_id, status
       FROM hr_employees
       WHERE (company_id = ? OR company_id IS NULL) AND deleted_at IS NULL
       ORDER BY first_name ASC, last_name ASC`,
      [companyId]
    );
    res.json({ success: true, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ===== SERVICE CATEGORIES SETUP =====
export async function listServiceCategories(req, res) {
  try {
    const { companyId } = getScope(req);
    const categories = await query(
      "SELECT * FROM fm_service_categories WHERE company_id = ? ORDER BY category_name ASC",
      [companyId]
    );
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function createServiceCategory(req, res) {
  try {
    const { companyId } = getScope(req);
    const { category_code, category_name, description, is_active } = req.body;
    if (!category_name) {
      return res.status(400).json({ success: false, message: "Category name is required" });
    }
    const code = category_code || category_name.toUpperCase().replace(/[^A-Z0-9]/g, "_");
    const result = await query(
      `INSERT INTO fm_service_categories (company_id, category_code, category_name, description, is_active)
       VALUES (?, ?, ?, ?, ?)`,
      [companyId, code, category_name, description || null, is_active !== false ? 1 : 0]
    );
    res.status(201).json({ success: true, message: "Service category created successfully", id: result.insertId });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateServiceCategory(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    const { category_code, category_name, description, is_active } = req.body;
    await query(
      `UPDATE fm_service_categories SET category_code = ?, category_name = ?, description = ?, is_active = ?
       WHERE id = ? AND company_id = ?`,
      [category_code, category_name, description || null, is_active ? 1 : 0, id, companyId]
    );
    res.json({ success: true, message: "Service category updated successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

export async function deleteServiceCategory(req, res) {
  try {
    const { id } = req.params;
    const { companyId } = getScope(req);
    await query("DELETE FROM fm_service_categories WHERE id = ? AND company_id = ?", [id, companyId]);
    res.json({ success: true, message: "Service category deleted" });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


