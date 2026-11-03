
function generateStaffPassword() {
  const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const numbers = "23456789";
  const specials = "@#$%&*!";
  const allChars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%&*!";
  
  const u = uppers[Math.floor(Math.random() * uppers.length)];
  const n = numbers[Math.floor(Math.random() * numbers.length)];
  const s = specials[Math.floor(Math.random() * specials.length)];
  let rest = "";
  for (let i = 0; i < 5; i++) {
    rest += allChars[Math.floor(Math.random() * allChars.length)];
  }
  const combined = (u + n + s + rest).split("");
  for (let i = combined.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}
import bcrypt from "bcryptjs";
/**
 * @file hr.controller.js
 * @description Manages Human Resources operations including employee profiles,
 * KPI tracking, policies, training programs, performance reviews, and exits.
 */
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { calculateEmployeeSalaryComponents } from "../utils/payrollSalaryComponents.js";
import {
  ensureWorkflowTables,
  toNumber,
  ensureHRTables,
  hasColumn,
  ensureCol,
} from "../utils/dbUtils.js";
import { sendMail } from "../utils/mailer.js";

/**
 * Retrieves a list of all employees matching the given filters (department, status, search query).
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function listEmployees(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { dept_id, status, q } = req.query;

    const clauses = [
      "e.company_id = :companyId",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr))",
      "e.deleted_at IS NULL",
    ];
    const params = { companyId, branchId, branchIdsStr };

    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = dept_id;
    }

    if (status && status !== "ALL") {
      clauses.push("e.status = :status");
      params.status = status;
    }

    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const items = await query(
      `SELECT e.id, e.emp_code, e.first_name, e.last_name, e.middle_name, e.email, e.phone, e.dept_id, e.pos_id, e.manager_id,
              e.employment_type, e.employment_type_id, e.category_id, e.location_id, e.status, e.base_salary, e.joining_date,
              e.face_descriptor, e.face_photo, e.face_registered_at,
              e.fingerprint_template, e.fingerprint_photo, e.fingerprint_registered_at,
              COALESCE(d.dept_name, ad.name) as dept_name, p.pos_name, m.first_name as manager_first_name, m.last_name as manager_last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.middle_name, ''), ' ', e.last_name) as full_name,
              CASE WHEN e.status = 'ACTIVE' THEN 1 ELSE 0 END as is_active,
          e.created_at
          FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN adm_departments ad ON ad.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_employees m ON m.id = e.manager_id
       ${where}
         ORDER BY e.emp_code ASC`,
      params,
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Performance APIs
 */
// Retrieves a list of all Key Performance Indicators (KPIs) for the company
// Used to populate KPI selection dropdowns or list views
export async function listKPIs(req, res, next) {
  try {
    // Extract company ID from the request scope
    const { companyId = null } = req.scope || {};
    // Fetch active KPIs for the current company, ordered by name
    const items = await query(
      `SELECT *,
          created_at FROM hr_kpis
         WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// Creates a new KPI or updates an existing one
// Handles conditional logic based on whether an ID is provided
export async function saveKPI(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    // Extract KPI details from the request body
    const { id, code, name, description, target_value, is_active } = req.body;

    // If ID exists, update the existing KPI record
    if (id) {
      await query(
        `UPDATE hr_kpis SET code = :code, name = :name, description = :description, target_value = :target_value, is_active = :is_active 
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          description,
          target_value: toNumber(target_value, null),
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "KPI updated" });
    } else {
      // If no ID, insert a new KPI record
      const result = await query(
        `INSERT INTO hr_kpis (company_id, code, name, description, target_value, is_active)
         VALUES (:companyId, :code, :name, :description, :target_value, 1)`,
        {
          companyId,
          code,
          name,
          description,
          target_value: toNumber(target_value, null),
        },
      );
      res.status(201).json({ id: result.insertId, message: "KPI created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Training APIs
 */
// Retrieves a list of all training programs for the company
// Fetches active programs and orders them by start date descending
async function listTrainingProgramsDup(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_training_programs
         WHERE company_id = :companyId AND is_active = 1 ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Compliance APIs
 */
// Database Utility: Ensures that attachment columns exist in the hr_policies table
// Adds attachment_url and attachment_name columns if they do not already exist
async function ensurePolicyAttachmentColumns() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === "true") return;
  // Add attachment_url column
  await query(
    `ALTER TABLE hr_policies
     ADD COLUMN attachment_url TEXT NULL AFTER content`,
    {},
  ).catch(() => {});
  // Add attachment_name column
  await query(
    `ALTER TABLE hr_policies
     ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment_url`,
    {},
  ).catch(() => {});
}

// Database Utility: Ensures that attachment columns exist in the hr_medical_policies table
// Adds attachment_url and attachment_name columns if they do not already exist
async function ensureMedicalPolicyAttachmentColumns() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === "true") return;
  // Add attachment_url column
  await query(
    `ALTER TABLE hr_medical_policies
     ADD COLUMN attachment_url TEXT NULL AFTER coverage_details`,
    {},
  ).catch(() => {});
  // Add attachment_name column
  await query(
    `ALTER TABLE hr_medical_policies
     ADD COLUMN attachment_name VARCHAR(255) NULL AFTER attachment_url`,
    {},
  ).catch(() => {});
}

// Utility: Generates the next sequential policy code for a given company
// Finds the highest existing code (e.g., CP000001) and increments the number
async function getNextPolicyCode(companyId) {
  // Fetch the latest policy code for the company
  const rows = await query(
    `SELECT code,
          created_at FROM hr_policies
         WHERE company_id = :companyId
       AND code REGEXP '^CP[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(code, 3) AS UNSIGNED) DESC
     LIMIT 1`,
    { companyId },
  );
  // Extract and increment the numeric part of the code
  const current = Number.parseInt(String(rows?.[0]?.code || "").slice(2), 10);
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `CP${String(next).padStart(6, "0")}`;
}

// Utility: Generates the next sequential medical policy code for a given company
// Finds the highest existing code (e.g., MP000001) and increments the number
async function getNextMedicalPolicyCode(companyId) {
  // Fetch the latest medical policy code for the company
  const rows = await query(
    `SELECT policy_code,
          created_at FROM hr_medical_policies
         WHERE company_id = :companyId
       AND policy_code REGEXP '^MP[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(policy_code, 3) AS UNSIGNED) DESC
     LIMIT 1`,
    { companyId },
  );
  // Extract and increment the numeric part of the code
  const current = Number.parseInt(
    String(rows?.[0]?.policy_code || "").slice(2),
    10,
  );
  const next = Number.isFinite(current) ? current + 1 : 1;
  return `MP${String(next).padStart(6, "0")}`;
}

/**
 * Retrieves all active HR policies for the company.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function listPolicies(req, res, next) {
  try {
    await ensurePolicyAttachmentColumns();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT id, company_id, code, title, content, attachment_url, attachment_name, is_active, created_at, updated_at,
          created_at FROM hr_policies
         WHERE company_id = :companyId AND is_active = 1
       ORDER BY title ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Creates or updates an HR policy document.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function savePolicy(req, res, next) {
  try {
    await ensurePolicyAttachmentColumns();
    const { companyId = null } = req.scope || {};
    const {
      id,
      code,
      title,
      content,
      attachment_url,
      attachment_name,
      is_active,
    } = req.body;
    const effectiveCode = id ? code : await getNextPolicyCode(companyId);
    if (!attachment_url) {
      throw httpError(400, "VALIDATION_ERROR", "Policy attachment is required");
    }
    if (id) {
      await query(
        `UPDATE hr_policies
         SET code = :code,
             title = :title,
             content = :content,
             attachment_url = :attachment_url,
             attachment_name = :attachment_name,
             is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code: effectiveCode,
          title,
          content,
          attachment_url,
          attachment_name: attachment_name || null,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Policy updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_policies
           (company_id, code, title, content, attachment_url, attachment_name, is_active)
         VALUES
           (:companyId, :code, :title, :content, :attachment_url, :attachment_name, 1)`,
        {
          companyId,
          code: effectiveCode,
          title,
          content,
          attachment_url,
          attachment_name: attachment_name || null,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Policy created" });
    }
  } catch (err) {
    next(err);
  }
}

// Records an employee's acknowledgement of a specific HR policy
export async function acknowledgePolicy(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { employee_id, policy_id } = req.body;

    // Insert acknowledgement record into the database
    await query(
      `INSERT INTO hr_policy_acknowledgements (company_id, employee_id, policy_id, acknowledged_at)
       VALUES (:companyId, :employee_id, :policy_id, NOW())`,
      { companyId, employee_id, policy_id },
    );
    res.status(201).json({ message: "Acknowledged" });
  } catch (err) {
    next(err);
  }
}

/**
 * Exit & Clearance APIs
 */
// Submits a new exit request (resignation/termination) for an employee
// Initializes the department clearance checklist automatically
export async function saveExit(req, res, next) {
  try {
    const {
      employee_id,
      exit_type,
      resignation_date,
      last_working_day,
      reason,
      status,
    } = req.body;

    // Insert the primary exit record
    const result = await query(
      `INSERT INTO hr_exits (employee_id, exit_type, resignation_date, last_working_day, reason, status)
       VALUES (:employee_id, :exit_type, :resignation_date, :last_working_day, :reason, :status)`,
      {
        employee_id,
        exit_type,
        resignation_date: resignation_date || null,
        last_working_day,
        reason: reason || null,
        status: status || "PENDING",
      },
    );
    const exitId = result.insertId;

    // Initialize clearance items for standard departments
    const depts = [
      "IT",
      "Finance",
      "HR",
      "Admin",
      "Library",
      "Department Head",
    ];
    for (const dept of depts) {
      await query(
        `INSERT INTO hr_clearance (exit_id, department, cleared) VALUES (:exitId, :dept, 0)`,
        { exitId, dept },
      );
    }

    res.status(201).json({
      id: exitId,
      message: "Exit submitted and clearance initialized",
    });
  } catch (err) {
    next(err);
  }
}

// Retrieves a list of exit requests, optionally filtered by employee ID
export async function listExits(req, res, next) {
  try {
    await ensureHRTables();
    const { employee_id } = req.query;

    // Build dynamic WHERE clauses based on provided query parameters
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("e.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const items = await query(
      `SELECT e.*, emp.first_name, emp.last_name
         FROM hr_exits e
       LEFT JOIN hr_employees emp ON emp.id = e.employee_id
       ${where}
         ORDER BY e.id DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// Retrieves clearance checklist items for a specific exit request
export async function listClearance(req, res, next) {
  try {
    const { exit_id } = req.query;
    const items = await query(
      `SELECT *
         FROM hr_clearance
         WHERE exit_id = :exit_id ORDER BY department ASC`,
      { exit_id },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// Updates the status of a specific clearance checklist item (e.g., IT department clearance)
// Automatically sets cleared_at timestamp if cleared
export async function updateClearance(req, res, next) {
  try {
    const { id, cleared, remarks } = req.body;
    await query(
      `UPDATE hr_clearance SET cleared = :cleared, cleared_at = CASE WHEN :cleared = 1 THEN NOW() ELSE NULL END, remarks = :remarks
       WHERE id = :id`,
      { id, cleared: cleared ? 1 : 0, remarks: remarks || null },
    );
    res.json({ message: "Clearance updated" });
  } catch (err) {
    next(err);
  }
}
export async function listKpis(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_kpis
         WHERE company_id = :companyId ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveKpi(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, code, name, description, target_value, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_kpis SET code = :code, name = :name, description = :description, target_value = :target_value, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          description,
          target_value,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "KPI updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_kpis (company_id, code, name, description, target_value, is_active) VALUES (:companyId, :code, :name, :description, :target_value, 1)`,
        { companyId, code, name, description, target_value },
      );
      res.status(201).json({ id: result.insertId, message: "KPI created" });
    }
  } catch (err) {
    next(err);
  }
}

// Retrieves a list of performance reviews for a specific employee
export async function listPerformanceReviews(req, res, next) {
  try {
    const { employee_id } = req.query;

    // Build filter clauses
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const items = await query(
      `SELECT r.*, e.first_name, e.last_name,
          r.created_at FROM hr_performance_reviews r LEFT JOIN hr_employees e ON e.id = r.employee_id ${where}
         ORDER BY r.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// Creates or updates a performance review for an employee
// Handles setting status, overall rating, and reviewer comments
export async function savePerformanceReview(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const {
      id,
      employee_id,
      period_name,
      reviewer_user_id,
      overall_rating,
      comments,
      status,
    } = req.body;

    // Update existing performance review
    if (id) {
      await query(
        `UPDATE hr_performance_reviews SET period_name = :period_name, reviewer_user_id = :reviewer_user_id, overall_rating = :overall_rating, comments = :comments, status = :status WHERE id = :id AND company_id = :companyId`,
        {
          id,
          period_name,
          reviewer_user_id,
          overall_rating,
          comments,
          status,
          companyId,
        },
      );
      res.json({ message: "Review updated" });
    } else {
      // Insert new performance review
      const result = await query(
        `INSERT INTO hr_performance_reviews (company_id, employee_id, period_name, reviewer_user_id, overall_rating, comments, status) VALUES (:companyId, :employee_id, :period_name, :reviewer_user_id, :overall_rating, :comments, :status)`,
        {
          companyId,
          employee_id,
          period_name,
          reviewer_user_id,
          overall_rating,
          comments,
          status: status || "DRAFT",
        },
      );
      res.status(201).json({ id: result.insertId, message: "Review created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listTrainingPrograms(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_training_programs
         WHERE company_id = :companyId ORDER BY start_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTrainingProgram(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, code, title, description, start_date, end_date, is_active } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_training_programs SET code = :code, title = :title, description = :description, start_date = :start_date, end_date = :end_date, is_active = :is_active WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          title,
          description,
          start_date,
          end_date,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Program updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_training_programs (company_id, code, title, description, start_date, end_date, is_active) VALUES (:companyId, :code, :title, :description, :start_date, :end_date, 1)`,
        { companyId, code, title, description, start_date, end_date },
      );
      res.status(201).json({ id: result.insertId, message: "Program created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listTrainingRecords(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT r.*, p.title AS program_title,
          r.created_at FROM hr_training_records r LEFT JOIN hr_training_programs p ON p.id = r.program_id ${where}
         ORDER BY r.completion_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTrainingRecord(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, employee_id, program_id, completion_date, status, remarks } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_training_records SET employee_id = :employee_id, program_id = :program_id, completion_date = :completion_date, status = :status, remarks = :remarks WHERE id = :id AND company_id = :companyId`,
        {
          id,
          employee_id,
          program_id,
          completion_date,
          status,
          remarks,
          companyId,
        },
      );
      res.json({ message: "Record updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_training_records (company_id, employee_id, program_id, completion_date, status, remarks) VALUES (:companyId, :employee_id, :program_id, :completion_date, :status, :remarks)`,
        {
          companyId,
          employee_id,
          program_id,
          completion_date,
          status,
          remarks,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Record created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieves full details of a specific employee, including their documents and manager info.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
// Main endpoint to fetch a single employee by ID
export async function registerEmployeeFingerprint(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const employeeId = toNumber(req.params.id || req.body.employee_id, null);
    if (!employeeId) throw httpError(400, "BAD_REQUEST", "Employee ID required");

    const { fingerprint_template = null, fingerprint_photo = null } = req.body;

    await query(
      `UPDATE hr_employees SET
        fingerprint_template = :fingerprint_template,
        fingerprint_photo = :fingerprint_photo,
        fingerprint_registered_at = CASE WHEN :fingerprint_template IS NOT NULL THEN NOW() ELSE NULL END
       WHERE id = :employeeId AND company_id = :companyId`,
      {
        employeeId,
        companyId,
        fingerprint_template: fingerprint_template || null,
        fingerprint_photo: fingerprint_photo || null,
      },
    );

    res.json({
      success: true,
      message: fingerprint_template
        ? "Fingerprint credentials registered successfully"
        : "Fingerprint credentials cleared",
    });
  } catch (err) {
    next(err);
  }
}

export async function registerEmployeeFace(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const employeeId = toNumber(req.params.id || req.body.employee_id, null);
    if (!employeeId) throw httpError(400, "BAD_REQUEST", "Employee ID required");

    const { face_descriptor = null, face_photo = null } = req.body;

    await query(
      `UPDATE hr_employees SET
        face_descriptor = :face_descriptor,
        face_photo = :face_photo,
        face_registered_at = CASE WHEN :face_descriptor IS NOT NULL THEN NOW() ELSE NULL END
       WHERE id = :employeeId AND company_id = :companyId`,
      {
        employeeId,
        companyId,
        face_descriptor: face_descriptor || null,
        face_photo: face_photo || null,
      },
    );

    res.json({
      success: true,
      message: face_descriptor ? "Face credentials registered successfully" : "Face credentials cleared",
    });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeById(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;

    // Fetch primary employee data with department, position, and manager details
    const rows = await query(
      `SELECT e.*, COALESCE(d.dept_name, ad.name) as dept_name, p.pos_name, m.first_name as manager_first_name, m.last_name as manager_last_name,
              CONCAT(e.first_name, ' ', COALESCE(e.middle_name, ''), ' ', e.last_name) as full_name,
          e.created_at FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN adm_departments ad ON ad.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_employees m ON m.id = e.manager_id
         WHERE e.id = :id AND e.company_id = :companyId AND e.deleted_at IS NULL`,
      { id, companyId },
    );

    if (!rows.length) throw httpError(404, "NOT_FOUND", "Employee not found");

    const item = rows[0];

    // Parse JSON mapping fields if they are strings
    try {
      if (typeof item.tax_mappings === "string") {
        item.tax_mappings = JSON.parse(item.tax_mappings);
      }
      if (typeof item.allowance_mappings === "string") {
        item.allowance_mappings = JSON.parse(item.allowance_mappings);
      }
    } catch {}

    // Fetch all attached documents for this employee
    const documents = await query(
      `SELECT *,
          created_at FROM hr_employee_documents
         WHERE employee_id = :id`,
      { id },
    );

    res.json({ item, documents });
  } catch (err) {
    next(err);
  }
}

/**
 * Inserts or updates an employee's profile and manages their tax/allowance mappings.
 * Uses a database transaction to ensure data integrity.
 *
 * @param {import('express').Request} req - Express request object.
 * @param {import('express').Response} res - Express response object.
 * @param {import('express').NextFunction} next - Express next middleware function.
 */
export async function saveEmployee(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const body = req.body;

    // Derive statutory deductions (PAYE, SSNIT/SSF, Tier 3) from tax_mappings
    const taxMappings = Array.isArray(body.tax_mappings) ? body.tax_mappings.map(Number) : [];
    let hasPaye = 0;
    let hasSsnit = 0;
    let hasTier3 = 0;

    if (taxMappings.length > 0) {
      try {
        const [allTaxes] = await conn.query(
          `SELECT id, tax_type, tax_name FROM hr_tax_config WHERE company_id = ? OR company_id = 1`,
          [companyId],
        );
        for (const t of allTaxes) {
          if (taxMappings.includes(Number(t.id))) {
            const ttype = String(t.tax_type || "").toUpperCase();
            const tname = String(t.tax_name || "").toUpperCase();
            if (ttype === "INCOME_TAX" || tname.includes("PAYE")) hasPaye = 1;
            if (ttype === "SOCIAL_SECURITY" || tname.includes("SSF") || tname.includes("SNITT") || tname.includes("SSNIT")) hasSsnit = 1;
            if (ttype === "PROVIDENT_FUND" || ttype === "PROVIDENCE_FUND" || tname.includes("TIER 3") || tname.includes("TIER-3") || tname.includes("PROVIDENT")) hasTier3 = 1;
          }
        }
      } catch (taxCheckErr) {
        console.warn("Could not check tax_config:", taxCheckErr.message);
      }
    }
    if (body.has_paye !== undefined) hasPaye = body.has_paye ? 1 : 0;
    if (body.has_ssnit !== undefined) hasSsnit = body.has_ssnit ? 1 : 0;
    if (body.has_tier3 !== undefined) hasTier3 = body.has_tier3 ? 1 : 0;

    if (body.id) {
      await conn.query(
        `UPDATE hr_employees SET 
          emp_code = ?, first_name = ?, last_name = ?, middle_name = ?,
          gender = ?, dob = ?, joining_date = ?, email = ?, phone = ?, 
          dept_id = ?, pos_id = ?, manager_id = ?, location_id = ?,
          employment_type = ?, employment_type_id = ?, category_id = ?, status = ?, base_salary = ?, address = ?, 
          picture_url = ?, national_id = ?, city = ?, state = ?, country = ?, emergency_contact_name = ?, emergency_contact_phone = ?, bank_name = ?, bank_account_number = ?, ssnit_number = ?,
          tax_mappings = ?, allowance_mappings = ?,
          has_paye = ?, has_ssnit = ?, has_tier3 = ?,
          face_descriptor = COALESCE(?, face_descriptor),
          face_photo = COALESCE(?, face_photo),
          face_registered_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE face_registered_at END,
          fingerprint_template = COALESCE(?, fingerprint_template),
          fingerprint_photo = COALESCE(?, fingerprint_photo),
          fingerprint_registered_at = CASE WHEN ? IS NOT NULL THEN NOW() ELSE fingerprint_registered_at END,
          updated_by = ?
         WHERE id = ? AND company_id = ?`,
        [
          body.emp_code,
          body.first_name,
          body.last_name,
          body.middle_name || null,
          body.gender || null,
          body.dob || null,
          body.joining_date,
          body.email || null,
          body.phone || null,
          body.dept_id || null,
          body.pos_id || null,
          body.manager_id || null,
          body.location_id || null,
          body.employment_type || "FULL_TIME",
          body.employment_type_id || null,
          body.category_id || null,
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          body.picture_url || null,
          body.national_id || null,
          body.city || null,
          body.state || null,
          body.country || null,
          body.emergency_contact_name || null,
          body.emergency_contact_phone || null,
          body.bank_name || null,
          body.bank_account_number || null,
          body.ssnit_number || null,
          JSON.stringify(
            Array.isArray(body.tax_mappings) ? body.tax_mappings : [],
          ),
          JSON.stringify(
            Array.isArray(body.allowance_mappings)
              ? body.allowance_mappings
              : [],
          ),
          hasPaye,
          hasSsnit,
          hasTier3,
          body.face_descriptor !== undefined ? body.face_descriptor : null,
          body.face_photo !== undefined ? body.face_photo : null,
          body.face_descriptor || null,
          body.fingerprint_template !== undefined ? body.fingerprint_template : null,
          body.fingerprint_photo !== undefined ? body.fingerprint_photo : null,
          body.fingerprint_template || null,
          userId,
          body.id,
          companyId,
        ],
      );
      // Handle mapping tables
      try {
        await conn.query(
          `DELETE FROM hr_employee_tax_mappings WHERE employee_id = ?`,
          [body.id],
        );
        const taxIds = Array.isArray(body.tax_mappings)
          ? body.tax_mappings
          : [];
        for (const tid of taxIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [body.id, tid],
          );
        }
        await conn.query(
          `DELETE FROM hr_employee_allowance_mappings WHERE employee_id = ?`,
          [body.id],
        );
        const allowIds = Array.isArray(body.allowance_mappings)
          ? body.allowance_mappings
          : [];
        for (const aid of allowIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [body.id, aid],
          );
        }
      } catch (err) {
        console.error("Mapping error: ", err);
      }
      await conn.commit();
      res.json({ message: "Employee updated successfully" });
    } else {
      const [result] = await conn.query(
        `INSERT INTO hr_employees (
          company_id, branch_id, emp_code, first_name, last_name, middle_name,
          gender, dob, joining_date, email, phone, dept_id, pos_id, manager_id, location_id,
          employment_type, employment_type_id, category_id, status, base_salary, address, picture_url, national_id, city, state, country, emergency_contact_name, emergency_contact_phone, bank_name, bank_account_number, ssnit_number, tax_mappings, allowance_mappings,
          has_paye, has_ssnit, has_tier3, face_descriptor, face_photo, face_registered_at, fingerprint_template, fingerprint_photo, fingerprint_registered_at, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          companyId,
          branchId,
          body.emp_code,
          body.first_name,
          body.last_name,
          body.middle_name || null,
          body.gender || null,
          body.dob || null,
          body.joining_date,
          body.email || null,
          body.phone || null,
          body.dept_id || null,
          body.pos_id || null,
          body.manager_id || null,
          body.location_id || null,
          body.employment_type || "FULL_TIME",
          body.employment_type_id || null,
          body.category_id || null,
          body.status || "PROBATION",
          body.base_salary || 0,
          body.address || null,
          body.picture_url || null,
          body.national_id || null,
          body.city || null,
          body.state || null,
          body.country || null,
          body.emergency_contact_name || null,
          body.emergency_contact_phone || null,
          body.bank_name || null,
          body.bank_account_number || null,
          body.ssnit_number || null,
          JSON.stringify(
            Array.isArray(body.tax_mappings) ? body.tax_mappings : [],
          ),
          JSON.stringify(
            Array.isArray(body.allowance_mappings)
              ? body.allowance_mappings
              : [],
          ),
          hasPaye,
          hasSsnit,
          hasTier3,
          body.face_descriptor || null,
          body.face_photo || null,
          body.face_descriptor ? new Date() : null,
          body.fingerprint_template || null,
          body.fingerprint_photo || null,
          body.fingerprint_template ? new Date() : null,
          userId,
        ],
      );
      // Handle mapping tables
      const newId = result.insertId;
      try {
        const taxIds = Array.isArray(body.tax_mappings)
          ? body.tax_mappings
          : [];
        for (const tid of taxIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [newId, tid],
          );
        }
        const allowIds = Array.isArray(body.allowance_mappings)
          ? body.allowance_mappings
          : [];
        for (const aid of allowIds) {
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [newId, aid],
          );
        }
      } catch (err) {
        console.error("Mapping error on insert: ", err);
      }

      // Automatically provision staff user account & send welcome email with credentials
      const empEmail = String(body.email || "").trim();
      let createdUserId = null;
      let plainPassword = null;
      if (empEmail) {
        try {
          const cleanFirst = String(body.first_name || "").replace(/\s+/g, "");
          const cleanLast = String(body.last_name || "").replace(/\s+/g, "");
          let empUsername = `${cleanFirst}${cleanLast}`.toLowerCase().replace(/[^a-z0-9]/g, "");
          if (!empUsername) empUsername = String(body.emp_code || empEmail.split("@")[0]).trim().toLowerCase().replace(/\s+/g, "");
          const [existingUsers] = await conn.query(
            `SELECT id, username, email FROM adm_users WHERE email = ? OR username = ? LIMIT 1`,
            [empEmail, empUsername],
          );

          if (existingUsers && existingUsers.length > 0) {
            createdUserId = existingUsers[0].id;
            await conn.query(
              `UPDATE hr_employees SET user_id = ? WHERE id = ?`,
              [createdUserId, newId],
            );
          } else {
            plainPassword = generateStaffPassword();
            const hashedPassword = await bcrypt.hash(plainPassword, 10);
            const fullName = `${body.first_name || ""} ${body.last_name || ""}`.trim() || empUsername;

            const [userInsert] = await conn.query(
              `INSERT INTO adm_users (
                company_id, branch_id, username, email, full_name, password_hash, is_active, is_employee, status, created_by
              ) VALUES (?, ?, ?, ?, ?, ?, 1, 1, 'A', ?)`,
              [
                companyId,
                branchId || 1,
                empUsername,
                empEmail,
                fullName,
                hashedPassword,
                userId,
              ],
            );
            createdUserId = userInsert.insertId;
            await conn.query(
              `UPDATE hr_employees SET user_id = ? WHERE id = ?`,
              [createdUserId, newId],
            );

            // Fetch company name for branding & custom templates
            const [compRows] = await conn.query(
              `SELECT name FROM adm_companies WHERE id = ? LIMIT 1`,
              [companyId],
            );
            const companyName = compRows?.[0]?.name || "OmniSuite";

            // Check if custom template is configured in hr_setup_parameters
            let customSub = null;
            let customTpl = null;
            try {
              const [paramRows] = await conn.query(
                `SELECT param_key, param_value FROM hr_setup_parameters WHERE (company_id = ? OR company_id = 1) AND param_key IN ('welcome_email_subject', 'welcome_email_template')`,
                [companyId],
              );
              for (const p of paramRows || []) {
                if (p.param_key === 'welcome_email_subject') customSub = p.param_value;
                if (p.param_key === 'welcome_email_template') customTpl = p.param_value;
              }
            } catch {}

            // Send Welcome Email with login credentials
            const emailHtml = `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to ${companyName}</h1>
                  <p style="margin: 8px 0 0; font-size: 14px; opacity: 0.85;">Your Employee Portal Account Has Been Created</p>
                </div>
                <div style="padding: 32px 24px; color: #334155; line-height: 1.6;">
                  <p style="font-size: 16px; margin-top: 0;">Hello <strong>${body.first_name || "Employee"}</strong>,</p>
                  <p style="font-size: 14px; color: #475569;">
                    We are pleased to welcome you to <strong>${companyName}</strong>. Your official staff profile and employee portal account have been provisioned. You can use the credentials below to log into the staff portal, view payslips, submit leave applications, and manage work requests.
                  </p>
                  
                  <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 20px; margin: 24px 0;">
                    <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                      Your Login Credentials
                    </div>
                    <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                      <tr>
                        <td style="padding: 6px 0; color: #64748b; width: 140px;">Username / Login:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;"><code style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-size: 13px;">${empUsername}</code></td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b;">Temporary Password:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;"><code style="background: #e2e8f0; padding: 3px 8px; border-radius: 4px; font-size: 13px;">${plainPassword}</code></td>
                      </tr>
                      <tr>
                        <td style="padding: 6px 0; color: #64748b;">Staff Code:</td>
                        <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${body.emp_code || "N/A"}</td>
                      </tr>
                    </table>
                  </div>

                  <p style="font-size: 13px; color: #64748b; margin-bottom: 24px;">
                    <em>Note: For security reasons, please change your temporary password immediately upon your first login.</em>
                  </p>

                  <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; color: #94a3b8; text-align: center;">
                    If you did not expect this email or believe it was sent in error, please contact your Human Resources department.
                  </div>
                </div>
              </div>
            `;

            let finalWelcomeSubject = `Welcome to ${companyName} - Your Staff Portal Credentials`;
            let finalWelcomeHtml = emailHtml;

            if (customSub) {
              finalWelcomeSubject = customSub
                .replace(/\{\{employee_name\}\}/g, fullName)
                .replace(/\{\{username\}\}/g, empUsername)
                .replace(/\{\{password\}\}/g, plainPassword)
                .replace(/\{\{emp_code\}\}/g, body.emp_code || "")
                .replace(/\{\{company_name\}\}/g, companyName);
            }
            if (customTpl) {
              const bodyParsed = customTpl
                .replace(/\{\{employee_name\}\}/g, fullName)
                .replace(/\{\{username\}\}/g, empUsername)
                .replace(/\{\{password\}\}/g, plainPassword)
                .replace(/\{\{emp_code\}\}/g, body.emp_code || "")
                .replace(/\{\{company_name\}\}/g, companyName);
              finalWelcomeHtml = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 620px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; color: #1e293b; line-height: 1.7;">
                  ${bodyParsed.replace(/\n/g, "<br />")}
                </div>
              `;
            }

            await sendMail({
              to: empEmail,
              subject: finalWelcomeSubject,
              html: finalWelcomeHtml,
            }).catch((mailErr) => {
              console.warn("Could not dispatch welcome email:", mailErr.message);
            });
          }
        } catch (authErr) {
          console.error("Error provisioning user account for employee:", authErr);
        }
      }

      await conn.commit();
      res.status(201).json({
        id: result.insertId,
        message: "Employee created successfully",
      });
    }
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

export async function saveEmployeesBulk(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    let created = 0;
    let updated = 0;
    for (const b of items) {
      const [rows] = await conn.query(
        `SELECT id,
          created_at FROM hr_employees
         WHERE company_id = ? AND emp_code = ? LIMIT 1`,
        [companyId, b.emp_code],
      );
      if (rows && rows.length) {
        const id = rows[0].id;
        await conn.query(
          `UPDATE hr_employees SET 
            first_name = ?, last_name = ?, middle_name = ?, gender = ?, dob = ?, joining_date = ?, email = ?, phone = ?,
            dept_id = ?, pos_id = ?, manager_id = ?, location_id = ?,
            employment_type = COALESCE(?, employment_type), employment_type_id = ?, category_id = ?, status = ?, base_salary = ?, address = ?, 
            picture_url = ?, national_id = ?, tax_mappings = ?, allowance_mappings = ?, updated_by = ?
           WHERE id = ? AND company_id = ?`,
          [
            b.first_name,
            b.last_name,
            b.middle_name || null,
            b.gender || null,
            b.dob || null,
            b.joining_date,
            b.email || null,
            b.phone || null,
            b.dept_id || null,
            b.pos_id || null,
            b.manager_id || null,
            b.location_id || null,
            b.employment_type || null,
            b.employment_type_id || null,
            b.category_id || null,
            b.status || "PROBATION",
            b.base_salary || 0,
            b.address || null,
            b.picture_url || null,
            b.national_id || null,
            JSON.stringify(Array.isArray(b.tax_mappings) ? b.tax_mappings : []),
            JSON.stringify(
              Array.isArray(b.allowance_mappings) ? b.allowance_mappings : [],
            ),
            userId,
            id,
            companyId,
          ],
        );
        // mappings
        await conn.query(
          `DELETE FROM hr_employee_tax_mappings WHERE employee_id = ?`,
          [id],
        );
        for (const taxId of b.tax_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [id, taxId],
          );
        }
        await conn.query(
          `DELETE FROM hr_employee_allowance_mappings WHERE employee_id = ?`,
          [id],
        );
        for (const aId of b.allowance_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [id, aId],
          );
        }
        updated++;
      } else {
        const [result] = await conn.query(
          `INSERT INTO hr_employees (
            company_id, branch_id, emp_code, first_name, last_name, middle_name, gender, dob, joining_date, email, phone,
            dept_id, pos_id, manager_id, location_id, employment_type, employment_type_id, category_id, status, base_salary, address, picture_url, national_id, tax_mappings, allowance_mappings, created_by
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            companyId,
            branchId,
            branchIdsStr,
            b.emp_code,
            b.first_name,
            b.last_name,
            b.middle_name || null,
            b.gender || null,
            b.dob || null,
            b.joining_date,
            b.email || null,
            b.phone || null,
            b.dept_id || null,
            b.pos_id || null,
            b.manager_id || null,
            b.location_id || null,
            b.employment_type || null,
            b.employment_type_id || null,
            b.category_id || null,
            b.status || "PROBATION",
            b.base_salary || 0,
            b.address || null,
            b.picture_url || null,
            b.national_id || null,
            JSON.stringify(Array.isArray(b.tax_mappings) ? b.tax_mappings : []),
            JSON.stringify(
              Array.isArray(b.allowance_mappings) ? b.allowance_mappings : [],
            ),
            userId,
          ],
        );
        const newId = result.insertId;
        for (const taxId of b.tax_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_tax_mappings (employee_id, tax_config_id) VALUES (?, ?)`,
            [newId, taxId],
          );
        }
        for (const aId of b.allowance_mappings || []) {
          // eslint-disable-next-line no-await-in-loop
          await conn.query(
            `INSERT IGNORE INTO hr_employee_allowance_mappings (employee_id, allowance_id) VALUES (?, ?)`,
            [newId, aId],
          );
        }
        created++;
      }
    }
    await conn.commit();
    res.json({ message: "Bulk employees processed", created, updated });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

/**
 * List Departments
 */
export async function listDepartments(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const admDepts = await query(
      `SELECT id, code AS dept_code, name AS dept_name, created_at FROM adm_departments WHERE (:companyId IS NULL OR company_id = :companyId OR company_id IS NULL) AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    ).catch(() => []);
    const hrDepts = await query(
      `SELECT id, dept_code, dept_name, created_at FROM hr_departments WHERE (:companyId IS NULL OR company_id = :companyId) AND deleted_at IS NULL ORDER BY dept_name ASC`,
      { companyId },
    ).catch(() => []);

    const seen = new Set();
    const items = [];
    for (const d of [...(admDepts || []), ...(hrDepts || [])]) {
      const nameKey = (d.dept_name || "").toLowerCase().trim();
      if (nameKey && !seen.has(nameKey)) {
        seen.add(nameKey);
        items.push(d);
      }
    }
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * List Positions
 */
export async function listPositions(req, res, next) {
  try {
    await ensureHRTables();
    try {
      await query(
        `ALTER TABLE hr_positions ADD COLUMN reports_to_pos_id BIGINT UNSIGNED NULL`,
      );
    } catch {}
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT p.id, p.pos_code, p.pos_name, p.dept_id, p.reports_to_pos_id,
          p2.pos_name as parent_pos_name, d.dept_name,
          p.created_at FROM hr_positions p
        LEFT JOIN hr_positions p2 ON p2.id = p.reports_to_pos_id
        LEFT JOIN hr_departments d ON d.id = p.dept_id
         WHERE (:companyId IS NULL OR p.company_id = :companyId OR p.company_id = 1 OR p.company_id IS NULL) AND p.deleted_at IS NULL ORDER BY p.pos_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Create/Update Department
 */
export async function saveDepartment(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { id, dept_code, dept_name, manager_id, parent_dept_id } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    const params = {
      dept_code,
      dept_name,
      manager_id: toNumber(manager_id, null),
      parent_dept_id: toNumber(parent_dept_id, null),
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_departments SET dept_code = :dept_code, dept_name = :dept_name, 
                manager_id = :manager_id, parent_dept_id = :parent_dept_id, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Department updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_departments (company_id, branch_id, dept_code, dept_name, manager_id, parent_dept_id, created_by)
         VALUES (:companyId, :branchId, :dept_code, :dept_name, :manager_id, :parent_dept_id, :userId)`,
        { ...params, branchId, branchIdsStr },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Department created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Create/Update Position
 */
export async function savePosition(req, res, next) {
  try {
    await ensureHRTables();
    try {
      await query(
        `ALTER TABLE hr_positions ADD COLUMN reports_to_pos_id BIGINT UNSIGNED NULL`,
      );
    } catch {}
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { id, pos_code, pos_name, dept_id, reports_to_pos_id } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    const params = {
      pos_code,
      pos_name,
      dept_id: toNumber(dept_id, null),
      reports_to_pos_id: toNumber(reports_to_pos_id, null),
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_positions SET pos_code = :pos_code, pos_name = :pos_name, 
                dept_id = :dept_id, reports_to_pos_id = :reports_to_pos_id, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Position updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_positions (company_id, branch_id, pos_code, pos_name, dept_id, reports_to_pos_id, created_by)
         VALUES (:companyId, :branchId, :pos_code, :pos_name, :dept_id, :reports_to_pos_id, :userId)`,
        { ...params, branchId, branchIdsStr },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Position created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - List Requisitions
 */
export async function getNextRequisitionNo(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(
      `SELECT MAX(id) as max_id FROM hr_job_requisitions
         WHERE company_id = :companyId`,
      { companyId },
    );
    const nextId = (rows[0]?.max_id || 0) + 1;
    const nextReqNo = String(nextId).padStart(6, "0");
    res.json({ nextReqNo });
  } catch (err) {
    next(err);
  }
}

export async function listRequisitions(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const items = await query(
      `SELECT r.*, d.dept_name, p.pos_name,
          r.created_at FROM hr_job_requisitions r
       LEFT JOIN hr_departments d ON d.id = r.dept_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
         WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr))
       ORDER BY r.created_at DESC`,
      { companyId, branchId, branchIdsStr },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getRequisitionById(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT r.*, d.dept_name, p.pos_name,
          r.created_at FROM hr_job_requisitions r
       LEFT JOIN hr_departments d ON d.id = r.dept_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
         WHERE r.id = :id AND r.company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Requisition not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}
/**
 * Recruitment - Save Requisition
 */
export async function saveRequisition(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const {
      id,
      req_no,
      title,
      dept_id,
      pos_id,
      vacancies,
      employment_type,
      recruitment_type,
      from_date,
      to_date,
      reason,
      requirements,
      status,
    } = req.body;

    if (id) {
      await query(
        `UPDATE hr_job_requisitions SET title = :title, vacancies = :vacancies, 
                employment_type = :employment_type, recruitment_type = :recruitment_type,
                from_date = :from_date, to_date = :to_date,
                reason = :reason, requirements = :requirements, 
                status = :status, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          title,
          vacancies,
          employment_type,
          recruitment_type,
          from_date,
          to_date,
          reason,
          requirements,
          status,
          userId,
          companyId,
        },
      );
      res.json({ message: "Requisition updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_job_requisitions (company_id, branch_id, req_no, title, dept_id, pos_id, vacancies, employment_type, recruitment_type, from_date, to_date, reason, requirements, status, created_by)
         VALUES (:companyId, :branchId, :req_no, :title, :dept_id, :pos_id, :vacancies, :employment_type, :recruitment_type, :from_date, :to_date, :reason, :requirements, :status, :userId)`,
        {
          companyId,
          branchId,
          branchIdsStr,
          req_no,
          title,
          dept_id,
          pos_id,
          vacancies,
          employment_type,
          recruitment_type,
          from_date,
          to_date,
          reason,
          requirements,
          status,
          userId,
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Requisition created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Submit Requisition to Workflow
 */
export async function submitRequisition(req, res, next) {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id, null);
    if (!id) throw httpError(400, "BAD_REQUEST", "Invalid requisition ID");

    const [reqRow] = await query(
      `SELECT *,
          created_at FROM hr_job_requisitions
         WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    ).catch(() => []);
    if (!reqRow) throw httpError(404, "NOT_FOUND", "Requisition not found");

    const [workflow] = await query(
      `SELECT *,
          created_at FROM adm_workflows
         WHERE company_id = :companyId 
         AND (document_type = 'Job Requisition' OR document_type = 'JOB_REQUISITION')
         AND is_active = 1 
       ORDER BY id ASC LIMIT 1`,
      { companyId },
    ).catch(() => []);
    if (!workflow)
      throw httpError(
        400,
        "BAD_REQUEST",
        "Job Requisition workflow not configured",
      );

    const [firstStep] = await query(
      `SELECT *,
          created_at FROM adm_workflow_steps
         WHERE workflow_id = :wfId ORDER BY step_order ASC LIMIT 1`,
      { wfId: workflow.id },
    ).catch(() => []);
    if (!firstStep)
      throw httpError(400, "BAD_REQUEST", "Workflow has no steps");

    const [firstAssignedRow] = await query(
      `SELECT approver_user_id,
          created_at FROM adm_workflow_step_approvers
         WHERE workflow_id = :wfId AND step_order = :step 
       ORDER BY approver_user_id ASC LIMIT 1`,
      { wfId: workflow.id, step: firstStep.step_order },
    ).catch(() => []);
    const firstAssigned =
      firstAssignedRow?.approver_user_id || firstStep.approver_user_id || null;

    const result = await query(
      `INSERT INTO adm_document_workflows 
       (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
       VALUES (:companyId, :workflow_id, :document_id, :document_type, :amount, :step_order, 'PENDING', :user_id)`,
      {
        companyId,
        workflow_id: workflow.id,
        document_id: id,
        document_type: "Job Requisition",
        amount: 0,
        step_order: firstStep.step_order,
        user_id: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_tasks
       (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
       VALUES (:companyId, :workflow_id, :dw_id, :document_id, :document_type, :step_order, :assigned_to, 'PENDING')`,
      {
        companyId,
        workflow_id: workflow.id,
        dw_id: result.insertId,
        document_id: id,
        document_type: "Job Requisition",
        step_order: firstStep.step_order,
        assigned_to: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES (:id, :step, 'SUBMIT', :userId, 'Job requisition submitted for approval')`,
      {
        id: result.insertId,
        step: firstStep.step_order,
        userId: req.user.sub,
      },
    );

    await query(
      `UPDATE hr_job_requisitions SET status = 'PENDING' WHERE id = :id`,
      { id },
    );

    try {
      const { notifyWorkflowForward } =
        await import("../services/notifications/workflowNotify.js");
      if (firstAssigned) {
        await notifyWorkflowForward({
          companyId,
          userId: firstAssigned,
          workflowInstanceId: result.insertId,
          documentId: id,
          documentType: "Job Requisition",
          title: "Job Requisition Forwarded",
          message: `Job Requisition #${reqRow.req_no || id} forwarded for approval.`,
          action: "APPROVE",
          senderName: req.user?.name || req.user?.username || "System",
          req: req,
        });
      }
    } catch {}

    res.status(201).json({
      message: "Workflow started",
      instanceId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Candidates
 */
export async function listCandidates(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT c.*, r.title as requisition_title, r.recruitment_type, p.pos_name,
          c.created_at FROM hr_candidates c
       LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
         WHERE c.company_id = :companyId
       ORDER BY c.created_at DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getCandidate(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT c.*, r.title as requisition_title, r.recruitment_type, p.pos_name,
          c.created_at FROM hr_candidates c
       LEFT JOIN hr_job_requisitions r ON r.id = c.requisition_id
       LEFT JOIN hr_positions p ON p.id = r.pos_id
         WHERE c.id = :id AND c.company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Candidate not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveCandidate(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const {
      id,
      first_name,
      last_name,
      email,
      phone,
      resume_url,
      source,
      requisition_id,
      status,
    } = req.body;

    if (id) {
      await query(
        `UPDATE hr_candidates SET first_name = :first_name, last_name = :last_name, 
                email = :email, phone = :phone, resume_url = :resume_url, 
                source = :source, requisition_id = :requisition_id, status = :status
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          first_name,
          last_name,
          email,
          phone,
          resume_url,
          source,
          requisition_id,
          status,
          companyId,
        },
      );
      res.json({ message: "Candidate updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_candidates (company_id, first_name, last_name, email, phone, resume_url, source, requisition_id, status)
         VALUES (:companyId, :first_name, :last_name, :email, :phone, :resume_url, :source, :requisition_id, :status)`,
        {
          companyId,
          first_name,
          last_name,
          email,
          phone,
          resume_url,
          source,
          requisition_id,
          status,
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Candidate created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function savePromotion(req, res, next) {
  try {
    const { companyId = null, userId = null } = req.scope || {};
    const {
      employee_id,
      promotion_date,
      previous_pos_id,
      new_pos_id,
      previous_dept_id,
      new_dept_id,
      previous_location_id,
      new_location_id,
      previous_salary,
      new_salary,
      action_type = "PROMOTION",
      remarks,
    } = req.body;

    try {
      await query(
        `ALTER TABLE hr_promotions ADD COLUMN created_by BIGINT UNSIGNED NULL`,
      );
      await query(
        `ALTER TABLE hr_promotions ADD COLUMN action_type VARCHAR(50) DEFAULT 'PROMOTION'`,
      );
    } catch {}

    const normalizedActionType = String(action_type || "PROMOTION").toUpperCase();

    await query(
      `INSERT INTO hr_promotions (
        company_id, employee_id, promotion_date, 
        previous_pos_id, new_pos_id, 
        previous_dept_id, new_dept_id, 
        previous_location_id, new_location_id,
        previous_salary, new_salary, action_type, remarks, created_by
      ) VALUES (
        :companyId, :employee_id, :promotion_date, 
        :previous_pos_id, :new_pos_id, 
        :previous_dept_id, :new_dept_id,
        :previous_location_id, :new_location_id,
        :previous_salary, :new_salary, :action_type, :remarks, :userId
      )`,
      {
        companyId,
        employee_id,
        promotion_date,
        previous_pos_id: previous_pos_id || null,
        new_pos_id: new_pos_id || null,
        previous_dept_id: previous_dept_id || null,
        new_dept_id: new_dept_id || null,
        previous_location_id: previous_location_id || null,
        new_location_id: new_location_id || null,
        previous_salary: previous_salary || 0,
        new_salary: new_salary || 0,
        action_type: normalizedActionType,
        remarks: remarks || null,
        userId: userId || req.user?.id || null,
      },
    );

    // Update employee record if position, salary, department or location changed
    const updates = [];
    const params = { employee_id, companyId };
    if (new_pos_id) {
      updates.push("pos_id = :new_pos_id");
      params.new_pos_id = new_pos_id;
    }
    if (new_salary) {
      updates.push("base_salary = :new_salary");
      params.new_salary = new_salary;
    }
    if (new_dept_id) {
      updates.push("dept_id = :new_dept_id");
      params.new_dept_id = new_dept_id;
    }
    if (new_location_id) {
      updates.push("location_id = :new_location_id");
      params.new_location_id = new_location_id;
    }

    if (updates.length > 0) {
      await query(
        `UPDATE hr_employees SET ${updates.join(", ")} WHERE id = :employee_id AND company_id = :companyId`,
        params,
      );
    }

    // Fetch employee details, company, and position names to generate and send official letter
    try {
      const [emp] = await query(
        `SELECT e.id, e.first_name, e.last_name, e.email, e.emp_code,
                p1.pos_name AS prev_pos_name,
                p2.pos_name AS new_pos_name,
                d1.dept_name AS prev_dept_name,
                d2.dept_name AS new_dept_name,
                c.name AS company_name
           FROM hr_employees e
           LEFT JOIN hr_positions p1 ON p1.id = :previous_pos_id
           LEFT JOIN hr_positions p2 ON p2.id = :new_pos_id
           LEFT JOIN hr_departments d1 ON d1.id = :previous_dept_id
           LEFT JOIN hr_departments d2 ON d2.id = :new_dept_id
           LEFT JOIN adm_companies c ON c.id = e.company_id
          WHERE e.id = :employee_id`,
        {
          employee_id,
          previous_pos_id: previous_pos_id || null,
          new_pos_id: new_pos_id || null,
          previous_dept_id: previous_dept_id || null,
          new_dept_id: new_dept_id || null,
        },
      );

      const empEmail = String(emp?.email || "").trim();

      if (empEmail) {
        const isReassignment = normalizedActionType === "REASSIGNMENT" || normalizedActionType === "DEMOTION";
        const isTransfer = normalizedActionType === "TRANSFER";
        const isDemotion = isReassignment;
        const companyName = emp.company_name || "OmniSuite";
        const empFullName = `${emp.first_name || ""} ${emp.last_name || ""}`.trim() || "Staff Member";
        const prevRole = emp.prev_pos_name || "Previous Position";
        const newRole = emp.new_pos_name || "New Position";
        const effDate = promotion_date
          ? new Date(promotion_date).toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            })
          : new Date().toLocaleDateString("en-US", {
              year: "numeric",
              month: "long",
              day: "numeric",
            });

        const letterSubject = isDemotion
          ? `Official Notice: Reassignment to ${newRole} - ${companyName}`
          : isTransfer
            ? `Official Notice: Transfer to ${newRole} - ${companyName}`
            : `Congratulations on Your Promotion to ${newRole} - ${companyName}`;

        const headerBg = isDemotion
          ? "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)"
          : isTransfer
            ? "linear-gradient(135deg, #1e293b 0%, #334155 100%)"
            : "linear-gradient(135deg, #065f46 0%, #047857 100%)";

        const badgeText = isDemotion
          ? "ROLE REASSIGNMENT & DEMOTION NOTICE"
          : isTransfer
            ? "LATERAL TRANSFER NOTICE"
            : "OFFICIAL PROMOTION LETTER";

        const introParagraph = isDemotion
          ? `This official letter serves to formally notify you that following recent internal reviews and administrative assessments, your employment role within <strong>${companyName}</strong> has been reassigned to <strong>${newRole}</strong> (transitioning from your previous role of <em>${prevRole}</em>), effective <strong>${effDate}</strong>.`
          : isTransfer
            ? `We write to inform you that your role at <strong>${companyName}</strong> has been realigned to <strong>${newRole}</strong> (transitioning from <em>${prevRole}</em>), effective <strong>${effDate}</strong>.`
            : `On behalf of executive management and the entire team at <strong>${companyName}</strong>, we are delighted to officially congratulate you on your promotion to the position of <strong>${newRole}</strong>, moving upward from your previous role of <em>${prevRole}</em>, effective <strong>${effDate}</strong>!`;

        const remarksBlock = remarks
          ? `<div style="background: #f8fafc; border-left: 4px solid ${isDemotion ? '#ef4444' : '#10b981'}; padding: 12px 16px; margin: 20px 0; font-size: 14px; color: #334155;"><strong>Administrative Notes / Remarks:</strong><br />${remarks}</div>`
          : "";

        const letterHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: ${headerBg}; padding: 32px 28px; text-align: center; color: #ffffff;">
              <span style="display: inline-block; background: rgba(255, 255, 255, 0.2); font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
                ${badgeText}
              </span>
              <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
              <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Human Resources & Talent Management</p>
            </div>

            <div style="padding: 32px 28px; color: #1e293b; line-height: 1.65;">
              <p style="font-size: 15px; margin-top: 0;">Dear <strong>${empFullName}</strong> (Staff ID: <code>${emp.emp_code || "N/A"}</code>),</p>
              
              <p style="font-size: 14px; color: #334155;">
                ${introParagraph}
              </p>

              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 22px 0;">
                <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                  Summary of Assignment
                </div>
                <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                  <tr>
                    <td style="padding: 6px 0; color: #64748b; width: 140px;">Action Type:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: ${isDemotion ? '#b91c1c' : '#047857'};">${normalizedActionType}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Previous Position:</td>
                    <td style="padding: 6px 0; font-weight: 500; color: #475569;">${prevRole}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Assigned Position:</td>
                    <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${newRole}</td>
                  </tr>
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">Effective Date:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${effDate}</td>
                  </tr>
                  ${!isReassignment && new_salary ? `
                  <tr>
                    <td style="padding: 6px 0; color: #64748b;">New Base Salary:</td>
                    <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">GHS ${Number(new_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>` : ""}
                </table>
              </div>

              ${remarksBlock}

              <p style="font-size: 14px; color: #334155; margin-bottom: 24px;">
                ${
                  isDemotion
                    ? "Your supervisor will meet with you to review your updated duties, expectations, and reporting alignment. Please feel free to reach out to the HR department if you have any questions."
                    : "We appreciate your continued commitment to our organizational goals and look forward to your impactful contributions in your new role."
                }
              </p>

              <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #64748b;">
                <p style="margin: 0; font-weight: 600; color: #0f172a;">Human Resources Department</p>
                <p style="margin: 4px 0 0; color: #64748b;">${companyName}</p>
              </div>
            </div>
          </div>
        `;

        await sendMail({
          to: empEmail,
          subject: letterSubject,
          html: letterHtml,
        }).catch((mailErr) => {
          console.warn("Could not dispatch promotion/demotion letter email:", mailErr.message);
        });
      }
    } catch (letterErr) {
      console.error("Error generating/dispatching promotion email letter:", letterErr);
    }

    res.json({ message: "Promotion saved and employee updated" });
  } catch (err) {
    next(err);
  }
}

export async function listPromotions(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT pr.*, e.first_name, e.last_name, e.emp_code, p1.pos_name as previous_pos, p2.pos_name as new_pos,
          u.username as created_by_username, u.username as created_by_name,
          pr.created_at FROM hr_promotions pr
       JOIN hr_employees e ON e.id = pr.employee_id
       LEFT JOIN hr_positions p1 ON p1.id = pr.previous_pos_id
       LEFT JOIN hr_positions p2 ON p2.id = pr.new_pos_id
       LEFT JOIN adm_users u ON u.id = pr.created_by
         WHERE (pr.company_id = :companyId OR pr.company_id IS NULL OR :companyId IS NULL)
       ORDER BY pr.promotion_date DESC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getPromotion(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT pr.*, e.first_name, e.last_name, e.emp_code, p1.pos_name as previous_pos, p2.pos_name as new_pos,
          pr.created_at FROM hr_promotions pr
       JOIN hr_employees e ON e.id = pr.employee_id
       LEFT JOIN hr_positions p1 ON p1.id = pr.previous_pos_id
       LEFT JOIN hr_positions p2 ON p2.id = pr.new_pos_id
         WHERE pr.id = :id AND (pr.company_id = :companyId OR pr.company_id IS NULL OR :companyId IS NULL)`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Promotion not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveInterview(req, res, next) {
  try {
    const {
      id,
      company_id,
      requisition_id,
      candidate_id,
      interviewer_user_id,
      scheduled_at,
      status,
      feedback,
    } = req.body;
    if (id) {
      await query(
        `UPDATE hr_interviews SET interviewer_user_id = :interviewer_user_id, scheduled_at = :scheduled_at, status = :status, feedback = :feedback
         WHERE id = :id`,
        { id, interviewer_user_id, scheduled_at, status, feedback },
      );
      res.json({ message: "Interview updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_interviews (company_id, requisition_id, candidate_id, interviewer_user_id, scheduled_at, status, feedback)
         VALUES (:companyId, :requisition_id, :candidate_id, :interviewer_user_id, :scheduled_at, :status, :feedback)`,
        {
          companyId: company_id || req.scope.companyId,
          requisition_id,
          candidate_id,
          interviewer_user_id,
          scheduled_at,
          status: status || "SCHEDULED",
          feedback: feedback || null,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Interview saved" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listInterviews(req, res, next) {
  try {
    const { requisition_id, candidate_id } = req.query;
    const clauses = [];
    const params = {};
    if (requisition_id) {
      clauses.push("i.requisition_id = :requisition_id");
      params.requisition_id = requisition_id;
    }
    if (candidate_id) {
      clauses.push("i.candidate_id = :candidate_id");
      params.candidate_id = candidate_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT i.*, c.first_name, c.last_name, r.title AS requisition_title,
          i.created_at FROM hr_interviews i
       LEFT JOIN hr_candidates c ON c.id = i.candidate_id
       LEFT JOIN hr_job_requisitions r ON r.id = i.requisition_id
       ${where}
         ORDER BY i.scheduled_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Recruitment - Offers
 */
export async function getOfferById(req, res, next) {
  try {
    const { id } = req.params;
    const { companyId = null } = req.scope || {};
    const [item] = await query(
      `SELECT o.*, c.first_name, c.last_name,
         r.title AS requisition_title, r.id AS requisition_id,
         p.pos_name, p.id AS position_id
         FROM hr_offers o
         LEFT JOIN hr_candidates c ON c.id = o.candidate_id
         LEFT JOIN hr_job_requisitions r ON r.id = o.requisition_id
         LEFT JOIN hr_positions p ON p.id = o.position_id
         WHERE o.id = :id AND o.company_id = :companyId`,
      { id, companyId },
    );
    if (!item) return res.status(404).json({ message: "Offer not found" });
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function saveOffer(req, res, next) {
  try {
    const {
      id,
      company_id,
      requisition_id,
      candidate_id,
      offer_no,
      offer_date,
      position_id,
      gross_salary,
      allowances,
      deductions,
      net_salary,
      status,
      remarks,
    } = req.body;
    if (id) {
      await query(
        `UPDATE hr_offers SET offer_no = :offer_no, offer_date = :offer_date, position_id = :position_id,
                gross_salary = :gross_salary, allowances = :allowances, deductions = :deductions, net_salary = :net_salary,
                status = :status, remarks = :remarks
         WHERE id = :id`,
        {
          id,
          offer_no,
          offer_date,
          position_id,
          gross_salary,
          allowances,
          deductions,
          net_salary,
          status,
          remarks,
        },
      );
      res.json({ message: "Offer updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_offers (company_id, requisition_id, candidate_id, offer_no, offer_date, position_id, gross_salary, allowances, deductions, net_salary, status, remarks)
         VALUES (:company_id, :requisition_id, :candidate_id, :offer_no, :offer_date, :position_id, :gross_salary, :allowances, :deductions, :net_salary, :status, :remarks)`,
        {
          company_id: company_id || req.scope.companyId,
          requisition_id,
          candidate_id,
          offer_no,
          offer_date,
          position_id: position_id || null,
          gross_salary: gross_salary || 0,
          allowances: allowances || 0,
          deductions: deductions || 0,
          net_salary:
            net_salary ||
            (gross_salary || 0) + (allowances || 0) - (deductions || 0),
          status: status || "DRAFT",
          remarks: remarks || null,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Offer created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listOffers(req, res, next) {
  try {
    const { requisition_id, candidate_id } = req.query;
    const clauses = [];
    const params = {};
    if (requisition_id) {
      clauses.push("o.requisition_id = :requisition_id");
      params.requisition_id = requisition_id;
    }
    if (candidate_id) {
      clauses.push("o.candidate_id = :candidate_id");
      params.candidate_id = candidate_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT o.*, c.first_name, c.last_name, r.title AS requisition_title,
          o.created_at FROM hr_offers o
       LEFT JOIN hr_candidates c ON c.id = o.candidate_id
       LEFT JOIN hr_job_requisitions r ON r.id = o.requisition_id
       ${where}
         ORDER BY o.offer_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Attendance APIs
 */
export async function listShifts(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT * FROM hr_shifts
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL) ORDER BY start_time ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveShift(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, code, name, start_time, end_time, break_minutes, is_active } =
      req.body;
    if (id) {
      await query(
        `UPDATE hr_shifts SET code = :code, name = :name, start_time = :start_time, end_time = :end_time, break_minutes = :break_minutes, is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          code,
          name,
          start_time,
          end_time,
          break_minutes: toNumber(break_minutes, 0),
          is_active: is_active ? 1 : 0,
          userId,
          companyId,
        },
      );
      res.json({ message: "Shift updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_shifts (company_id, code, name, start_time, end_time, break_minutes, is_active, created_by)
         VALUES (:companyId, :code, :name, :start_time, :end_time, :break_minutes, 1, :userId)`,
        {
          companyId,
          code,
          name,
          start_time,
          end_time,
          break_minutes: toNumber(break_minutes, 0),
          userId,
        },
      );
      res.status(201).json({ id: result.insertId, message: "Shift created" });
    }
  } catch (err) {
    next(err);
  }
}

function formatDateOnly(d) {
  if (!d) return null;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return String(d).slice(0, 10);
  const year = dt.getFullYear();
  const month = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Synchronize an attendance record (clock-in, clock-out, manual attendance) into hr_timesheets.
 */
export async function syncAttendanceToTimesheet({
  companyId = 1,
  employeeId,
  attendanceDate,
  clockIn = null,
  clockOut = null,
  status = "PRESENT",
  remarks = null,
}) {
  try {
    if (!employeeId || !attendanceDate) return;
    const dateStr = formatDateOnly(attendanceDate);

    const existing = await query(
      `SELECT * FROM hr_timesheets WHERE employee_id = :employeeId AND work_date = :dateStr LIMIT 1`,
      { employeeId, dateStr },
    );

    let timeIn = null;
    let timeOut = null;
    if (clockIn) {
      const dIn = new Date(clockIn);
      timeIn = !isNaN(dIn) ? dIn.toTimeString().slice(0, 8) : String(clockIn).slice(11, 19) || null;
    }
    if (clockOut) {
      const dOut = new Date(clockOut);
      timeOut = !isNaN(dOut) ? dOut.toTimeString().slice(0, 8) : String(clockOut).slice(11, 19) || null;
    }

    const finalTimeIn = timeIn || (existing.length ? existing[0].time_in : null);
    const finalTimeOut = timeOut || (existing.length ? existing[0].time_out : null);

    let hoursWorked = existing.length ? Number(existing[0].hours_worked || 0) : 0;
    let overtimeHours = existing.length ? Number(existing[0].overtime_hours || 0) : 0;
    let shortHours = existing.length ? Number(existing[0].short_hours || 0) : 0;

    if (finalTimeIn && finalTimeOut) {
      const partsIn = String(finalTimeIn).split(":").map(Number);
      const partsOut = String(finalTimeOut).split(":").map(Number);
      const minsIn = partsIn[0] * 60 + (partsIn[1] || 0) + (partsIn[2] || 0) / 60;
      const minsOut = partsOut[0] * 60 + (partsOut[1] || 0) + (partsOut[2] || 0) / 60;
      let diffHours = (minsOut - minsIn) / 60;
      if (diffHours < 0) diffHours += 24;
      const regularHours = 8;
      hoursWorked = Math.round(Math.min(diffHours, regularHours) * 100) / 100;
      overtimeHours = Math.round(Math.max(0, diffHours - regularHours) * 100) / 100;
      shortHours = Math.round(Math.max(0, regularHours - diffHours) * 100) / 100;
    }

    const finalRemarks = remarks || (status === "ON_LEAVE" ? "On Leave" : status === "ABSENT" ? "Absent" : (existing.length ? existing[0].remarks : null));

    if (existing.length) {
      await query(
        `UPDATE hr_timesheets
         SET time_in = COALESCE(:finalTimeIn, time_in),
             time_out = COALESCE(:finalTimeOut, time_out),
             hours_worked = :hoursWorked,
             overtime_hours = :overtimeHours,
             short_hours = :shortHours,
             remarks = COALESCE(:finalRemarks, remarks)
         WHERE id = :id`,
        {
          id: existing[0].id,
          finalTimeIn,
          finalTimeOut,
          hoursWorked,
          overtimeHours,
          shortHours,
          finalRemarks,
        },
      );
    } else {
      await query(
        `INSERT INTO hr_timesheets (company_id, employee_id, work_date, time_in, time_out, hours_worked, overtime_hours, short_hours, remarks)
         VALUES (:companyId, :employeeId, :dateStr, :finalTimeIn, :finalTimeOut, :hoursWorked, :overtimeHours, :shortHours, :finalRemarks)
         ON DUPLICATE KEY UPDATE
           time_in = COALESCE(VALUES(time_in), time_in),
           time_out = COALESCE(VALUES(time_out), time_out),
           hours_worked = VALUES(hours_worked),
           overtime_hours = VALUES(overtime_hours),
           short_hours = VALUES(short_hours),
           remarks = COALESCE(VALUES(remarks), remarks)`,
        {
          companyId: companyId || 1,
          employeeId,
          dateStr,
          finalTimeIn,
          finalTimeOut,
          hoursWorked,
          overtimeHours,
          shortHours,
          finalRemarks,
        },
      );
    }
  } catch (err) {
    console.error("[syncAttendanceToTimesheet] error:", err.message);
  }
}

/**
 * Synchronize a timesheet record into hr_attendance.
 */
export async function syncTimesheetToAttendance({
  companyId = 1,
  employeeId,
  workDate,
  timeIn = null,
  timeOut = null,
  hoursWorked = 0,
  overtimeHours = 0,
  shortHours = 0,
  remarks = null,
  locationGps = null,
  faceVerified = null,
  faceConfidence = null,
  capturedFacePhoto = null,
  fingerprintVerified = null,
  fingerprintConfidence = null,
  biometricType = null,
}) {
  try {
    if (!employeeId || !workDate) return;
    const dateStr = formatDateOnly(workDate);

    const existing = await query(
      `SELECT * FROM hr_attendance WHERE employee_id = :employeeId AND attendance_date = :dateStr LIMIT 1`,
      { employeeId, dateStr },
    );

    let clockIn = null;
    let clockOut = null;
    if (timeIn) {
      const cleanTime = String(timeIn).trim();
      clockIn = `${dateStr} ${cleanTime.length === 5 ? cleanTime + ":00" : cleanTime}`;
    }
    if (timeOut) {
      const cleanTime = String(timeOut).trim();
      clockOut = `${dateStr} ${cleanTime.length === 5 ? cleanTime + ":00" : cleanTime}`;
    }

    const finalClockIn = clockIn || (existing.length ? existing[0].clock_in : null);
    const finalClockOut = clockOut || (existing.length ? existing[0].clock_out : null);

    let status = existing.length ? existing[0].status : "PRESENT";
    if (remarks && remarks.toLowerCase().includes("leave")) {
      status = "ON_LEAVE";
    } else if (remarks && remarks.toLowerCase().includes("absent")) {
      status = "ABSENT";
    } else if (finalClockIn || Number(hoursWorked) > 0) {
      status = "PRESENT";
    }

    const overtimeMinutes = Math.round(Number(overtimeHours || 0) * 60);
    const finalRemarks = remarks || (existing.length ? existing[0].remarks : null);

    if (existing.length) {
      await query(
        `UPDATE hr_attendance
         SET clock_in = COALESCE(:finalClockIn, clock_in),
             clock_out = COALESCE(:finalClockOut, clock_out),
             status = :status,
             overtime_minutes = :overtimeMinutes,
             remarks = COALESCE(:finalRemarks, remarks)
         WHERE id = :id`,
        {
          id: existing[0].id,
          finalClockIn,
          finalClockOut,
          status,
          overtimeMinutes,
          finalRemarks,
          faceVerified: faceVerified !== null ? (faceVerified ? 1 : 0) : null,
          faceConfidence: faceConfidence !== null && faceConfidence !== undefined ? Number(faceConfidence) : null,
          capturedFacePhoto: capturedFacePhoto || null,
          fingerprintVerified: fingerprintVerified !== null ? (fingerprintVerified ? 1 : 0) : null,
          fingerprintConfidence: fingerprintConfidence !== null && fingerprintConfidence !== undefined ? Number(fingerprintConfidence) : null,
          biometricType: biometricType || null,
        },
      );
    } else {
      await query(
        `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_in, clock_out, status, overtime_minutes, remarks, face_verified, face_confidence, captured_face_photo, fingerprint_verified, fingerprint_confidence, biometric_type)
         VALUES (:companyId, :employeeId, :dateStr, :finalClockIn, :finalClockOut, :status, :overtimeMinutes, :finalRemarks, :faceVerified, :faceConfidence, :capturedFacePhoto, :fingerprintVerified, :fingerprintConfidence, :biometricType)
         ON DUPLICATE KEY UPDATE
           clock_in = COALESCE(VALUES(clock_in), clock_in),
           clock_out = COALESCE(VALUES(clock_out), clock_out),
           status = VALUES(status),
           overtime_minutes = VALUES(overtime_minutes),
           remarks = COALESCE(VALUES(remarks), remarks),
           face_verified = COALESCE(VALUES(face_verified), face_verified),
           face_confidence = COALESCE(VALUES(face_confidence), face_confidence),
           captured_face_photo = COALESCE(VALUES(captured_face_photo), captured_face_photo),
           fingerprint_verified = COALESCE(VALUES(fingerprint_verified), fingerprint_verified),
           fingerprint_confidence = COALESCE(VALUES(fingerprint_confidence), fingerprint_confidence),
           biometric_type = COALESCE(VALUES(biometric_type), biometric_type)`,
        {
          companyId: companyId || 1,
          employeeId,
          dateStr,
          finalClockIn,
          finalClockOut,
          status,
          overtimeMinutes,
          finalRemarks,
          faceVerified: faceVerified ? 1 : 0,
          faceConfidence: faceConfidence !== null && faceConfidence !== undefined ? Number(faceConfidence) : null,
          capturedFacePhoto: capturedFacePhoto || null,
          fingerprintVerified: fingerprintVerified ? 1 : 0,
          fingerprintConfidence: fingerprintConfidence !== null && fingerprintConfidence !== undefined ? Number(fingerprintConfidence) : null,
          biometricType: biometricType || 'NONE',
        },
      );
    }
  } catch (err) {
    console.error("[syncTimesheetToAttendance] error:", err.message);
  }
}

/**
 * Backfill bi-directional synchronization between hr_attendance and hr_timesheets.
 */
export async function syncAllAttendanceAndTimesheets() {
  try {
    const attendanceRecords = await query(`
      SELECT a.* FROM hr_attendance a
      LEFT JOIN hr_timesheets t ON a.employee_id = t.employee_id AND a.attendance_date = t.work_date
      WHERE t.id IS NULL
    `);
    for (const a of attendanceRecords) {
      await syncAttendanceToTimesheet({
        companyId: a.company_id,
        employeeId: a.employee_id,
        attendanceDate: a.attendance_date,
        clockIn: a.clock_in,
        clockOut: a.clock_out,
        status: a.status,
        remarks: a.remarks,
      });
    }

    const timesheetRecords = await query(`
      SELECT t.* FROM hr_timesheets t
      LEFT JOIN hr_attendance a ON t.employee_id = a.employee_id AND t.work_date = a.attendance_date
      WHERE a.id IS NULL
    `);
    for (const t of timesheetRecords) {
      await syncTimesheetToAttendance({
        companyId: t.company_id,
        employeeId: t.employee_id,
        workDate: t.work_date,
        timeIn: t.time_in,
        timeOut: t.time_out,
        hoursWorked: t.hours_worked,
        overtimeHours: t.overtime_hours,
        shortHours: t.short_hours,
        remarks: t.remarks,
        locationGps: t.location_gps,
      });
    }
  } catch (err) {
    console.error("[syncAllAttendanceAndTimesheets] error:", err.message);
  }
}

export async function clockIn(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const employee_id = toNumber(req.body.employee_id, null);
    const attendance_date =
      req.body.attendance_date || new Date().toISOString().slice(0, 10);
    if (!employee_id)
      throw httpError(400, "BAD_REQUEST", "employee_id required");

    const existing = await query(
      `SELECT id, clock_in
         FROM hr_attendance
         WHERE employee_id = :employee_id AND attendance_date = :attendance_date`,
      { employee_id, attendance_date },
    );
    if (existing.length && existing[0].clock_in) {
      return res.json({ id: existing[0].id, message: "Already clocked in" });
    }
    let attendanceId = null;
    if (existing.length) {
      attendanceId = existing[0].id;
      await query(
        `UPDATE hr_attendance SET clock_in = NOW(), status = 'PRESENT' WHERE id = :id`,
        { id: existing[0].id },
      );
    } else {
      const result = await query(
        `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_in, status)
         VALUES (:companyId, :employee_id, :attendance_date, NOW(), 'PRESENT')`,
        { companyId, employee_id, attendance_date },
      );
      attendanceId = result.insertId;
    }

    // Sync to timesheets
    const attRow = await query(`SELECT * FROM hr_attendance WHERE id = :id`, { id: attendanceId });
    if (attRow.length) {
      await syncAttendanceToTimesheet({
        companyId: attRow[0].company_id || companyId,
        employeeId: attRow[0].employee_id,
        attendanceDate: attRow[0].attendance_date,
        clockIn: attRow[0].clock_in,
        clockOut: attRow[0].clock_out,
        status: attRow[0].status,
        remarks: attRow[0].remarks,
      });
    }

    return res.status(existing.length ? 200 : 201).json({ id: attendanceId, message: existing.length ? "Clock-in updated" : "Clocked in" });
  } catch (err) {
    next(err);
  }
}

export async function clockOut(req, res, next) {
  try {
    const employee_id = toNumber(req.body.employee_id, null);
    const attendance_date =
      req.body.attendance_date || new Date().toISOString().slice(0, 10);
    if (!employee_id)
      throw httpError(400, "BAD_REQUEST", "employee_id required");
    const rows = await query(
      `SELECT id, clock_in
         FROM hr_attendance
         WHERE employee_id = :employee_id AND attendance_date = :attendance_date`,
      { employee_id, attendance_date },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Attendance not found");
    await query(`UPDATE hr_attendance SET clock_out = NOW() WHERE id = :id`, {
      id: rows[0].id,
    });

    // Sync to timesheets
    const attRow = await query(`SELECT * FROM hr_attendance WHERE id = :id`, { id: rows[0].id });
    if (attRow.length) {
      await syncAttendanceToTimesheet({
        companyId: attRow[0].company_id,
        employeeId: attRow[0].employee_id,
        attendanceDate: attRow[0].attendance_date,
        clockIn: attRow[0].clock_in,
        clockOut: attRow[0].clock_out,
        status: attRow[0].status,
        remarks: attRow[0].remarks,
      });
    }

    res.json({ id: rows[0].id, message: "Clocked out" });
  } catch (err) {
    next(err);
  }
}

export async function listAttendance(req, res, next) {
  try {
    await ensureHRTables();
    const { employee_id, from_date, to_date } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id && employee_id !== "undefined" && employee_id !== "null") {
      clauses.push("a.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    if (from_date && from_date !== "undefined") {
      clauses.push("a.attendance_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date && to_date !== "undefined") {
      clauses.push("a.attendance_date <= :to_date");
      params.to_date = to_date;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    let items = [];
    try {
      items = await query(
        `SELECT a.*, e.first_name, e.last_name, e.emp_code
           FROM hr_attendance a
         LEFT JOIN hr_employees e ON e.id = a.employee_id
         ${where}
           ORDER BY a.attendance_date DESC`,
        params,
      );
    } catch (e) {
      items = [];
    }
    res.json({ items: items || [] });
  } catch (err) {
    res.json({ items: [] });
  }
}

export async function getAttendance(req, res, next) {
  try {
    await ensureHRTables();
    const id = toNumber(req.params.id, null);
    const rows = await query(
      `SELECT a.*, e.first_name, e.last_name, e.emp_code, CONCAT(COALESCE(e.first_name,''), ' ', COALESCE(e.last_name,'')) as full_name
       FROM hr_attendance a
       LEFT JOIN hr_employees e ON e.id = a.employee_id
       WHERE a.id = :id`,
      { id },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Attendance record not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveAttendance(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const {
      id,
      employee_id,
      attendance_date,
      status,
      clock_in,
      clock_out,
      remarks,
    } = req.body;
    const empId = toNumber(employee_id, null);
    if (!empId) throw httpError(400, "BAD_REQUEST", "Employee is required");

    const params = {
      companyId,
      employee_id: empId,
      attendance_date: attendance_date || new Date().toISOString().slice(0, 10),
      status: status || "PRESENT",
      clock_in: clock_in || null,
      clock_out: clock_out || null,
      remarks: remarks || null,
    };

    let savedId = id ? toNumber(id, null) : null;
    if (id) {
      await query(
        `UPDATE hr_attendance SET employee_id = :employee_id, attendance_date = :attendance_date,
                status = :status, clock_in = :clock_in, clock_out = :clock_out, remarks = :remarks
         WHERE id = :id`,
        { ...params, id: savedId },
      );
    } else {
      const result = await query(
        `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, status, clock_in, clock_out, remarks)
         VALUES (:companyId, :employee_id, :attendance_date, :status, :clock_in, :clock_out, :remarks)
         ON DUPLICATE KEY UPDATE status = VALUES(status), clock_in = VALUES(clock_in), clock_out = VALUES(clock_out), remarks = VALUES(remarks)`,
        params,
      );
      savedId = result.insertId;
    }

    // Sync to timesheets
    await syncAttendanceToTimesheet({
      companyId: params.companyId,
      employeeId: params.employee_id,
      attendanceDate: params.attendance_date,
      clockIn: params.clock_in,
      clockOut: params.clock_out,
      status: params.status,
      remarks: params.remarks,
    });

    if (id) {
      res.json({ message: "Attendance updated" });
    } else {
      res.status(201).json({ id: savedId, message: "Attendance saved" });
    }
  } catch (err) {
    next(err);
  }
}

export async function saveBulkAttendance(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { date, attendance } = req.body; // attendance is an array of { employee_id, status, clock_in, clock_out, remarks }

    if (!date || !Array.isArray(attendance)) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
    }

    for (const item of attendance) {
      await query(
        `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, status, clock_in, clock_out, remarks)
         VALUES (:companyId, :employeeId, :date, :status, :clockIn, :clockOut, :remarks)
         ON DUPLICATE KEY UPDATE status = VALUES(status), clock_in = VALUES(clock_in), clock_out = VALUES(clock_out), remarks = VALUES(remarks)`,
        {
          companyId,
          employeeId: item.employee_id,
          date,
          status: item.status || "PRESENT",
          clockIn: item.clock_in || null,
          clockOut: item.clock_out || null,
          remarks: item.remarks || null,
        },
      );
      await syncAttendanceToTimesheet({
        companyId,
        employeeId: item.employee_id,
        attendanceDate: date,
        clockIn: item.clock_in || null,
        clockOut: item.clock_out || null,
        status: item.status || "PRESENT",
        remarks: item.remarks || null,
      });
    }

    res.json({ message: "Bulk attendance saved successfully" });
  } catch (err) {
    next(err);
  }
}

export async function saveTimesheet(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const {
      employee_id,
      work_date,
      hours_worked,
      overtime_hours,
      short_hours,
      remarks,
      time_in,
      time_out,
      location_gps,
      face_verified = 0,
      face_confidence = null,
      captured_face_photo = null,
      fingerprint_verified = 0,
      fingerprint_confidence = null,
      biometric_type = 'NONE',
    } = req.body;
    const existing = await query(
      `SELECT id,
          created_at FROM hr_timesheets
         WHERE employee_id = :employee_id AND work_date = :work_date`,
      { employee_id, work_date },
    );
    let timesheetId = null;
    if (existing.length) {
      timesheetId = existing[0].id;
      await query(
        `UPDATE hr_timesheets SET hours_worked = :hours_worked, overtime_hours = :overtime_hours, short_hours = :short_hours, remarks = :remarks, time_in = :time_in, time_out = :time_out, location_gps = :location_gps,
         face_verified = :face_verified, face_confidence = :face_confidence, captured_face_photo = COALESCE(:captured_face_photo, captured_face_photo),
         fingerprint_verified = :fingerprint_verified, fingerprint_confidence = :fingerprint_confidence, biometric_type = :biometric_type
         WHERE id = :id`,
        {
          id: existing[0].id,
          hours_worked: toNumber(hours_worked, 0),
          overtime_hours: toNumber(overtime_hours, 0),
          short_hours: toNumber(short_hours, 0),
          remarks: remarks || null,
          time_in: time_in || null,
          time_out: time_out || null,
          location_gps: location_gps || null,
          face_verified: face_verified ? 1 : 0,
          face_confidence: face_confidence !== null && face_confidence !== undefined ? Number(face_confidence) : null,
          captured_face_photo: captured_face_photo || null,
          fingerprint_verified: fingerprint_verified ? 1 : 0,
          fingerprint_confidence: fingerprint_confidence !== null && fingerprint_confidence !== undefined ? Number(fingerprint_confidence) : null,
          biometric_type: biometric_type || 'NONE',
        },
      );
    } else {
      const result = await query(
        `INSERT INTO hr_timesheets (company_id, employee_id, work_date, hours_worked, overtime_hours, short_hours, remarks, time_in, time_out, location_gps, face_verified, face_confidence, captured_face_photo, fingerprint_verified, fingerprint_confidence, biometric_type)
         VALUES (:companyId, :employee_id, :work_date, :hours_worked, :overtime_hours, :short_hours, :remarks, :time_in, :time_out, :location_gps, :face_verified, :face_confidence, :captured_face_photo, :fingerprint_verified, :fingerprint_confidence, :biometric_type)`,
        {
          companyId,
          employee_id,
          work_date,
          hours_worked: toNumber(hours_worked, 0),
          overtime_hours: toNumber(overtime_hours, 0),
          short_hours: toNumber(short_hours, 0),
          remarks: remarks || null,
          time_in: time_in || null,
          time_out: time_out || null,
          location_gps: location_gps || null,
          face_verified: face_verified ? 1 : 0,
          face_confidence: face_confidence !== null && face_confidence !== undefined ? Number(face_confidence) : null,
          captured_face_photo: captured_face_photo || null,
          fingerprint_verified: fingerprint_verified ? 1 : 0,
          fingerprint_confidence: fingerprint_confidence !== null && fingerprint_confidence !== undefined ? Number(fingerprint_confidence) : null,
          biometric_type: biometric_type || 'NONE',
        },
      );
      timesheetId = result.insertId;
    }

    // Sync to hr_attendance
    await syncTimesheetToAttendance({
      companyId,
      employeeId: employee_id,
      workDate: work_date,
      timeIn: time_in,
      timeOut: time_out,
      hoursWorked: hours_worked,
      overtimeHours: overtime_hours,
      shortHours: short_hours,
      remarks,
      locationGps: location_gps,
      faceVerified: face_verified ? 1 : 0,
      faceConfidence: face_confidence,
      capturedFacePhoto: captured_face_photo,
      fingerprintVerified: fingerprint_verified ? 1 : 0,
      fingerprintConfidence: fingerprint_confidence,
      biometricType: biometric_type || (face_verified && fingerprint_verified ? 'BOTH' : face_verified ? 'FACE' : fingerprint_verified ? 'FINGERPRINT' : 'NONE'),
    });

    if (existing.length) {
      return res.json({ id: timesheetId, message: "Timesheet updated" });
    }
    res.status(201).json({ id: timesheetId, message: "Timesheet saved" });
  } catch (err) {
    next(err);
  }
}

export async function listTimesheets(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = 1,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { employee_id, from_date, to_date } = req.query;
    const clauses = [];
    const params = {};

    if (employee_id && employee_id !== "undefined" && employee_id !== "null") {
      clauses.push("t.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    if (from_date && from_date !== "undefined") {
      clauses.push("t.work_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date && to_date !== "undefined") {
      clauses.push("t.work_date <= :to_date");
      params.to_date = to_date;
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    let items = [];
    try {
      items = await query(
        `SELECT t.*, e.first_name, e.last_name, e.emp_code,
            t.created_at FROM hr_timesheets t
         LEFT JOIN hr_employees e ON e.id = t.employee_id
         ${where}
           ORDER BY t.work_date DESC`,
        params,
      );
    } catch {
      items = [];
    }
    res.json({ items: items || [] });
  } catch (err) {
    res.json({ items: [] });
  }
}

export async function biometricWebhook(req, res, next) {
  try {
    const { employee_code, event_type, event_time } = req.body;
    const rows = await query(
      `SELECT id,
          created_at FROM hr_employees
         WHERE emp_code = :code LIMIT 1`,
      { code: employee_code },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Employee not found");
    const employee_id = rows[0].id;
    const dateStr = (event_time || new Date().toISOString()).slice(0, 10);
    const exist = await query(
      `SELECT id, clock_in, clock_out
         FROM hr_attendance
         WHERE employee_id = :eid AND attendance_date = :d`,
      { eid: employee_id, d: dateStr },
    );
    if (String(event_type || "").toUpperCase() === "IN") {
      if (exist.length) {
        await query(
          `UPDATE hr_attendance SET clock_in = :t, status = 'PRESENT' WHERE id = :id`,
          { t: event_time || new Date().toISOString(), id: exist[0].id },
        );
      } else {
        await query(
          `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_in, status)
           VALUES (:companyId, :eid, :date, :t, 'PRESENT')`,
          {
            companyId: req.scope.companyId,
            eid: employee_id,
            date: dateStr,
            t: event_time || new Date().toISOString(),
          },
        );
      }
    } else if (String(event_type || "").toUpperCase() === "OUT") {
      if (exist.length) {
        await query(`UPDATE hr_attendance SET clock_out = :t WHERE id = :id`, {
          t: event_time || new Date().toISOString(),
          id: exist[0].id,
        });
      } else {
        await query(
          `INSERT INTO hr_attendance (company_id, employee_id, attendance_date, clock_out, status)
           VALUES (:companyId, :eid, :date, :t, 'PRESENT')`,
          {
            companyId: req.scope.companyId,
            eid: employee_id,
            date: dateStr,
            t: event_time || new Date().toISOString(),
          },
        );
      }
    }

    const attRec = await query(
      `SELECT * FROM hr_attendance WHERE employee_id = :eid AND attendance_date = :d LIMIT 1`,
      { eid: employee_id, d: dateStr },
    );
    if (attRec.length) {
      await syncAttendanceToTimesheet({
        companyId: attRec[0].company_id || req.scope?.companyId || 1,
        employeeId: attRec[0].employee_id,
        attendanceDate: attRec[0].attendance_date,
        clockIn: attRec[0].clock_in,
        clockOut: attRec[0].clock_out,
        status: attRec[0].status,
        remarks: attRec[0].remarks,
      });
    }

    res.json({ message: "Recorded" });
  } catch (err) {
    next(err);
  }
}
/**
 * Payroll APIs
 */
export async function listPayrollPeriods(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const { year } = req.query;

    const clauses = ["company_id = :companyId"];
    const params = { companyId };

    if (year) {
      clauses.push("(YEAR(start_date) = :year OR period_name LIKE :yearPattern)");
      params.year = Number(year);
      params.yearPattern = `%${year}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT *
         FROM hr_payroll_periods
         ${where}
         ORDER BY start_date DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function savePayrollPeriod(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const { id, period_name, start_date, end_date, status } = req.body;
    if (id) {
      await query(
        `UPDATE hr_payroll_periods SET period_name = :period_name, start_date = :start_date, end_date = :end_date, status = :status
         WHERE id = :id AND company_id = :companyId`,
        { id, period_name, start_date, end_date, status, companyId },
      );
      res.json({ message: "Payroll period updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_payroll_periods (company_id, period_name, start_date, end_date, status)
         VALUES (:companyId, :period_name, :start_date, :end_date, :status)`,
        {
          companyId,
          period_name,
          start_date,
          end_date,
          status: status || "OPEN",
        },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Payroll period created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function listPayrollManualComponents(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const periodId = toNumber(req.query.period_id, null);
    if (!periodId)
      throw httpError(400, "BAD_REQUEST", "Select a payroll period");
    const periods = await query(
      `SELECT id, period_name, status FROM hr_payroll_periods WHERE id = :periodId AND company_id = :companyId LIMIT 1`,
      { periodId, companyId },
    );
    if (!periods.length)
      throw httpError(404, "NOT_FOUND", "Payroll period not found");
    const items = await query(
      `SELECT e.id AS employee_id, e.emp_code, e.first_name, e.last_name,
              d.id AS definition_id, d.component_name, d.component_type,
              COALESCE(m.amount, 0) AS amount,
              COALESCE(s.is_selected, m.id IS NOT NULL, 0) AS is_selected
         FROM hr_employees e
         JOIN hr_salary_component_definitions d ON d.company_id = e.company_id
           AND d.is_active = 1 AND d.manual_calculation = 1
         LEFT JOIN hr_payroll_manual_components m ON m.company_id = e.company_id
           AND m.period_id = :periodId AND m.employee_id = e.id AND m.definition_id = d.id
         LEFT JOIN hr_payroll_manual_component_selections s ON s.company_id = e.company_id
           AND s.period_id = :periodId AND s.employee_id = e.id AND s.definition_id = d.id
        WHERE e.company_id = :companyId AND e.status = 'ACTIVE' AND e.deleted_at IS NULL
        ORDER BY e.first_name, e.last_name, d.component_name`,
      { companyId, periodId },
    );
    res.json({ period: periods[0], items });
  } catch (err) {
    next(err);
  }
}

export async function savePayrollManualComponents(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const periodId = toNumber(req.body?.period_id, null);
    const entries = req.body?.items;
    const selections = req.body?.selections;
    if (
      !periodId ||
      !Array.isArray(entries) ||
      !Array.isArray(selections) ||
      entries.length > 10000 ||
      selections.length > 10000
    ) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "A payroll period and valid component rows are required",
      );
    }
    const periods = await query(
      `SELECT id, status FROM hr_payroll_periods WHERE id = :periodId AND company_id = :companyId LIMIT 1`,
      { periodId, companyId },
    );
    if (!periods.length)
      throw httpError(404, "NOT_FOUND", "Payroll period not found");
    if (periods[0].status === "CLOSED") {
      throw httpError(
        409,
        "CONFLICT",
        "Manual payroll amounts cannot be changed for a closed period",
      );
    }
    for (const selection of selections) {
      const employeeId = toNumber(selection?.employee_id, null);
      const definitionId = toNumber(selection?.definition_id, null);
      const selected = selection?.is_selected ? 1 : 0;
      if (!employeeId || !definitionId) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Select a valid employee and component",
        );
      }
      const [employee, definition] = await Promise.all([
        query(
          `SELECT id FROM hr_employees WHERE id = :employeeId AND company_id = :companyId AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1`,
          { employeeId, companyId },
        ),
        query(
          `SELECT id FROM hr_salary_component_definitions WHERE id = :definitionId AND company_id = :companyId AND is_active = 1 AND manual_calculation = 1 LIMIT 1`,
          { definitionId, companyId },
        ),
      ]);
      if (!employee.length || !definition.length) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Select a valid active employee and manual component",
        );
      }
      await query(
        `INSERT INTO hr_payroll_manual_component_selections (company_id, period_id, employee_id, definition_id, is_selected, created_by)
         VALUES (:companyId, :periodId, :employeeId, :definitionId, :selected, :userId)
         ON DUPLICATE KEY UPDATE is_selected = VALUES(is_selected), created_by = VALUES(created_by), updated_at = CURRENT_TIMESTAMP`,
        { companyId, periodId, employeeId, definitionId, selected, userId },
      );
    }
    for (const entry of entries) {
      const employeeId = toNumber(entry?.employee_id, null);
      const definitionId = toNumber(entry?.definition_id, null);
      const amount = Number(entry?.amount);
      if (
        !employeeId ||
        !definitionId ||
        !Number.isFinite(amount) ||
        amount < 0
      ) {
        throw httpError(
          400,
          "BAD_REQUEST",
          "Manual component amounts must be valid non-negative numbers",
        );
      }
      const [employee, definition, selection] = await Promise.all([
        query(
          `SELECT id FROM hr_employees WHERE id = :employeeId AND company_id = :companyId AND status = 'ACTIVE' AND deleted_at IS NULL LIMIT 1`,
          { companyId, employeeId },
        ),
        query(
          `SELECT id FROM hr_salary_component_definitions WHERE id = :definitionId AND company_id = :companyId AND is_active = 1 AND manual_calculation = 1 LIMIT 1`,
          { companyId, definitionId },
        ),
        query(
          `SELECT is_selected FROM hr_payroll_manual_component_selections WHERE company_id = :companyId AND period_id = :periodId AND employee_id = :employeeId AND definition_id = :definitionId LIMIT 1`,
          { companyId, periodId, employeeId, definitionId },
        ),
      ]);
      if (
        !employee.length ||
        !definition.length ||
        !selection.length ||
        !Number(selection[0].is_selected)
      )
        throw httpError(
          400,
          "BAD_REQUEST",
          "Select an active employee and component for this payroll period",
        );
      await query(
        `INSERT INTO hr_payroll_manual_components (company_id, period_id, employee_id, definition_id, amount, updated_by)
         VALUES (:companyId, :periodId, :employeeId, :definitionId, :amount, :userId)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_by = VALUES(updated_by), updated_at = CURRENT_TIMESTAMP`,
        { companyId, periodId, employeeId, definitionId, amount, userId },
      );
    }
    res.json({
      message: "Monthly payroll component amounts saved",
      count: entries.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Register (upsert) a salary component into hr_salary_components.
 * Safe to call multiple times — uses INSERT … ON DUPLICATE KEY UPDATE.
 */
async function registerSalaryComponent(
  companyId,
  {
    column_name,
    label,
    component_type = "OTHER",
    display_order = 0,
    is_earning = 0,
    is_fixed = 0,
    source_type = "NONE",
    source_id = null,
  },
) {
  try {
    await query(
      `INSERT INTO hr_salary_components
         (company_id, column_name, label, component_type, display_order, is_earning, is_fixed, source_type, source_id)
       VALUES
         (:companyId, :column_name, :label, :component_type, :display_order, :is_earning, :is_fixed, :source_type, :source_id)
       ON DUPLICATE KEY UPDATE
         label        = VALUES(label),
         component_type = VALUES(component_type),
         display_order  = VALUES(display_order),
         is_earning     = VALUES(is_earning),
         is_fixed       = VALUES(is_fixed),
         source_type    = VALUES(source_type),
         source_id      = VALUES(source_id),
         updated_at     = CURRENT_TIMESTAMP`,
      {
        companyId,
        column_name,
        label,
        component_type,
        display_order,
        is_earning,
        is_fixed,
        source_type,
        source_id,
      },
    );
  } catch {
    // non-fatal
  }
}

/**
 * Ensure the fixed / always-present salary component rows exist for a company.
 */
async function seedFixedSalaryComponents(companyId) {
  const fixed = [
    {
      column_name: "basic_salary",
      label: "Basic Salary",
      component_type: "BASIC",
      display_order: 10,
      is_earning: 1,
    },
    {
      column_name: "allowances",
      label: "Total Allowances",
      component_type: "ALLOWANCE",
      display_order: 20,
      is_earning: 1,
    },
    {
      column_name: "subtotal_a",
      label: "Subtotal A (Basic – SSF)",
      component_type: "SUBTOTAL",
      display_order: 30,
      is_earning: 0,
    },
    {
      column_name: "subtotal_b",
      label: "Subtotal B (A + Allowances)",
      component_type: "SUBTOTAL",
      display_order: 40,
      is_earning: 0,
    },
    {
      column_name: "ssf_employee",
      label: "Social Security Fund (Employee 5.5%)",
      component_type: "SOCIAL_SECURITY",
      display_order: 50,
      is_earning: 0,
    },
    {
      column_name: "ssf_employer",
      label: "Social Security Fund (Employer 13.0%)",
      component_type: "SOCIAL_SECURITY",
      display_order: 52,
      is_earning: 0,
    },
    {
      column_name: "ssnit",
      label: "SSNIT Payable (First Tier Remittance)",
      component_type: "SOCIAL_SECURITY",
      display_order: 54,
      is_earning: 0,
    },
    {
      column_name: "tier2",
      label: "Tier 2 Occupational Pension Payable (5.0%)",
      component_type: "PROVIDENT_FUND",
      display_order: 56,
      is_earning: 0,
    },
    {
      column_name: "tier3_employee",
      label: "Tier 3 Provident Fund (Employee)",
      component_type: "PROVIDENT_FUND",
      display_order: 60,
      is_earning: 0,
    },
    {
      column_name: "tier3_tax_exempt",
      label: "Provident fund (Tax Exempt)",
      component_type: "PROVIDENT_FUND",
      display_order: 61,
      is_earning: 0,
    },
    {
      column_name: "tier3_taxable_excess",
      label: "Provident fund (Taxable Excess)",
      component_type: "PROVIDENT_FUND",
      display_order: 62,
      is_earning: 0,
    },
    {
      column_name: "tier3_employer",
      label: "Tier 3 Provident Fund (Employer)",
      component_type: "PROVIDENT_FUND",
      display_order: 65,
      is_earning: 0,
    },
    {
      column_name: "tax_relief",
      label: "Tax Relief",
      component_type: "TAX_RELIEF",
      display_order: 68,
      is_earning: 0,
    },
    {
      column_name: "income_tax",
      label: "Income Tax (PAYE)",
      component_type: "INCOME_TAX",
      display_order: 70,
      is_earning: 0,
    },
    {
      column_name: "deductions",
      label: "Total Deductions",
      component_type: "DEDUCTION",
      display_order: 80,
      is_earning: 0,
    },
    {
      column_name: "loan_deductions_total",
      label: "Staff Loan Deductions",
      component_type: "DEDUCTION",
      display_order: 85,
      is_earning: 0,
    },
    {
      column_name: "net_salary",
      label: "Net Salary Payable",
      component_type: "NET_SALARY",
      display_order: 99,
      is_earning: 0,
    },
  ];
  for (const row of fixed) {
    await registerSalaryComponent(companyId, {
      ...row,
      is_fixed: 1,
      source_type: "NONE",
      source_id: null,
    });
  }
}

export async function generatePayroll(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null, userId = null } = req.scope || {};
    const effectiveUserId = toNumber(userId || req.user?.id || req.user?.sub, null) || 1;
    const { period_id } = req.body;
    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");
    const [period] = await query(
      `SELECT *,
          created_at FROM hr_payroll_periods
         WHERE id = :id AND company_id = :companyId`,
      { id: period_id, companyId },
    );
    if (!period) throw httpError(404, "NOT_FOUND", "Payroll period not found");

    let periodMonth = "";
    if (period.start_date) {
      const pDate = new Date(period.start_date);
      if (!isNaN(pDate.getTime())) {
        periodMonth = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, "0")}`;
      }
    }
    const periodEndDate = period.end_date
      ? new Date(period.end_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    // Seed / refresh fixed salary component registry for this company
    await seedFixedSalaryComponents(companyId);

    const existing = await query(
      `SELECT id, status,
          created_at FROM hr_payroll
         WHERE company_id = :companyId AND period_id = :period_id`,
      { companyId, period_id },
    );
    let payrollId = null;
    if (existing.length) {
      payrollId = existing[0].id;
      await query(
        `UPDATE hr_payroll SET status = 'OPEN', generated_at = NOW() WHERE id = :id`,
        { id: payrollId },
      );
      await query(`DELETE FROM hr_payroll_items WHERE payroll_id = :id`, {
        id: payrollId,
      });
    } else {
      const hdr = await query(
        `INSERT INTO hr_payroll (company_id, period_id, status, generated_at)
         VALUES (:companyId, :period_id, 'OPEN', NOW())`,
        { companyId, period_id },
      );
      payrollId = hdr.insertId;
    }

    const taxConfigs = await query(
      `SELECT id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, employee_contribution_rate, employer_contribution_rate, taxable_components, base_component,
          created_at FROM hr_tax_config
         WHERE company_id = :companyId AND is_active = 1
       ORDER BY min_amount ASC`,
      { companyId },
    );
    const structRows = await query(
      `SELECT components,
          created_at FROM hr_salary_structures
         WHERE company_id = :companyId AND is_active = 1 ORDER BY id DESC LIMIT 1`,
      { companyId },
    );
    let structComps = {};
    try {
      structComps = JSON.parse(structRows?.[0]?.components || "{}");
    } catch {
      structComps = {};
    }
    const formula = Array.isArray(structComps?.formula)
      ? structComps.formula
      : [];
    const activeTokens = new Set(formula.map((f) => String(f.token || "")));

    const employees = await query(
      `SELECT id, base_salary, has_paye, has_ssnit, has_tier3, tax_mappings,
          created_at FROM hr_employees
         WHERE company_id = :companyId AND status = 'ACTIVE' AND deleted_at IS NULL`,
      { companyId },
    );
    const configuredComponentDefinitions = await query(
      `SELECT d.id, d.component_name, d.component_type
         FROM hr_salary_component_definitions d
        WHERE d.company_id = :companyId AND d.is_active = 1
          AND COALESCE(d.manual_calculation, 0) = 0`,
      { companyId },
    );
    for (const def of configuredComponentDefinitions) {
      const isEarning = String(def.component_type || "").toUpperCase() === "ALLOWANCE";
      await registerSalaryComponent(companyId, {
        column_name: `employee_component_${Number(def.id)}`,
        label: def.component_name,
        component_type: isEarning ? "ALLOWANCE" : "DEDUCTION",
        display_order: isEarning ? 30 : 80,
        is_earning: isEarning ? 1 : 0,
        is_fixed: 0,
        source_type: "NONE",
        source_id: null,
      });
    }
    const manualComponentDefinitions = await query(
      `SELECT id, component_name, component_type
         FROM hr_salary_component_definitions
        WHERE company_id = :companyId AND is_active = 1 AND manual_calculation = 1`,
      { companyId },
    );
    const manualColumnName = (definitionId) =>
      `employee_component_${900000000000 + Number(definitionId)}`;
    for (const definition of manualComponentDefinitions) {
      await registerSalaryComponent(companyId, {
        column_name: manualColumnName(definition.id),
        label: definition.component_name,
        component_type: definition.component_type,
        display_order: definition.component_type === "ALLOWANCE" ? 30 : 80,
        is_earning: definition.component_type === "ALLOWANCE" ? 1 : 0,
        is_fixed: 0,
        source_type: "NONE",
        source_id: null,
      });
    }
    const employeeComponentColumns = await query(
      `SELECT column_name FROM hr_salary_components
        WHERE company_id = :companyId AND is_active = 1
          AND column_name REGEXP '^employee_component_[0-9]+$'`,
      { companyId },
    ).then((rows) =>
      rows
        .map((row) => String(row.column_name))
        .filter((name) => /^employee_component_\d+$/.test(name)),
    );

    await ensureCol(
      "hr_payroll_items",
      "tier3_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "tier3_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "tier3_tax_exempt",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "tier3_tax_exempt",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "tier3_taxable_excess",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "tier3_taxable_excess",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "ssf_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "ssf_employee",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "ssf_employer",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "tier3_employer",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "subtotal_a",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payroll_items",
      "subtotal_b",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol("hr_payroll_items", "paye_bracket_id", "BIGINT NULL");
    await ensureCol("hr_payroll_items", "paye_rate", "DECIMAL(9,4) NULL");
    await ensureCol(
      "hr_payslips",
      "subtotal_a",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol(
      "hr_payslips",
      "subtotal_b",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    await ensureCol("hr_payslips", "paye_bracket_id", "BIGINT NULL");
    await ensureCol("hr_payslips", "paye_rate", "DECIMAL(9,4) NULL");
    await ensureCol(
      "hr_payslips",
      "income_tax",
      "DECIMAL(18,4) NOT NULL DEFAULT 0",
    );
    try {
      await query(
        `ALTER TABLE hr_loans MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'PENDING'`,
        {},
      ).catch(() => {});
      await query(
        `CREATE TABLE IF NOT EXISTS hr_loan_repayments (
          id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          company_id BIGINT UNSIGNED NOT NULL,
          employee_id BIGINT UNSIGNED NOT NULL,
          loan_id BIGINT UNSIGNED NOT NULL,
          amount_paid DECIMAL(18,4) NOT NULL,
          payment_date DATE NOT NULL,
          payroll_id BIGINT UNSIGNED NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (id),
          KEY idx_loan (loan_id),
          KEY idx_employee (employee_id),
          KEY idx_payroll (payroll_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        {},
      ).catch(() => {});
    } catch {}

    for (const e of employees) {
      console.log(`Processing employee ${e.id}...`);

      // Determine statutory enrollment (PAYE, SSNIT/SSF, Tier 3)
      const empRawMappings = Array.isArray(e.tax_mappings)
        ? e.tax_mappings
        : (typeof e.tax_mappings === "string" ? (() => { try { return JSON.parse(e.tax_mappings); } catch { return []; } })() : []);
      const empTaxIdSet = new Set(empRawMappings.map(Number));

      const hasPayeInMappings = taxConfigs.some(
        (c) => (c.tax_type === "INCOME_TAX" || String(c.tax_name || "").toUpperCase().includes("PAYE")) && empTaxIdSet.has(Number(c.id))
      );
      const hasSsfInMappings = taxConfigs.some(
        (c) => (c.tax_type === "SOCIAL_SECURITY" || String(c.tax_name || "").toUpperCase().includes("SSF") || String(c.tax_name || "").toUpperCase().includes("SNITT")) && empTaxIdSet.has(Number(c.id))
      );
      const hasTier3InMappings = taxConfigs.some(
        (c) => (c.tax_type === "PROVIDENT_FUND" || c.tax_type === "PROVIDENCE_FUND" || String(c.tax_name || "").toUpperCase().includes("TIER 3") || String(c.tax_name || "").toUpperCase().includes("TIER-3")) && empTaxIdSet.has(Number(c.id))
      );

      const empHasPaye = empRawMappings.length > 0 ? hasPayeInMappings : Boolean(Number(e.has_paye));
      const empHasSsf = empRawMappings.length > 0 ? hasSsfInMappings : Boolean(Number(e.has_ssnit));
      const empHasTier3 = empRawMappings.length > 0 ? hasTier3InMappings : Boolean(Number(e.has_tier3));
      const overrides = await query(
        `SELECT *,
          created_at FROM hr_employee_salaries
         WHERE employee_id = :eid AND status = 'ACTIVE' ORDER BY effective_from DESC LIMIT 1`,
        { eid: e.id },
      ).catch(() => []);
      const basic = overrides.length
        ? overrides[0].basic_salary
        : e.base_salary;
      let allowances = overrides.length
        ? Number(overrides[0].allowances || 0)
        : 0;
      const alRows = await query(
        `SELECT a.id, a.amount, a.allowance_name,
          m.created_at FROM hr_employee_allowance_mappings m 
         JOIN hr_allowances a ON a.id = m.allowance_id
         WHERE m.employee_id = :eid AND a.is_active = 1`,
        { eid: e.id },
      ).catch(() => []);

      const allowanceMap = {};
      let filteredAllowancesTotal = 0;
      for (const r of alRows) {
        const aid = String(r.id);
        if (
          !activeTokens.has(`ALLOWANCE:${aid}`) &&
          !activeTokens.has("ALLOWANCES")
        ) {
          continue;
        }
        const amt = Number(r.amount || 0);
        allowanceMap[`ALLOWANCE:${aid}`] = amt;
        filteredAllowancesTotal += amt;
      }
      if (alRows.length) {
        allowances = filteredAllowancesTotal;
      }
      const employeeComponentRows = await query(
        `SELECT a.id, a.component_name,
                COALESCE(NULLIF(a.component_type, ''), d.component_type, 'ALLOWANCE') AS component_type,
                COALESCE(NULLIF(a.calculation_type, ''), 'AMOUNT') AS calculation_type,
                a.value, a.basis_component_id, a.definition_id,
                COALESCE(d.manual_calculation, 0) AS manual_calculation
           FROM hr_employee_salary_components a
           LEFT JOIN hr_salary_component_definitions d ON d.id = a.definition_id AND d.company_id = a.company_id
          WHERE a.company_id = :companyId AND a.employee_id = :employeeId AND a.is_active = 1
            AND COALESCE(d.manual_calculation, 0) = 0
            AND (a.effective_from IS NULL OR a.effective_from = '1000-01-01' OR a.effective_from <= :periodEnd)
            AND (a.effective_to IS NULL OR a.effective_to >= :periodStart)
          ORDER BY a.id ASC`,
        {
          companyId,
          employeeId: e.id,
          periodStart:
            period.start_date instanceof Date
              ? period.start_date.toISOString().slice(0, 10)
              : String(period.start_date).slice(0, 10),
          periodEnd:
            period.end_date instanceof Date
              ? period.end_date.toISOString().slice(0, 10)
              : String(period.end_date).slice(0, 10),
        },
      ).catch(() => []);
      const employeeComponentsById = new Map(
        employeeComponentRows.map((component) => [
          Number(component.id),
          component,
        ]),
      );
      const recurringEmployeeComponentRows = employeeComponentRows.filter(
        (component) => !Number(component.manual_calculation),
      );
      for (const component of recurringEmployeeComponentRows) {
        if (
          Number(component.basis_component_id) &&
          !employeeComponentsById.has(Number(component.basis_component_id))
        ) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Percentage basis for ${component.component_name} is unavailable for employee ${e.id}`,
          );
        }
      }
      let employeeComponentAmounts;
      try {
        employeeComponentAmounts = calculateEmployeeSalaryComponents(
          recurringEmployeeComponentRows,
          Number(basic || 0),
        );
      } catch (error) {
        throw httpError(
          400,
          "BAD_REQUEST",
          `${error.message} for employee ${e.id}`,
        );
      }
      let employeeComponentEarnings = 0;
      let employeeComponentDeductions = 0;
      const employeeComponentCols = Object.fromEntries(
        employeeComponentColumns.map((columnName) => [columnName, 0]),
      );
      let manualByDefinition = new Map();
      for (const component of recurringEmployeeComponentRows) {
        const amount = employeeComponentAmounts.get(Number(component.id)) || 0;
        const isEarning = String(component.component_type || "").toUpperCase() === "ALLOWANCE";
        if (isEarning) employeeComponentEarnings += amount;
        else employeeComponentDeductions += amount;
        const defId = component.definition_id || component.id;
        const columnName = `employee_component_${Number(defId)}`;
        employeeComponentCols[columnName] = (employeeComponentCols[columnName] || 0) + amount;
        await registerSalaryComponent(companyId, {
          column_name: columnName,
          label: component.component_name,
          component_type: isEarning ? "ALLOWANCE" : "DEDUCTION",
          display_order: isEarning ? 30 : 80,
          is_earning: isEarning ? 1 : 0,
          is_fixed: 0,
          source_type: "NONE",
          source_id: null,
        });
      }
      if (manualComponentDefinitions.length) {
        const definitionIds = manualComponentDefinitions.map((component) =>
          Number(component.id),
        );
        const manualRows = definitionIds.length
          ? await query(
              `SELECT m.definition_id, m.amount FROM hr_payroll_manual_components m
                LEFT JOIN hr_payroll_manual_component_selections s
                  ON s.company_id = m.company_id AND s.period_id = m.period_id
                 AND s.employee_id = m.employee_id AND s.definition_id = m.definition_id
               WHERE m.company_id = :companyId AND m.period_id = :periodId AND m.employee_id = :employeeId
                 AND m.definition_id IN (:definitionIds)
                 AND (s.is_selected = 1 OR s.is_selected IS NULL)`,
              {
                companyId,
                periodId: period_id,
                employeeId: e.id,
                definitionIds,
              },
            ).catch(() => [])
          : [];
        manualByDefinition = new Map(
          manualRows.map((row) => [
            Number(row.definition_id),
            Number(row.amount || 0),
          ]),
        );
        for (const component of manualComponentDefinitions) {
          const amount =
            Math.round(
              (Number(manualByDefinition.get(Number(component.id)) || 0) +
                Number.EPSILON) *
                100,
            ) / 100;
          const isEarning = component.component_type === "ALLOWANCE";
          if (isEarning) employeeComponentEarnings += amount;
          else employeeComponentDeductions += amount;
          const columnName = manualColumnName(component.id);
          employeeComponentCols[columnName] = amount;
          await registerSalaryComponent(companyId, {
            column_name: columnName,
            label: component.component_name,
            component_type: isEarning ? "ALLOWANCE" : "DEDUCTION",
            display_order: isEarning ? 30 : 80,
            is_earning: isEarning ? 1 : 0,
            is_fixed: 0,
            source_type: "NONE",
            source_id: null,
          });
        }
      }
      allowances += employeeComponentEarnings;
      const otherDeductions = overrides.length
        ? Number(overrides[0].deductions || 0)
        : 0;

      let ssfEmployee = 0;
      let ssfEmployer = 0;
      let tier3Employee = 0;
      let tier3Employer = 0;
      let tier3TaxExempt = 0;
      let tier3TaxableExcess = 0;
      let payeBracketId = null;
      let payeRate = 0;
      let incomeTax = 0;
      let subtotalA = 0;
      let gross = 0;
      let subtotalB = 0;
      let totalLoanDeductions = 0;
      let net = 0;
      const taxBreakdown = {};
      const loanCols = {};

      const reliefRows = await query(
        `SELECT id, relief_name, monthly_amount, annual_amount
           FROM hr_employee_tax_reliefs
          WHERE company_id = :companyId 
            AND employee_id = :eid 
            AND status IN ('ACTIVE', 'APPROVED')
            AND (start_date <= :periodEndDate OR start_date <= CURDATE() OR start_date IS NULL)
            AND (end_date IS NULL OR end_date >= :periodStartDate)`,
        {
          companyId,
          eid: e.id,
          periodEndDate,
          periodStartDate: period.start_date
            ? new Date(period.start_date).toISOString().slice(0, 10)
            : "2000-01-01",
        },
      ).catch(() => []);

      const employeeTaxRelief = reliefRows.reduce(
        (sum, r) => sum + Number(r.monthly_amount || 0),
        0,
      );

      const resolveBaseAmount = (cfg) => {
        const baseComp = String(cfg?.base_component || "BASIC").toUpperCase();
        if (baseComp === "GROSS") {
          return Number(basic) + Number(allowances);
        }
        if (baseComp === "ALLOWANCES") {
          return Number(allowances);
        }
        if (baseComp.startsWith("CMP:")) {
          const defId = Number(baseComp.split(":")[1]);
          return Number(employeeComponentAmounts.get(defId) || manualByDefinition.get(defId) || 0);
        }
        return Number(basic);
      };

      const calculateTier3ForCfg = (cfg) => {
        const baseAmt = resolveBaseAmount(cfg);
        const empRatePct = Number(cfg.employee_contribution_rate || 0);
        const rateEmp = empRatePct / 100;
        const rateEr = Number(cfg.employer_contribution_rate || 0) / 100;
        let empFull = 0;
        let empExempt = 0;
        let empTaxable = 0;
        let erFull = 0;

        if (rateEmp > 0) {
          empFull = Math.round((baseAmt * rateEmp + Number.EPSILON) * 10000) / 10000;
          // Statutory rule (Ghana GRA / Act 896): Up to 16.5% of basic salary is tax-exempt.
          // Any excess percentage above 16.5% is taxable income.
          if (empRatePct > 16.5) {
            empExempt = Math.round((baseAmt * (16.5 / 100) + Number.EPSILON) * 10000) / 10000;
            empTaxable = Math.round((empFull - empExempt + Number.EPSILON) * 10000) / 10000;
          } else {
            empExempt = empFull;
            empTaxable = 0;
          }
        }
        if (rateEr > 0) {
          erFull = Math.round((baseAmt * rateEr + Number.EPSILON) * 10000) / 10000;
        }
        return { empRatePct, rateEmp, rateEr, empFull, empExempt, empTaxable, erFull };
      };

      // ── Refactored Logic: Process Formula Sequentially ──
      for (const step of formula) {
        const token = String(step.token || "").toUpperCase();

        if (token === "BASIC") {
          // Handled by default
        } else if (token === "ALLOWANCES") {
          // allowances variable already contains the total filtered allowances
        } else if (token === "SSF" || token.startsWith("SSF:")) {
          // Calculate SSF on configured base component only if employee is enrolled in SSNIT
          if (empHasSsf) {
            for (const cfg of taxConfigs) {
            const ttype = String(cfg.tax_type || "");
            const tname = String(cfg.tax_name || "").toUpperCase();
            if (
              (ttype === "SOCIAL_SECURITY" ||
                tname.includes("SSF") ||
                tname.includes("SSNIT")) &&
              (token === "SSF" || token === `SSF:${cfg.id}`)
            ) {
              const baseAmt = resolveBaseAmount(cfg);
              const rateEmp = Number(cfg.employee_contribution_rate || 0) / 100;
              const rateEr = Number(cfg.employer_contribution_rate || 0) / 100;
              if (rateEmp > 0) {
                const amount = Math.round((baseAmt * rateEmp + Number.EPSILON) * 100) / 100;
                ssfEmployee += amount;
                taxBreakdown[`SSF:${cfg.id}`] =
                  (taxBreakdown[`SSF:${cfg.id}`] || 0) + amount;
              }
              if (rateEr > 0) {
                ssfEmployer += Math.round((baseAmt * rateEr + Number.EPSILON) * 100) / 100;
              }
            }
          }
          }
          // Auto-update dependencies
          subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
          gross = subtotalA + Number(allowances);
        } else if (
          token.startsWith("TIER3") ||
          token.startsWith("TIER-3") ||
          token.includes("PROVIDENT")
        ) {
          // Calculate Tier 3 on basic salary
          for (const cfg of taxConfigs) {
            const ttype = String(cfg.tax_type || "");
            const tname = String(cfg.tax_name || "").toUpperCase();
            if (
              (ttype === "PROVIDENT_FUND" ||
                ttype === "PROVIDENCE_FUND" ||
                tname.includes("TIER 3") ||
                tname.includes("TIER-3") ||
                tname.includes("PROVIDENT")) &&
              (token === "TIER3" ||
                token === `TIER3:${cfg.id}` ||
                token === `TIER-3:${cfg.id}` ||
                token === `PROVIDENT_FUND:${cfg.id}`)
            ) {
              if (empHasTier3) {
                const t3 = calculateTier3ForCfg(cfg);
                tier3Employee += t3.empFull;
                tier3TaxExempt += t3.empExempt;
                tier3TaxableExcess += t3.empTaxable;
                tier3Employer += t3.erFull;
                if (t3.empFull > 0) {
                  taxBreakdown[`TIER3:${cfg.id}`] =
                    (taxBreakdown[`TIER3:${cfg.id}`] || 0) + t3.empFull;
                }
              }
            }
          }
          // Auto-update dependencies
          subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
          gross = subtotalA + Number(allowances);
        } else if (token === "SUBTOTAL_A") {
          subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
          gross = subtotalA + Number(allowances);
        } else if (token === "GROSS") {
          subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
          gross = subtotalA + Number(allowances);
        } else if (token === "TAX_RELIEF" || token.startsWith("TAX_RELIEF")) {
          // Statutory Ghana GRA personal tax reliefs reduce assessable taxable income prior to PAYE brackets
          // Already aggregated in employeeTaxRelief for deduction in taxableIncome calculation
        } else if (
          token === "PAYE" ||
          token === "INCOME_TAX" ||
          token.startsWith("INCOME_TAX_BRACKET:")
        ) {
          // If employee is enrolled in Tier 3 but Tier 3 was not explicitly processed in formula, calculate now
          if (empHasTier3 && tier3Employee === 0) {
            for (const cfg of taxConfigs) {
              const ttype = String(cfg.tax_type || "");
              const tname = String(cfg.tax_name || "").toUpperCase();
              if (
                ttype === "PROVIDENT_FUND" ||
                ttype === "PROVIDENCE_FUND" ||
                tname.includes("TIER 3") ||
                tname.includes("TIER-3") ||
                tname.includes("PROVIDENT")
              ) {
                const t3 = calculateTier3ForCfg(cfg);
                tier3Employee += t3.empFull;
                tier3TaxExempt += t3.empExempt;
                tier3TaxableExcess += t3.empTaxable;
                tier3Employer += t3.erFull;
                if (t3.empFull > 0) {
                  taxBreakdown[`TIER3:${cfg.id}`] =
                    (taxBreakdown[`TIER3:${cfg.id}`] || 0) + t3.empFull;
                }
              }
            }
          }

          // Ensure Subtotal A and Gross are up to date before calculating PAYE
          subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
          gross = subtotalA + Number(allowances);

          if (empHasPaye) {
            // Determine configured taxable components (from PAYE tax config or active salary structure)
            let effectiveTaxableSet = null;
            for (const cfg of taxConfigs) {
              if (cfg.tax_type === "INCOME_TAX" && cfg.taxable_components) {
                try {
                  const parsed =
                    typeof cfg.taxable_components === "string"
                      ? JSON.parse(cfg.taxable_components)
                      : cfg.taxable_components;
                  if (Array.isArray(parsed) && parsed.length > 0) {
                    effectiveTaxableSet = new Set(parsed);
                    break;
                  }
                } catch {}
              }
            }
            if (
              !effectiveTaxableSet &&
              Array.isArray(structComps?.taxable_components) &&
              structComps.taxable_components.length > 0
            ) {
              effectiveTaxableSet = new Set(structComps.taxable_components);
            }

            // Sum only allowances that are selected as taxable
            let taxableAllowances = 0;
            if (!effectiveTaxableSet) {
              taxableAllowances = Number(allowances);
            } else {
              // Legacy allowances
              for (const r of alRows) {
                const aid = String(r.id);
                if (
                  effectiveTaxableSet.has(`ALLOWANCE:${aid}`) ||
                  effectiveTaxableSet.has("ALLOWANCES") ||
                  effectiveTaxableSet.has(r.allowance_name)
                ) {
                  taxableAllowances += Number(r.amount || 0);
                }
              }
              // Recurring salary component allowances
              for (const component of recurringEmployeeComponentRows) {
                const defId = component.definition_id || component.id;
                const isEarning =
                  String(component.component_type || "").toUpperCase() ===
                  "ALLOWANCE";
                if (isEarning) {
                  const amt =
                    employeeComponentAmounts.get(Number(component.id)) || 0;
                  if (
                    effectiveTaxableSet.has(`CMP:${defId}`) ||
                    effectiveTaxableSet.has("ALLOWANCES") ||
                    effectiveTaxableSet.has(component.component_name)
                  ) {
                    taxableAllowances += amt;
                  }
                }
              }
              // Manual salary component allowances
              if (manualComponentDefinitions.length) {
                for (const component of manualComponentDefinitions) {
                  const isEarning = component.component_type === "ALLOWANCE";
                  if (isEarning) {
                    const amt =
                      Math.round(
                        (Number(
                          manualByDefinition.get(Number(component.id)) || 0,
                        ) +
                          Number.EPSILON) *
                          100,
                      ) / 100;
                    if (
                      effectiveTaxableSet.has(`CMP:${component.id}`) ||
                      effectiveTaxableSet.has("ALLOWANCES") ||
                      effectiveTaxableSet.has(component.component_name)
                    ) {
                      taxableAllowances += amt;
                    }
                  }
                }
              }
            }

            const isBasicTaxable =
              !effectiveTaxableSet || effectiveTaxableSet.has("BASIC");
            const taxableGross =
              (isBasicTaxable ? Number(basic) : 0) -
              ssfEmployee -
              tier3TaxExempt +
              taxableAllowances;

            // Apply Employee Tax Relief to reduce assessable income before PAYE brackets
            let taxableIncome = Math.max(
              0,
              taxableGross - Number(employeeTaxRelief || 0),
            );
            const hasAnyIncomeTaxToken = formula.some((f) =>
              String(f.token || "")
                .toUpperCase()
                .startsWith("INCOME_TAX_BRACKET:"),
            );

            const payeBands = taxConfigs
              .filter(
                (cfg) =>
                  String(cfg.tax_type || "") === "INCOME_TAX" &&
                  (token === "PAYE" ||
                    token === "INCOME_TAX" ||
                    token === `INCOME_TAX_BRACKET:${cfg.tax_name}` ||
                    hasAnyIncomeTaxToken),
              )
              .sort(
                (a, b) => Number(a.min_amount || 0) - Number(b.min_amount || 0),
              );

            let remaining = taxableIncome;
            let tempIncomeTax = 0;
            for (const cfg of payeBands) {
              if (remaining <= 0) break;
              const bandMin = Number(cfg.min_amount || 0);
              const bandMax =
                cfg.max_amount === null || cfg.max_amount === ""
                  ? null
                  : Number(cfg.max_amount);
              const bandWidth =
                bandMax === null ? remaining : bandMax - bandMin;
              const taxableInBand = Math.min(remaining, bandWidth);
              const rate = Number(cfg.tax_rate || 0);
              const bandTax = taxableInBand * (rate / 100);
              tempIncomeTax += bandTax;
              taxBreakdown[`INCOME_TAX:${cfg.id}`] =
                (taxBreakdown[`INCOME_TAX:${cfg.id}`] || 0) + bandTax;
              if (taxableInBand > 0) {
                payeBracketId = cfg.id;
                payeRate = rate;
              }
              remaining -= taxableInBand;
            }
            incomeTax = tempIncomeTax;
            const byName = {};
            for (const cfg of taxConfigs) {
              if (String(cfg.tax_type || "") === "INCOME_TAX") {
                const nm = String(cfg.tax_name || "").toUpperCase();
                byName[nm] =
                  (byName[nm] || 0) +
                  (taxBreakdown[`INCOME_TAX:${cfg.id}`] || 0);
              }
            }
            for (const nm in byName) {
              taxBreakdown[`INCOME_TAX_BRACKET:${nm}`] = byName[nm];
            }
          }
          // Auto-update dependency
          subtotalB = gross - incomeTax;
        } else if (token === "SUBTOTAL_B") {
          subtotalB = gross - incomeTax;
        } else if (token === "LOANS" || token === "DEDUCTIONS") {
          const activeLoans = await query(
            `SELECT id, loan_type, monthly_installment, amount_due, status,
          created_at FROM hr_loans
         WHERE employee_id = :eid 
           AND company_id = :companyId 
           AND status = 'ACTIVE' 
           AND amount_due > 0 
           AND affect_payslip = 1 
           AND start_date <= :periodEndDate
           AND id NOT IN (
             SELECT loan_id FROM hr_loan_skips 
             WHERE company_id = :companyId 
               AND (period_id = :period_id OR skip_month = :periodMonth)
           )`,
            { eid: e.id, companyId, periodEndDate, period_id, periodMonth },
          );
          for (const loan of activeLoans) {
            const deduction = Math.min(
              Number(loan.monthly_installment || 0),
              Number(loan.amount_due || 0),
            );
            if (deduction > 0) {
              totalLoanDeductions += deduction;
              loanCols[`loan_${loan.id}`] = deduction;
              await registerSalaryComponent(companyId, {
                column_name: `loan_${loan.id}`,
                label: loan.loan_type
                  ? `Loan – ${loan.loan_type}`
                  : `Loan ${loan.id}`,
                component_type: "DEDUCTION",
                display_order: 76,
                is_earning: 0,
                is_fixed: 0,
                source_type: "NONE",
                source_id: Number(loan.id) || null,
              });
              const newAmountDue = Math.max(
                0,
                Number(loan.amount_due) - deduction,
              );
              await query(
                `INSERT INTO hr_loan_repayments (company_id, employee_id, loan_id, amount_paid, payment_date, payroll_id, payment_type, remaining_balance)
                 VALUES (:companyId, :employee_id, :loan_id, :amount_paid, CURDATE(), :payroll_id, 'PAYROLL', :newAmountDue)`,
                {
                  companyId,
                  employee_id: e.id,
                  loan_id: loan.id,
                  amount_paid: deduction,
                  payroll_id: payrollId,
                  newAmountDue,
                },
              );
              await query(
                `UPDATE hr_loans SET amount_due = :newAmountDue, status = :status WHERE id = :id`,
                {
                  newAmountDue,
                  status: newAmountDue <= 0 ? "COMPLETED" : "ACTIVE",
                  id: loan.id,
                },
              );
            }
          }
        } else if (token === "NET_SALARY") {
          // Net salary = subtotal B - taxable excess - other deductions
          net =
            subtotalB -
            tier3TaxableExcess -
            totalLoanDeductions -
            Number(otherDeductions) -
            employeeComponentDeductions;
        }
      }

      // If employee is enrolled in Tier 3 but Tier 3 was not yet computed, calculate now
      if (empHasTier3 && tier3Employee === 0) {
        for (const cfg of taxConfigs) {
          const ttype = String(cfg.tax_type || "");
          const tname = String(cfg.tax_name || "").toUpperCase();
          if (
            ttype === "PROVIDENT_FUND" ||
            ttype === "PROVIDENCE_FUND" ||
            tname.includes("TIER 3") ||
            tname.includes("TIER-3") ||
            tname.includes("PROVIDENT")
          ) {
            const t3 = calculateTier3ForCfg(cfg);
            tier3Employee += t3.empFull;
            tier3TaxExempt += t3.empExempt;
            tier3TaxableExcess += t3.empTaxable;
            tier3Employer += t3.erFull;
            if (t3.empFull > 0) {
              taxBreakdown[`TIER3:${cfg.id}`] =
                (taxBreakdown[`TIER3:${cfg.id}`] || 0) + t3.empFull;
            }
          }
        }
      }

      // Final pass to ensure subtotals and net are populated even if formula was partial
      subtotalA = Number(basic) - ssfEmployee - tier3TaxExempt;
      gross = subtotalA + Number(allowances);
      subtotalB = gross - incomeTax;
      net =
        subtotalB -
        tier3TaxableExcess -
        totalLoanDeductions -
        Number(otherDeductions) -
        employeeComponentDeductions;

      const deductions =
        Number(incomeTax) +
        Number(ssfEmployee) +
        Number(tier3Employee) +
        Number(otherDeductions) +
        Number(totalLoanDeductions) +
        Number(employeeComponentDeductions);
      const ssnitPayable = Number(basic || 0) * 0.13;
      const tier2Payable = Number(basic || 0) * 0.05;

      const dynamicCols = {
        tax_relief: employeeTaxRelief || 0,
        tier3_employee: tier3Employee || 0,
        tier3_tax_exempt: tier3TaxExempt || 0,
        tier3_taxable_excess: tier3TaxableExcess || 0,
        ssf_employer: ssfEmployer || 0,
        tier3_employer: tier3Employer || 0,
        ssnit: ssnitPayable || 0,
        tier2: tier2Payable || 0,
        loan_deductions_total: totalLoanDeductions || 0,
        subtotal_a: subtotalA || 0,
        subtotal_b: subtotalB || 0,
        paye_bracket_id: payeBracketId || null,
        paye_rate: payeRate || null,
      };
      for (const [k, v] of Object.entries(loanCols)) {
        dynamicCols[k] = v;
      }
      Object.assign(dynamicCols, employeeComponentCols);

      for (const key in allowanceMap) {
        const allowId = String(key).split(":")[1] || String(key);
        const colName = `allowance_${allowId}`;
        dynamicCols[colName] = Number(allowanceMap[key] || 0);
        // Find the matching allowance row for a human-readable label
        const alRow = alRows.find((r) => String(r.id) === String(allowId));
        const alLabel = alRow?.allowance_name || `Allowance ${allowId}`;
        await registerSalaryComponent(companyId, {
          column_name: colName,
          label: alLabel,
          component_type: "ALLOWANCE",
          display_order: 25,
          is_earning: 1,
          is_fixed: 0,
          source_type: "ALLOWANCE",
          source_id: Number(allowId) || null,
        });
      }

      for (const key in taxBreakdown) {
        let cleanName = String(key)
          .replace(/[^a-zA-Z0-9_]/g, "_")
          .toLowerCase();
        if (/^[0-9]/.test(cleanName)) cleanName = `c_${cleanName}`;
        if (cleanName.length > 60) cleanName = cleanName.slice(0, 60);
        dynamicCols[cleanName] = Number(taxBreakdown[key] || 0);
        // Derive metadata for salary component registry
        let ctype = "OTHER";
        let cOrderBase = 55;
        let cEarning = 0;
        let cSourceType = "NONE";
        let cSourceId = null;
        let cLabel = cleanName.replace(/_/g, " ");
        if (key.startsWith("INCOME_TAX:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "INCOME_TAX";
          cOrderBase = 70;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `PAYE – ${cfg.tax_name}` : `Income Tax ${cfgId}`;
        } else if (key.startsWith("SSF:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "SOCIAL_SECURITY";
          cOrderBase = 50;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `SSF Employee – ${cfg.tax_name}` : `SSF ${cfgId}`;
        } else if (key.startsWith("TIER3:")) {
          const cfgId = String(key).split(":")[1];
          const cfg = taxConfigs.find((t) => String(t.id) === cfgId);
          ctype = "PROVIDENT_FUND";
          cOrderBase = 60;
          cSourceType = "TAX_CONFIG";
          cSourceId = Number(cfgId) || null;
          cLabel = cfg ? `Tier 3 – ${cfg.tax_name}` : `Tier 3 ${cfgId}`;
        } else if (key.startsWith("INCOME_TAX_BRACKET:")) {
          const bracketName = String(key).split(":")[1] || "";
          ctype = "INCOME_TAX";
          cOrderBase = 72;
          cLabel = `PAYE Bracket – ${bracketName}`;
        }
        await registerSalaryComponent(companyId, {
          column_name: cleanName,
          label: cLabel,
          component_type: ctype,
          display_order: cOrderBase,
          is_earning: cEarning,
          is_fixed: 0,
          source_type: cSourceType,
          source_id: cSourceId,
        });
      }
      // Do not register a 'loan_deductions_total' component to avoid duplication on payslips

      // Add dynamic columns if they don't exist
      const colDefs = [];
      const placeholders = [];
      const values = {
        payroll_id: payrollId,
        employee_id: e.id,
        basic_salary: basic || 0,
        allowances: allowances || 0,
        deductions: deductions || 0,
        income_tax: incomeTax || 0,
        ssf_employee: ssfEmployee || 0,
        net_salary: net || 0,
        period_id: period_id,
        created_by: effectiveUserId,
      };

      for (const [col, val] of Object.entries(dynamicCols)) {
        let ok = false;
        if (col.endsWith("_id")) {
          ok =
            (await ensureCol("hr_payroll_items", col, "BIGINT NULL")) &&
            (await ensureCol("hr_payslips", col, "BIGINT NULL"));
        } else {
          ok =
            (await ensureCol(
              "hr_payroll_items",
              col,
              "DECIMAL(18,4) NOT NULL DEFAULT 0",
            )) &&
            (await ensureCol(
              "hr_payslips",
              col,
              "DECIMAL(18,4) NOT NULL DEFAULT 0",
            ));
        }
        if (ok) {
          colDefs.push(col);
          placeholders.push(`:${col}`);
          values[col] = val;
        }
      }

      // Insert fixed columns first into hr_payroll_items
      await query(
        `INSERT INTO hr_payroll_items 
           (payroll_id, employee_id, basic_salary, allowances, deductions, income_tax, ssf_employee, net_salary)
         VALUES 
           (:payroll_id, :employee_id, :basic_salary, :allowances, :deductions, :income_tax, :ssf_employee, :net_salary)`,
        values,
      );
      // Ensure and update dynamic columns for items
      for (const col of colDefs) {
        const isId = col.endsWith("_id");
        await ensureCol(
          "hr_payroll_items",
          col,
          isId ? "BIGINT NULL" : "DECIMAL(18,4) NOT NULL DEFAULT 0",
        );
        await query(
          `UPDATE hr_payroll_items SET ${col} = :val WHERE payroll_id = :pid AND employee_id = :eid`,
          { val: values[col] ?? 0, pid: payrollId, eid: e.id },
        ).catch(() => {});
      }
      // Insert or update payslip with fixed columns
      await query(
        `INSERT INTO hr_payslips 
           (period_id, employee_id, basic_salary, allowances, deductions, income_tax, ssf_employee, net_salary, status, created_by, created_at)
         VALUES 
           (:period_id, :employee_id, :basic_salary, :allowances, :deductions, :income_tax, :ssf_employee, :net_salary, 'DRAFT', :created_by, NOW())
         ON DUPLICATE KEY UPDATE 
           basic_salary = VALUES(basic_salary),
           allowances = VALUES(allowances),
           deductions = VALUES(deductions),
           income_tax = VALUES(income_tax),
           ssf_employee = VALUES(ssf_employee),
           net_salary = VALUES(net_salary),
           status = VALUES(status),
           created_by = COALESCE(VALUES(created_by), hr_payslips.created_by),
           created_at = COALESCE(hr_payslips.created_at, NOW())`,
        values,
      );
      // Ensure and update dynamic columns for payslips
      for (const col of colDefs) {
        const isId = col.endsWith("_id");
        await ensureCol(
          "hr_payslips",
          col,
          isId ? "BIGINT NULL" : "DECIMAL(18,4) NOT NULL DEFAULT 0",
        );
        await query(
          `UPDATE hr_payslips SET ${col} = :val WHERE employee_id = :eid AND period_id = :period_id`,
          { val: values[col] ?? 0, eid: e.id, period_id },
        ).catch(() => {});
      }
    }

    await query(`UPDATE hr_payroll SET status = 'GENERATED' WHERE id = :id`, {
      id: payrollId,
    });

    res.json({ id: payrollId, message: "Payroll generated" });
  } catch (err) {
    next(err);
  }
}

/**
 * Salary Components Registry
 * Returns the full metadata list of salary component columns for hr_payslips.
 */
export async function listSalaryComponents(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    await seedFixedSalaryComponents(companyId);

    // 1. Sync custom salary component definitions from hr_salary_component_definitions
    const activeCustomCols = new Set();
    try {
      const activeDefs = await query(
        `SELECT id, component_name, component_type, manual_calculation 
         FROM hr_salary_component_definitions 
         WHERE (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL) AND is_active = 1`,
        { companyId }
      );
      for (const def of activeDefs) {
        const isEarning = String(def.component_type || "").toUpperCase() === "ALLOWANCE";
        const colName = def.manual_calculation
          ? `employee_component_${900000000000 + Number(def.id)}`
          : `employee_component_${Number(def.id)}`;
        activeCustomCols.add(colName);
        await registerSalaryComponent(companyId, {
          column_name: colName,
          label: def.component_name,
          component_type: isEarning ? "ALLOWANCE" : "DEDUCTION",
          display_order: isEarning ? 30 : 80,
          is_earning: isEarning ? 1 : 0,
          is_fixed: 0,
          source_type: "CUSTOM_DEF",
          source_id: def.id,
        });
      }

      // Deactivate any custom employee_component columns in hr_salary_components that are not active in definitions
      if (activeCustomCols.size > 0) {
        await query(
          `UPDATE hr_salary_components 
           SET is_active = 0 
           WHERE (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL)
             AND column_name REGEXP '^employee_component_[0-9]+$' 
             AND column_name NOT IN (${Array.from(activeCustomCols).map((c) => `'${c}'`).join(",")})`,
          { companyId }
        ).catch(() => {});
      }

      // Deactivate legacy setup allowance types
      await query(
        `UPDATE hr_salary_components 
         SET is_active = 0 
         WHERE (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL)
           AND (column_name REGEXP '^allowance_[0-9]+$' OR source_type IN ('ALLOWANCE_TYPE', 'ALLOWANCE'))`,
        { companyId }
      ).catch(() => {});
    } catch (e) {
      console.warn("Failed syncing salary component definitions:", e?.message);
    }

    // 2. Ensure statutory contributions and core emoluments are explicitly registered
    await registerSalaryComponent(companyId, {
      column_name: "basic_salary",
      label: "Basic Salary",
      component_type: "BASIC",
      display_order: 10,
      is_earning: 1,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "ssf_employee",
      label: "Social Security Fund (Employee 5.5%)",
      component_type: "SOCIAL_SECURITY",
      display_order: 50,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "ssf_employer",
      label: "Social Security Fund (Employer 13.0%)",
      component_type: "SOCIAL_SECURITY",
      display_order: 52,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "ssnit",
      label: "SSNIT Payable (First Tier Remittance)",
      component_type: "SOCIAL_SECURITY",
      display_order: 54,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "tier2",
      label: "Tier 2 Occupational Pension Payable (5.0%)",
      component_type: "PROVIDENT_FUND",
      display_order: 56,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "tier3_employee",
      label: "Tier 3 Provident Fund (Employee)",
      component_type: "PROVIDENT_FUND",
      display_order: 60,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "tier3_employer",
      label: "Tier 3 Provident Fund (Employer)",
      component_type: "PROVIDENT_FUND",
      display_order: 62,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "income_tax",
      label: "Income Tax (PAYE)",
      component_type: "INCOME_TAX",
      display_order: 70,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "loan_deductions_total",
      label: "Staff Loan Deductions",
      component_type: "DEDUCTION",
      display_order: 85,
      is_earning: 0,
      is_fixed: 1,
    });
    await registerSalaryComponent(companyId, {
      column_name: "net_salary",
      label: "Net Salary Payable",
      component_type: "NET_SALARY",
      display_order: 99,
      is_earning: 0,
      is_fixed: 1,
    });

    // 3. Query all active components involved in salary configuration & statutory contributions
    const items = await query(
      `SELECT c.id, c.column_name, c.label, c.component_type, c.display_order,
              c.is_earning, c.is_fixed, c.source_type, c.source_id, c.is_active,
              m.account_id, a.code AS account_code, a.name AS account_name,
              c.created_at FROM hr_salary_components c
       LEFT JOIN hr_salary_component_accounts m ON m.component_id = c.id AND m.company_id = c.company_id
       LEFT JOIN fin_accounts a ON a.id = m.account_id AND a.company_id = c.company_id
        WHERE (c.company_id = :companyId OR c.company_id IS NULL OR :companyId IS NULL)
          AND c.is_active = 1
          AND c.component_type != 'SUBTOTAL'
          AND c.column_name != 'tax_relief'
          AND c.column_name NOT IN ('allowances', 'deductions', 'subtotal_a', 'subtotal_b', 'tier3_tax_exempt', 'tier3_taxable_excess')
          AND c.column_name NOT REGEXP '^allowance_[0-9]+$'
          AND c.column_name NOT REGEXP '^income_tax_[0-9]+$'
          AND c.column_name NOT REGEXP '^income_tax_bracket_'
          AND c.column_name NOT REGEXP '^ssf_[0-9]+$'
          AND c.column_name NOT REGEXP '^tier3_[0-9]+$'
          AND c.column_name NOT REGEXP '^loan_[0-9]+$'
        ORDER BY c.display_order ASC, c.component_type ASC, c.label ASC`,
      { companyId },
    );

    // Deduplicate by column_name and only include active components
    const seenCol = new Set();
    const dedupedItems = [];
    for (const it of items) {
      if (seenCol.has(it.column_name)) continue;
      // Filter out stale custom definitions not currently active
      if (it.column_name.startsWith("employee_component_") && !activeCustomCols.has(it.column_name)) {
        continue;
      }
      seenCol.add(it.column_name);
      dedupedItems.push(it);
    }

    res.json({ items: dedupedItems });
  } catch (err) {
    next(err);
  }
}

export async function mapSalaryComponentAccount(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { componentId, columnName, accountId } = req.body;

    if (!componentId && !columnName) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "componentId or columnName is required",
      );
    }

    let resolvedComponentId = componentId;

    // If no component ID, resolve via column_name (auto-register virtual columns)
    if (!resolvedComponentId && columnName) {
      const VIRTUAL_LABELS = {
        ssf_employer: {
          label: "Social Security Fund (Employer)",
          component_type: "SOCIAL_SECURITY",
        },
        tier3_employer: {
          label: "Tier 3 (Employer)",
          component_type: "PROVIDENT_FUND",
        },
        allowances: { label: "Allowances", component_type: "ALLOWANCE" },
        deductions: { label: "Total Deductions", component_type: "DEDUCTION" },
        income_tax: { label: "Income Tax", component_type: "INCOME_TAX" },
        ssf_employee: {
          label: "Social Security Fund (Employee)",
          component_type: "SOCIAL_SECURITY",
        },
        tier3_employee: {
          label: "Tier 3 (Employee)",
          component_type: "PROVIDENT_FUND",
        },
        ssnit: {
          label: "SSNIT Payable",
          component_type: "SOCIAL_SECURITY",
        },
        tier2: {
          label: "Tier 2 Payable",
          component_type: "PROVIDENT_FUND",
        },
        net_salary: { label: "Net Salary", component_type: "NET_SALARY" },
      };
      const meta = VIRTUAL_LABELS[columnName] || {
        label: columnName,
        component_type: "OTHER",
      };

      // Upsert into hr_salary_components
      await registerSalaryComponent(companyId, {
        column_name: columnName,
        label: meta.label,
        component_type: meta.component_type,
        display_order: 90,
        is_earning: 0,
        is_fixed: 1,
        source_type: "NONE",
        source_id: null,
      });

      const [comp] = await query(
        `SELECT id,
          created_at FROM hr_salary_components
         WHERE company_id = :companyId AND column_name = :columnName LIMIT 1`,
        { companyId, columnName },
      );
      if (!comp)
        throw httpError(
          500,
          "SERVER_ERROR",
          "Could not resolve salary component",
        );
      resolvedComponentId = comp.id;
    }

    if (!accountId) {
      await query(
        `DELETE FROM hr_salary_component_accounts 
         WHERE component_id = :componentId AND company_id = :companyId`,
        { componentId: resolvedComponentId, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_salary_component_accounts (company_id, component_id, account_id)
         VALUES (:companyId, :componentId, :accountId)
         ON DUPLICATE KEY UPDATE account_id = :accountId, updated_at = NOW()`,
        { companyId, componentId: resolvedComponentId, accountId },
      );
    }

    res.json({ message: "Salary component account mapping updated" });
  } catch (err) {
    next(err);
  }
}

export async function listPayslips(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { period_id, employee_id } = req.query;
    const clauses = [
      "e.company_id = :companyId",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr))",
    ];
    const params = { companyId, branchId, branchIdsStr };
    if (period_id) {
      clauses.push("p.period_id = :period_id");
      params.period_id = period_id;
    }
    if (employee_id) {
      clauses.push("p.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    // Dynamic columns for loans
    const loanColRows = await query(
      `SELECT COLUMN_NAME AS name,
          created_at FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payslips'
         AND COLUMN_NAME LIKE 'loan\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const loanCols = Array.isArray(loanColRows)
      ? loanColRows.map((r) => String(r.name))
      : [];
    const selectCols = ["p.*"].concat(loanCols.map((c) => `p.${c}`)).join(", ");

    const itemsRaw = await query(
      `SELECT ${selectCols}, e.first_name, e.last_name, e.emp_code, e.email, pr.period_name,
              COALESCE(p.created_at, NOW()) AS created_at,
              COALESCE(u.full_name, u.username, 'System Admin') AS created_by_name,
              pay.status AS payroll_status,
              pay.forwarded_to_username,
              pay.approved_by_username,
              pay.approved_at
           FROM hr_payslips p
       JOIN hr_employees e ON e.id = p.employee_id
       JOIN hr_payroll_periods pr ON pr.id = p.period_id
       LEFT JOIN adm_users u ON u.id = p.created_by
       LEFT JOIN (
         SELECT period_id, company_id, status, forwarded_to_username, approved_by_username, approved_at
         FROM hr_payroll
         WHERE id IN (SELECT MAX(id) FROM hr_payroll GROUP BY period_id, company_id)
       ) pay ON pay.period_id = p.period_id AND pay.company_id = e.company_id
       ${where}
         ORDER BY pr.start_date DESC`,
      params,
    );

    // Fetch actual repayment items for precise breakdown
    const pids = itemsRaw.map((it) => it.period_id);
    const uniquePids = [...new Set(pids)];

    const repayRows = await query(
      `SELECT lr.employee_id, lr.loan_id, lr.amount_paid, l.loan_type, lr.payroll_id, pr.period_id,
          lr.created_at FROM hr_loan_repayments lr 
       LEFT JOIN hr_loans l ON l.id = lr.loan_id
       JOIN hr_payroll pr ON pr.id = lr.payroll_id
         WHERE pr.period_id IN (:uniquePids)`,
      { uniquePids: uniquePids.length ? uniquePids : [0] },
    ).catch(() => []);

    const repayByEmpPeriod = {};
    for (const rr of repayRows || []) {
      const key = `${rr.employee_id}_${rr.period_id}`;
      if (!repayByEmpPeriod[key]) repayByEmpPeriod[key] = [];
      repayByEmpPeriod[key].push({
        loan_id: Number(rr.loan_id),
        loan_type: rr.loan_type || null,
        amount: Number(rr.amount_paid || 0),
      });
    }

    const items = itemsRaw.map((r) => {
      const loans = {};
      const key = `${r.employee_id}_${r.period_id}`;
      if (repayByEmpPeriod[key]) {
        for (const it of repayByEmpPeriod[key]) {
          loans[String(it.loan_id)] = {
            loan_id: it.loan_id,
            loan_type: it.loan_type,
            amount: it.amount,
          };
        }
      } else {
        // Fallback to columns if repayment table fails
        for (const col of loanCols) {
          const val = Number(r[col] || 0);
          if (val !== 0) {
            const lid = col.replace("loan_", "");
            loans[lid] = { loan_id: lid, amount: val };
          }
        }
      }

      const pStatus = String(r.payroll_status || 'OPEN').toUpperCase();
      const isApproved = ['APPROVED', 'CLOSED'].includes(pStatus);
      return {
        ...r,
        payroll_status: pStatus,
        is_approved: isApproved,
        loan_deductions_total: Number(r.loan_deductions_total || 0),
        loan_items: loans,
      };
    });

    const allApproved = items.length > 0 ? items.every((it) => it.is_approved) : false;
    const periodStatus = items.length > 0 ? items[0].payroll_status : 'OPEN';
    const forwardedTo = items.length > 0 ? items[0].forwarded_to_username : null;
    const approvedBy = items.length > 0 ? items[0].approved_by_username : null;

    res.json({
      items,
      is_approved: allApproved,
      payroll_status: periodStatus,
      forwarded_to_username: forwardedTo,
      approved_by_username: approvedBy,
    });
  } catch (err) {
    next(err);
  }
}

export async function sendPayslipEmail(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { payslipId } = req.body;
    const rows = await query(
      `SELECT p.*, e.first_name, e.last_name, e.email, pr.period_name
           FROM hr_payslips p
       JOIN hr_employees e ON e.id = p.employee_id
       JOIN hr_payroll_periods pr ON pr.id = p.period_id
         WHERE p.id = :id AND e.company_id = :companyId`,
      { id: payslipId, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Payslip not found");
    const p = rows[0];
    if (!p.email) throw httpError(400, "BAD_REQUEST", "Employee email not set");

    // Check that payroll is approved before emailing payslip
    const [checkPr] = await query(
      "SELECT status FROM hr_payroll WHERE period_id = :periodId AND company_id = :companyId ORDER BY id DESC LIMIT 1",
      { periodId: p.period_id, companyId }
    ).catch(() => []);
    const prStat = String(checkPr?.status || '').toUpperCase();
    if (!['APPROVED', 'CLOSED'].includes(prStat)) {
      throw httpError(403, "FORBIDDEN", "Cannot send payslip: Processed salary for this period has not been approved yet.");
    }

    const htmlBody = `
      <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
        <h2 style="color: #1d4ed8; margin-top: 0;">Payslip for ${p.period_name}</h2>
        <p>Dear ${p.first_name} ${p.last_name},</p>
        <p>Your payslip for ${p.period_name} has been generated and is now available for your review. Please find the detailed PDF copy attached.</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Basic Salary</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.basic_salary).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Allowances</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.allowances).toFixed(2)}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Deductions</strong></td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(p.deductions).toFixed(2)}</td>
            </tr>
            <tr style="font-size: 1.1em;">
              <td style="padding: 12px 0;"><strong>Net Salary</strong></td>
              <td style="padding: 12px 0; text-align: right; color: #15803d;"><strong>${Number(p.net_salary).toFixed(2)}</strong></td>
            </tr>
          </table>
        </div>
        <p>Regards,<br/>Human Resources Department</p>
      </div>
    `;

    // Two-step PDF generation: 1) fetch rendered HTML, 2) convert to PDF
    let attachments = [];
    try {
      const port = req.socket.localPort || process.env.PORT || 5000;
      const baseUrl = `http://127.0.0.1:${port}`;
      const token = req.headers.authorization;
      const fwdHeaders = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: token } : {}),
        ...(req.headers["x-company-id"]
          ? { "x-company-id": req.headers["x-company-id"] }
          : {}),
        ...(req.headers["x-branch-id"]
          ? { "x-branch-id": req.headers["x-branch-id"] }
          : {}),
      };

      // Step 1: Get the rendered HTML
      const htmlUrl = `${baseUrl}/api/documents/salary-slip/${payslipId}/render`;
      const htmlRes = await fetch(htmlUrl, {
        method: "POST",
        headers: fwdHeaders,
        body: JSON.stringify({ format: "html" }),
      });
      if (!htmlRes.ok) {
        console.warn(
          "[SEND-PAYSLIP] Failed to fetch HTML, status:",
          htmlRes.status,
        );
        throw new Error("HTML fetch failed");
      }
      const payslipHtml = await htmlRes.text();

      // Step 2: Convert HTML to PDF via the raw-html-to-pdf endpoint
      const pdfUrl = `${baseUrl}/api/documents/raw-html-to-pdf`;
      const pdfRes = await fetch(pdfUrl, {
        method: "POST",
        headers: fwdHeaders,
        body: JSON.stringify({ html: payslipHtml }),
      });
      if (!pdfRes.ok) {
        console.warn(
          "[SEND-PAYSLIP] Failed to generate PDF, status:",
          pdfRes.status,
        );
        throw new Error("PDF generation failed");
      }
      const arrayBuffer = await pdfRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      if (buffer.length > 0) {
        const safeName = `Payslip_${p.period_name.replace(/\s+/g, "_")}_${p.first_name}_${p.last_name}.pdf`;
        attachments.push({
          filename: safeName,
          content: buffer,
          contentType: "application/pdf",
        });
        console.log(
          `[SEND-PAYSLIP] PDF attached: ${safeName} (${buffer.length} bytes)`,
        );
      }
    } catch (e) {
      console.warn(
        "[SEND-PAYSLIP] Warning: Error generating PDF attachment:",
        e.message,
      );
    }

    await sendMail({
      to: p.email,
      subject: `Your Payslip for ${p.period_name}`,
      html: htmlBody,
      attachments,
    });

    res.json({ message: "Payslip sent to " + p.email });
  } catch (err) {
    next(err);
  }
}

export async function getPayrollBreakdown(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { payroll_id, period_id } = req.query;
    let pid = payroll_id ? Number(payroll_id) : null;
    if (!pid && period_id) {
      const r = await query(
        `SELECT id, period_id,
          created_at FROM hr_payroll
         WHERE company_id = :companyId AND period_id = :period_id ORDER BY id DESC LIMIT 1`,
        { companyId, period_id },
      );
      if (r.length) pid = Number(r[0].id);
    }
    if (!pid) {
      const r = await query(
        `SELECT id, period_id,
          created_at FROM hr_payroll
         WHERE company_id = :companyId ORDER BY id DESC LIMIT 1`,
        { companyId },
      );
      if (!r.length) {
        res.json({ payroll_id: null, period_id: null, items: [] });
        return;
      }
      pid = Number(r[0].id);
    }
    const colRows = await query(
      `SELECT COLUMN_NAME AS name,
          created_at FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payroll_items'
         AND COLUMN_NAME LIKE 'allowance\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const allowanceCols = Array.isArray(colRows)
      ? colRows.map((r) => String(r.name))
      : [];
    const loanColRows = await query(
      `SELECT COLUMN_NAME AS name,
          created_at FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'hr_payroll_items'
         AND COLUMN_NAME LIKE 'loan\\_%' ESCAPE '\\'
       ORDER BY COLUMN_NAME ASC`,
      {},
    ).catch(() => []);
    const loanCols = Array.isArray(loanColRows)
      ? loanColRows.map((r) => String(r.name))
      : [];
    const employeeComponentMeta = await query(
      `SELECT column_name, label, component_type, is_earning, display_order
         FROM hr_salary_components
        WHERE company_id = :companyId AND is_active = 1
          AND column_name REGEXP '^employee_component_[0-9]+$'
        ORDER BY display_order ASC, label ASC`,
      { companyId },
    ).catch(() => []);
    const employeeComponentCols = employeeComponentMeta
      .map((component) => String(component.column_name))
      .filter((name) => /^employee_component_\d+$/.test(name));
    const fixedCols = [
      "pi.employee_id",
      "pi.basic_salary",
      "pi.allowances",
      "pi.deductions",
      "pi.income_tax",
      "pi.ssf_employee",
      "COALESCE(pi.ssf_employer, 0) AS ssf_employer",
      "pi.loan_deductions_total",
      "pi.tier3_employee",
      "COALESCE(pi.tier3_employer, 0) AS tier3_employer",
      "COALESCE(pi.tier3_tax_exempt, 0) AS tier3_tax_exempt",
      "COALESCE(pi.tier3_taxable_excess, 0) AS tier3_taxable_excess",
      "COALESCE(pi.tax_relief, 0) AS tax_relief",
      "pi.net_salary",
      "pi.subtotal_a",
      "pi.subtotal_b",
      "pi.paye_bracket_id",
      "pi.paye_rate",
    ];
    const selectCols = fixedCols
      .concat(allowanceCols.map((c) => `pi.${c}`))
      .concat(loanCols.map((c) => `pi.${c}`))
      .concat(employeeComponentCols.map((c) => `pi.${c}`))
      .join(", ");
    const rows = await query(
      `SELECT pi.payroll_id, ${selectCols},
          e.first_name, e.last_name, e.emp_code, e.bank_name,
          COALESCE(e.bank_account_no, e.bank_account_number) AS bank_account_no,
        pi.created_at FROM hr_payroll_items pi
       JOIN hr_employees e ON e.id = pi.employee_id
         WHERE pi.payroll_id = :pid AND e.company_id = :companyId
       ORDER BY e.emp_code ASC`,
      { pid, companyId },
    );
    // Load actual loan repayments for this payroll to expose real per-loan items
    // and exclude completed/non-active loans from Salary Breakdown display.
    const repayRows = await query(
      `SELECT lr.employee_id, lr.loan_id, lr.amount_paid, l.loan_type, l.status AS loan_status,
          COALESCE(lt.account_id, l.payment_account_id) AS account_id,
          a.code AS account_code, a.name AS account_name,
          lr.created_at FROM hr_loan_repayments lr 
       JOIN hr_loans l ON l.id = lr.loan_id
       LEFT JOIN hr_setup_loan_types lt ON lt.id = l.loan_id OR lt.name = l.loan_type
       LEFT JOIN fin_accounts a ON a.id = lt.account_id
         WHERE lr.payroll_id = :pid 
         AND lr.amount_paid > 0`,
      { pid },
    ).catch(() => []);
    const repayByEmp = {};
    const loanSummaryMap = {};
    for (const rr of repayRows || []) {
      const eid = Number(rr.employee_id);
      if (!repayByEmp[eid]) repayByEmp[eid] = [];
      const amt = Number(rr.amount_paid || 0);
      repayByEmp[eid].push({
        loan_id: Number(rr.loan_id),
        loan_type: rr.loan_type || "Staff Loan",
        amount: amt,
        account_id: rr.account_id ? Number(rr.account_id) : null,
        account_code: rr.account_code || null,
        account_name: rr.account_name || `Staff Loan - ${rr.loan_type || "Loan"}`,
      });

      const key = String(rr.account_id || rr.loan_type || "staff_loan");
      if (!loanSummaryMap[key]) {
        loanSummaryMap[key] = {
          account_id: rr.account_id ? Number(rr.account_id) : null,
          account_code: rr.account_code || null,
          account_name: rr.account_name || `Staff Loan - ${rr.loan_type || "Loan"}`,
          loan_type: rr.loan_type || "Staff Loan",
          total_amount: 0,
          repayment_count: 0,
        };
      }
      loanSummaryMap[key].total_amount += amt;
      loanSummaryMap[key].repayment_count += 1;
    }

    const items = rows.map((r) => {
      const allowances = {};
      for (const col of allowanceCols) {
        const id = col.replace("allowance_", "");
        const val = Number(r[col] || 0);
        if (val !== 0) allowances[id] = val;
      }
      const loans = {};
      for (const col of loanCols) {
        const id = col.replace("loan_", "");
        const val = Number(r[col] || 0);
        if (val !== 0) loans[id] = val;
      }
      const customComponents = employeeComponentMeta.flatMap((component) => {
        const amount = Number(r[component.column_name] || 0);
        return amount !== 0
          ? [
              {
                column_name: component.column_name,
                label: component.label,
                component_type: component.component_type,
                is_earning: Boolean(Number(component.is_earning)),
                amount,
              },
            ]
          : [];
      });
      const employeeEarningsTotal = customComponents
        .filter((component) => component.is_earning)
        .reduce((sum, component) => sum + component.amount, 0);
      const out = {
        employee_id: r.employee_id,
        emp_code: r.emp_code,
        first_name: r.first_name,
        last_name: r.last_name,
        bank_name: r.bank_name || null,
        bank_account_no: r.bank_account_no || null,
        basic_salary: Number(r.basic_salary || 0),
        allowances_raw: Number(r.allowances || 0),
        allowances_total: Math.max(
          0,
          Number(r.allowances || 0) - employeeEarningsTotal,
        ),
        allowances,
        ssf_employee: Number(r.ssf_employee || 0),
        ssf_employer: Number(r.ssf_employer || 0),
        tier3_employee: Number(r.tier3_employee || 0),
        tier3_employer: Number(r.tier3_employer || 0),
        tier3_tax_exempt: Number(r.tier3_tax_exempt || 0),
        tier3_taxable_excess: Number(r.tier3_taxable_excess || 0),
        tax_relief: Number(r.tax_relief || 0),
        loan_deductions: Number(r.loan_deductions_total || 0),
        income_tax: Number(r.income_tax || 0),
        subtotal_a: Number(r.subtotal_a || 0),
        subtotal_b: Number(r.subtotal_b || 0),
        paye_bracket_id: r.paye_bracket_id || null,
        paye_rate: r.paye_rate !== null ? Number(r.paye_rate) : null,
        deductions: Number(r.deductions || 0),
        net_salary: Number(r.net_salary || 0),
        loan_items: loans,
        employee_components: customComponents,
      };
      // Merge actual repayments for precise per-loan breakdown
      if (repayByEmp[r.employee_id]) {
        const realLoans = {};
        for (const it of repayByEmp[r.employee_id]) {
          realLoans[String(it.loan_id)] = {
            loan_id: it.loan_id,
            loan_type: it.loan_type,
            amount: it.amount,
            account_id: it.account_id,
            account_code: it.account_code,
            account_name: it.account_name,
          };
        }
        // Build map for UI compatibility
        out.loan_items = realLoans;
        // Prefer actual total if columns were absent
        const sum = repayByEmp[r.employee_id].reduce(
          (s, v) => s + Number(v.amount || 0),
          0,
        );
        out.loan_deductions = sum;
        if (Number(r.loan_deductions_total || 0) === 0 && sum > 0) {
          out.net_salary = Math.max(0, out.net_salary - sum);
        }
      }
      return out;
    });
    const [prRow] = await query(
      "SELECT id, status, forwarded_to_username, approved_by_username, approved_at FROM hr_payroll WHERE id = :pid",
      { pid }
    ).catch(() => []);
    const pStatus = prRow ? prRow.status : 'OPEN';
    const isApproved = ['APPROVED', 'CLOSED'].includes(String(pStatus || '').toUpperCase());

    res.json({
      payroll_id: pid,
      period_id: period_id || null,
      payroll_status: pStatus,
      forwarded_to_username: prRow?.forwarded_to_username || null,
      approved_by_username: prRow?.approved_by_username || null,
      approved_at: prRow?.approved_at || null,
      is_approved: isApproved,
      items,
      loan_summary: Object.values(loanSummaryMap),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Medical Policy APIs
 */
export async function listMedicalPolicies(req, res, next) {
  try {
    await ensureHRTables();
    await ensureMedicalPolicyAttachmentColumns();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_medical_policies
         WHERE company_id = :companyId AND is_active = 1 ORDER BY policy_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function getMedicalPolicy(req, res, next) {
  try {
    await ensureMedicalPolicyAttachmentColumns();
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT *,
          created_at FROM hr_medical_policies
         WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length)
      throw httpError(404, "NOT_FOUND", "Medical policy not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveMedicalPolicy(req, res, next) {
  try {
    await ensureMedicalPolicyAttachmentColumns();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      policy_code,
      policy_name,
      provider,
      description,
      coverage_details,
      attachment_url,
      attachment_name,
      premium_amount,
      renewal_date,
      is_active,
    } = req.body;
    const effectivePolicyCode = id
      ? policy_code
      : await getNextMedicalPolicyCode(companyId);
    if (!attachment_url) {
      throw httpError(
        400,
        "VALIDATION_ERROR",
        "Medical policy attachment is required",
      );
    }

    const params = {
      policy_code: effectivePolicyCode,
      policy_name,
      provider,
      description,
      coverage_details,
      attachment_url,
      attachment_name: attachment_name || null,
      premium_amount: toNumber(premium_amount, 0),
      renewal_date: renewal_date || null,
      is_active: is_active ? 1 : 0,
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_medical_policies SET 
          policy_code = :policy_code, policy_name = :policy_name, provider = :provider,
          description = :description, coverage_details = :coverage_details,
          attachment_url = :attachment_url, attachment_name = :attachment_name,
          premium_amount = :premium_amount, renewal_date = :renewal_date,
          is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Medical policy updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_medical_policies (
          company_id, branch_id, policy_code, policy_name, provider, 
          description, coverage_details, attachment_url, attachment_name, premium_amount, renewal_date, 
          is_active, created_by
        ) VALUES (
          :companyId, :branchId, :policy_code, :policy_name, :provider,
          :description, :coverage_details, :attachment_url, :attachment_name, :premium_amount, :renewal_date,
          :is_active, :userId
        )`,
        { ...params, branchId, branchIdsStr },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Medical policy created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Allowance APIs
 */
export async function listAllowances(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT * FROM hr_allowances
         WHERE company_id = :companyId AND is_active = 1 ORDER BY allowance_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveAllowance(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      allowance_code,
      allowance_name,
      amount_type,
      amount,
      is_taxable,
      is_active,
    } = req.body;

    const params = {
      allowance_code,
      allowance_name,
      amount_type,
      amount: toNumber(amount, 0),
      is_taxable: is_taxable ? 1 : 0,
      is_active: is_active ? 1 : 0,
      userId,
      companyId,
    };

    if (id) {
      await query(
        `UPDATE hr_allowances SET 
          allowance_code = :allowance_code, allowance_name = :allowance_name, 
          amount_type = :amount_type, amount = :amount, 
          is_taxable = :is_taxable, is_active = :is_active, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id },
      );
      res.json({ message: "Allowance updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_allowances (company_id, branch_id, allowance_code, allowance_name, amount_type, amount, is_taxable, is_active, created_by)
         VALUES (:companyId, :branchId, :allowance_code, :allowance_name, :amount_type, :amount, :is_taxable, :is_active, :userId)`,
        { ...params, branchId, branchIdsStr },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Allowance created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Loan APIs
 */
export async function listLoans(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};

    const { employee_id, status, tab, search } = req.query;
    const clauses = [
      "(l.company_id = :companyId OR l.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(l.branch_id, :branchIdsStr))",
    ];
    const params = { companyId, branchId, branchIdsStr };

    if (employee_id) {
      clauses.push("l.employee_id = :employee_id");
      params.employee_id = employee_id;
    }

    if (status) {
      clauses.push("l.status = :status");
      params.status = status;
    } else if (tab === "awaiting_disbursement") {
      clauses.push("l.status = 'APPROVED'");
    } else if (tab === "active") {
      clauses.push("l.status = 'ACTIVE'");
    } else if (tab === "completed") {
      clauses.push("l.status = 'COMPLETED'");
    } else {
      // By default in Loan Disbursement / Employee Loans, show approved, active, and completed loans
      clauses.push("l.status IN ('APPROVED', 'ACTIVE', 'COMPLETED')");
    }

    if (search) {
      clauses.push(
        "(e.first_name LIKE :search OR e.last_name LIKE :search OR e.emp_code LIKE :search OR l.loan_type LIKE :search OR l.disbursement_voucher_no LIKE :search)",
      );
      params.search = `%${search}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT l.*, e.first_name, e.last_name, e.emp_code,
              lt.account_id as loan_type_account_id,
              COALESCE(u.full_name, u.username) as created_by_name,
              COALESCE(appr.full_name, appr.username) as approved_by_name,
              COALESCE(disb.full_name, disb.username) as disbursed_by_name,
              pa.name as payment_account_name,
              pa.code as payment_account_code,
              COALESCE(l.disbursement_voucher_no, fv.voucher_no) as linked_disbursement_voucher_no,
              l.created_at
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       LEFT JOIN hr_setup_loan_types lt ON (lt.name = l.loan_type AND (lt.company_id = l.company_id OR lt.company_id = 1 OR lt.company_id IS NULL))
       LEFT JOIN adm_users u ON u.id = l.created_by
       LEFT JOIN adm_users appr ON appr.id = l.approved_by
       LEFT JOIN adm_users disb ON disb.id = l.disbursed_by
       LEFT JOIN fin_accounts pa ON pa.id = l.payment_account_id
       LEFT JOIN fin_vouchers fv ON fv.id = l.disbursement_voucher_id
       ${where}
       ORDER BY CASE WHEN l.status = 'APPROVED' THEN 1 WHEN l.status = 'ACTIVE' THEN 2 ELSE 3 END, l.created_at DESC`,
      params,
    );

    const loanIds = items.map((it) => it.id);
    let skipsByLoan = {};
    let repaidByLoan = {};
    if (loanIds.length > 0) {
      const skipRows = await query(
        `SELECT s.*, p.period_name 
         FROM hr_loan_skips s 
         LEFT JOIN hr_payroll_periods p ON p.id = s.period_id 
         WHERE s.loan_id IN (:loanIds) AND (s.company_id = :companyId OR s.company_id = 1)
         ORDER BY s.skip_month DESC`,
        { loanIds, companyId },
      ).catch(() => []);
      for (const s of skipRows) {
        if (!skipsByLoan[s.loan_id]) skipsByLoan[s.loan_id] = [];
        skipsByLoan[s.loan_id].push(s);
      }

      const repayRows = await query(
        `SELECT loan_id, SUM(amount_paid) as total_repaid, COUNT(*) as repayment_count
         FROM hr_loan_repayments
         WHERE loan_id IN (:loanIds) AND (company_id = :companyId OR company_id = 1)
         GROUP BY loan_id`,
        { loanIds, companyId },
      ).catch(() => []);
      for (const r of repayRows) {
        repaidByLoan[r.loan_id] = {
          total_repaid: Number(r.total_repaid || 0),
          repayment_count: Number(r.repayment_count || 0),
        };
      }
    }

    const currentMonth = new Date().toISOString().slice(0, 7);
    const enriched = items.map((it) => {
      const loanSkips = skipsByLoan[it.id] || [];
      const repayInfo = repaidByLoan[it.id] || { total_repaid: 0, repayment_count: 0 };
      const isCurrentMonthSkipped = loanSkips.some((s) => s.skip_month === currentMonth);
      return {
        ...it,
        skips: loanSkips,
        is_current_month_skipped: isCurrentMonthSkipped,
        total_repaid: repayInfo.total_repaid,
        repayment_count: repayInfo.repayment_count,
        amount_due: Number(it.amount_due ?? it.amount ?? 0),
        amount: Number(it.amount || 0),
        monthly_installment: Number(it.monthly_installment || 0),
        disbursement_voucher_no: it.linked_disbursement_voucher_no || it.disbursement_voucher_no,
      };
    });

    res.json({ items: enriched });
  } catch (err) {
    console.error("Error in listLoans:", err);
    next(err);
  }
}

/**
 * List Loan Requests with Approval Workflow state
 */
export async function listLoanRequests(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const branchId = req.scope?.branchId || null;
    const branchIdsStr = req.scope?.branchIdsStr || "";
    const { status, employee_id, search } = req.query;

    const clauses = [
      "(l.company_id = :companyId OR l.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(l.branch_id, :branchIdsStr))",
    ];
    const params = { companyId, branchId, branchIdsStr };

    if (employee_id) {
      clauses.push("l.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    if (status) {
      clauses.push("l.status = :status");
      params.status = status;
    }
    if (search) {
      clauses.push(
        "(e.first_name LIKE :search OR e.last_name LIKE :search OR e.emp_code LIKE :search OR l.loan_type LIKE :search OR l.purpose LIKE :search)",
      );
      params.search = `%${search}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT 
         l.*,
         CONCAT('LR-', LPAD(l.id, 5, '0')) as request_number,
         e.first_name, e.last_name, e.emp_code,
         d.dept_name as department,
         p.pos_name as job_title,
         e.base_salary,
         COALESCE(u.full_name, u.username) as created_by_name,
         COALESCE(appr.full_name, appr.username) as approved_by_name,
         COALESCE(fwd.full_name, fwd.username) as forwarded_to_user_name,
         COALESCE(disb.full_name, disb.username) as disbursed_by_name,
         pa.name as payment_account_name,
         lt.account_id as loan_type_account_id,
         a.code as loan_account_code,
         a.name as loan_account_name
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_setup_loan_types lt ON (lt.name = l.loan_type AND (lt.company_id = l.company_id OR lt.company_id = 1 OR lt.company_id IS NULL))
       LEFT JOIN fin_accounts a ON a.id = lt.account_id
       LEFT JOIN adm_users u ON u.id = l.created_by
       LEFT JOIN adm_users appr ON appr.id = l.approved_by
       LEFT JOIN adm_users fwd ON fwd.id = l.forwarded_to_user_id
       LEFT JOIN adm_users disb ON disb.id = l.disbursed_by
       LEFT JOIN fin_accounts pa ON pa.id = l.payment_account_id
       ${where}
       ORDER BY l.created_at DESC`,
      params,
    );

    res.json({
      items: items.map((r) => ({
        ...r,
        amount: Number(r.amount || 0),
        amount_due: Number(r.amount_due ?? r.amount ?? 0),
        interest_rate: Number(r.interest_rate || 0),
        monthly_installment: Number(r.monthly_installment || 0),
        repayment_period_months: Number(r.repayment_period_months || 1),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get Loan by ID (with full details for disbursement and views)
 */
export async function getLoanById(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const loanId = Number(req.params.id);

    const [loan] = await query(
      `SELECT l.*,
              CONCAT('LR-', LPAD(l.id, 5, '0')) as request_number,
              e.first_name, e.last_name, e.emp_code,
              d.dept_name as department,
              p.pos_name as job_title,
              e.base_salary,
              COALESCE(u.full_name, u.username) as created_by_name,
              COALESCE(appr.full_name, appr.username) as approved_by_name,
              COALESCE(fwd.full_name, fwd.username) as forwarded_to_username,
              COALESCE(disb.full_name, disb.username) as disbursed_by_name,
              pa.name as payment_account_name,
              pa.code as payment_account_code,
              lt.account_id as loan_type_account_id,
              a.code as loan_account_code,
              a.name as loan_account_name,
              COALESCE(l.disbursement_voucher_no, fv.voucher_no) as linked_disbursement_voucher_no
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       LEFT JOIN hr_setup_loan_types lt ON (lt.name = l.loan_type AND (lt.company_id = l.company_id OR lt.company_id = 1 OR lt.company_id IS NULL))
       LEFT JOIN fin_accounts a ON a.id = lt.account_id
       LEFT JOIN adm_users u ON u.id = l.created_by
       LEFT JOIN adm_users appr ON appr.id = l.approved_by
       LEFT JOIN adm_users fwd ON fwd.id = l.forwarded_to_user_id
       LEFT JOIN adm_users disb ON disb.id = l.disbursed_by
       LEFT JOIN fin_accounts pa ON pa.id = l.payment_account_id
       LEFT JOIN fin_vouchers fv ON fv.id = l.disbursement_voucher_id
       WHERE l.id = :loanId AND (l.company_id = :companyId OR l.company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan record not found");

    res.json({
      item: {
        ...loan,
        amount: Number(loan.amount || 0),
        amount_due: Number(loan.amount_due ?? loan.amount ?? 0),
        interest_rate: Number(loan.interest_rate || 0),
        monthly_installment: Number(loan.monthly_installment || 0),
        repayment_period_months: Number(loan.repayment_period_months || 1),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new Loan Request or Direct Loan Disbursement
 * If status is ACTIVE or auto_disburse is true, it automatically creates and posts
 * a Finance Direct Payment Voucher (PV) and activates payroll deduction starting from start_date.
 */
export async function createLoanRequest(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const branchId = req.scope?.branchId || 1;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    const {
      employee_id,
      loan_type,
      amount,
      interest_rate = 0,
      repayment_period_months = 12,
      monthly_installment = 0,
      start_date,
      purpose,
      status = "ACTIVE",
      auto_disburse = false,
      forward_to_user_id = null,
      workflow_id = null,
      affect_payslip = true,
      // Finance Payment Voucher parameters:
      payment_account_id = null,
      payment_method = "Bank Transfer",
      disbursement_method = null,
      reference_no = null,
      cheque_no = null,
      cheque_date = null,
      cost_center_id = null,
      project_id = null,
      narration = null,
      disbursement_notes = null,
      notes = "",
    } = req.body;

    if (!employee_id) throw httpError(400, "BAD_REQUEST", "Please select an employee");
    if (!loan_type) throw httpError(400, "BAD_REQUEST", "Please select a loan type");
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      throw httpError(400, "BAD_REQUEST", "Please enter a valid loan amount");
    }

    // Lookup loan_id from hr_setup_loan_types
    const ltRows = await query(
      "SELECT id FROM hr_setup_loan_types WHERE name = :loan_type AND (company_id = :companyId OR company_id = 1) LIMIT 1",
      { loan_type, companyId },
    );
    const loan_id = ltRows[0]?.id || null;

    const numMonths = Math.max(1, Number(repayment_period_months || 12));
    const numRate = Number(interest_rate || 0);

    let totalRepay = numAmount;
    if (numRate > 0) {
      const interest = numAmount * (numRate / 100) * (numMonths / 12);
      totalRepay = numAmount + interest;
    }
    totalRepay = Math.round(totalRepay * 100) / 100;

    let calcInstallment = Number(monthly_installment);
    if (!calcInstallment || calcInstallment <= 0) {
      calcInstallment = Math.round((totalRepay / numMonths) * 100) / 100;
    }

    const startDateVal = start_date || new Date().toISOString().slice(0, 10);
    const sDate = new Date(startDateVal);
    sDate.setMonth(sDate.getMonth() + numMonths);
    const endDateVal = sDate.toISOString().slice(0, 10);

    const isDirectDisburse = status === "ACTIVE" || Boolean(auto_disburse) || Boolean(payment_account_id);
    const initStatus = isDirectDisburse
      ? "ACTIVE"
      : status === "PENDING_APPROVAL"
      ? "PENDING_APPROVAL"
      : "DRAFT";

    const ins = await query(
      `INSERT INTO hr_loans (
        company_id, branch_id, employee_id, loan_type, loan_id,
        amount, interest_rate, repayment_period_months, monthly_installment,
        amount_due, start_date, end_date, purpose, status, affect_payslip,
        forwarded_to_user_id, workflow_id, created_by
      ) VALUES (
        :companyId, :branchId, :employee_id, :loan_type, :loan_id,
        :amount, :interest_rate, :numMonths, :calcInstallment,
        :totalRepay, :startDateVal, :endDateVal, :purpose, :initStatus, :affect_payslip,
        :forward_to_user_id, :workflow_id, :userId
      )`,
      {
        companyId,
        branchId,
        employee_id,
        loan_type,
        loan_id,
        amount: numAmount,
        interest_rate: numRate,
        numMonths,
        calcInstallment,
        totalRepay,
        startDateVal,
        endDateVal,
        purpose: purpose || null,
        initStatus,
        affect_payslip: affect_payslip ? 1 : 0,
        forward_to_user_id: forward_to_user_id || null,
        workflow_id: workflow_id || null,
        userId,
      },
    );

    const loanRequestId = ins.insertId;
    const requestNo = `LR-${String(loanRequestId).padStart(5, "0")}`;

    let voucherId = null;
    let voucherNo = null;

    // If active disbursement, auto-generate Finance Payment Voucher (Direct Payment)
    if (isDirectDisburse) {
      const payMethod = disbursement_method || payment_method || "Bank Transfer";
      const finalNotes = disbursement_notes || notes || narration || "";

      // 1. Resolve Payment Account (Cash/Bank) based strictly on payment method
      const isBankLike = ["BANK_TRANSFER", "CHEQUE", "CREDIT_CARD"].includes(
        String(payMethod).toUpperCase().replace(/\s+/g, "_"),
      );

      let paymentAccId = payment_account_id ? Number(payment_account_id) : null;
      if (paymentAccId) {
        // Validate that provided payment account matches the payment method type
        const [accRow] = await query(
          `SELECT a.id, g.code as group_code, g.name as group_name
           FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
           WHERE a.id = :aid AND (a.company_id = :companyId OR a.company_id = 1 OR a.company_id IS NULL)`,
          { aid: paymentAccId, companyId },
        );
        if (accRow) {
          const gc = String(accRow.group_code || "").toUpperCase();
          const gn = String(accRow.group_name || "").toUpperCase();
          const matches = isBankLike
            ? gc === "AST_BANK" || gn === "BANK ACCOUNTS" || gn.includes("BANK") || gc === "1006"
            : gc === "AST_CASH" || gn === "CASH AND CASH EQUIVALENTS" || gn.includes("CASH") || gc === "1005";
          if (!matches) {
            paymentAccId = null; // Re-resolve to proper account for method
          }
        }
      }

      if (!paymentAccId) {
        const defAccRows = await query(
          `SELECT a.id, a.name FROM fin_accounts a
           JOIN fin_account_groups g ON g.id = a.group_id
           WHERE (a.company_id = :companyId OR a.company_id = 1)
             AND a.is_postable = 1 AND a.is_active = 1
             AND (${
               isBankLike
                 ? "g.code IN ('1006', 'AST_BANK') OR g.name LIKE '%Bank%'"
                 : "g.code IN ('1005', 'AST_CASH') OR g.name LIKE '%Cash%'"
             })
           ORDER BY a.id ASC LIMIT 1`,
          { companyId },
        );
        paymentAccId = defAccRows[0]?.id || null;
      }

      // 2. Resolve Loan Type Asset Account (Debit Account in Chart of Accounts)
      // Must always be the linked account to the selected loan type in hr setup page
      let loanAccountId = req.body.debit_account_id ? Number(req.body.debit_account_id) : null;
      if (loanAccountId) {
        const [accCheck] = await query(
          `SELECT id FROM fin_accounts WHERE id = :aid AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL)`,
          { aid: loanAccountId, companyId },
        );
        if (!accCheck) loanAccountId = null;
      }

      if (!loanAccountId) {
        const [lt] = await query(
          `SELECT id, name, account_id FROM hr_setup_loan_types 
           WHERE (id = :lid OR name = :loan_type) 
             AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL)
           LIMIT 1`,
          { lid: req.body.loan_type_id || loan_id, loan_type, companyId },
        );
        if (lt?.account_id) {
          const [accCheck] = await query(
            `SELECT id FROM fin_accounts WHERE id = :aid AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL)`,
            { aid: lt.account_id, companyId },
          );
          if (accCheck) loanAccountId = accCheck.id;
        }

        if (!loanAccountId) {
          loanAccountId = await ensureLoanTypeAccount({
            companyId,
            loanTypeId: lt?.id || loan_id,
            loanTypeName: lt?.name || loan_type,
          });
        }
      }

      // 3. Create Direct Payment Voucher in Finance (Saved as DRAFT without auto-posting to GL)
      if (paymentAccId && loanAccountId) {
        try {
          const fyRows = await query(
            `SELECT id FROM fin_fiscal_years WHERE (company_id = :companyId OR company_id = 1) ORDER BY is_open DESC, start_date DESC LIMIT 1`,
            { companyId },
          );
          const fiscalYearId = fyRows[0]?.id || 1;

          const vtRows = await query(
            `SELECT id, prefix, next_number FROM fin_voucher_types 
             WHERE code IN ('PAYV', 'PV') AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL) 
             ORDER BY CASE WHEN code = 'PAYV' THEN 1 ELSE 2 END LIMIT 1`,
            { companyId },
          );
          const vt = vtRows[0] || { id: 12, prefix: "PV", next_number: 1 };
          const nextNum = Number(vt.next_number || 1);
          voucherNo = `${vt.prefix || "PV"}${String(nextNum).padStart(6, "0")}`;

          await query(
            `UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE id = :vtid`,
            { vtid: vt.id },
          ).catch(() => {});

          const [emp] = await query(
            `SELECT first_name, last_name, emp_code FROM hr_employees WHERE id = :employee_id`,
            { employee_id },
          );
          const empName = `${emp?.first_name || ""} ${emp?.last_name || ""}`.trim();
          const vNarration =
            finalNotes ||
            `Loan disbursement to ${empName} (${loan_type})${purpose ? ` - ${purpose}` : ""}`;

          // Create payment voucher with status 'DRAFT' (not auto-posted to General Ledger)
          const vIns = await query(
            `INSERT INTO fin_vouchers (
              company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no,
              voucher_date, narration, currency_id, exchange_rate, total_debit,
              total_credit, balanced_amount, status, created_by, approved_by, posted_by,
              cost_center_id, project_id
            ) VALUES (
              :companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo,
              :disbDate, :narration, 1, 1, :loanAmount,
              :loanAmount, :loanAmount, 'DRAFT', :userId, NULL, NULL,
              :costCenterId, :projectId
            )`,
            {
              companyId,
              branchId,
              fiscalYearId,
              voucherTypeId: vt.id,
              voucherNo,
              disbDate: startDateVal,
              narration: vNarration,
              loanAmount: numAmount,
              userId,
              costCenterId: cost_center_id ? Number(cost_center_id) : null,
              projectId: project_id ? Number(project_id) : null,
            },
          );
          voucherId = vIns.insertId;

          // Line 1: Debit Staff Loan Asset Account (the linked account from HR setup)
          await query(
            `INSERT INTO fin_voucher_lines (
              company_id, voucher_id, line_no, account_id, description,
              debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
            ) VALUES (
              :companyId, :voucherId, 1, :loanAccountId, :desc1,
              :loanAmount, 0, :chequeDate, :paymentMethod, 1, 1, :userId
            )`,
            {
              companyId,
              voucherId,
              loanAccountId,
              desc1: `Staff loan principal disbursement - ${empName} (${loan_type})`,
              loanAmount: numAmount,
              chequeDate: cheque_date || null,
              paymentMethod: payMethod,
              userId,
            },
          );

          // Line 2: Credit Payment Account (Bank or Cash account matching payment method)
          await query(
            `INSERT INTO fin_voucher_lines (
              company_id, voucher_id, line_no, account_id, description,
              debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
            ) VALUES (
              :companyId, :voucherId, 2, :paymentAccId, :desc2,
              0, :loanAmount, :chequeDate, :paymentMethod, 1, 1, :userId
            )`,
            {
              companyId,
              voucherId,
              paymentAccId,
              desc2: `Disbursed from payment account - ${empName} (${loan_type})`,
              loanAmount: numAmount,
              chequeDate: cheque_date || null,
              paymentMethod: payMethod,
              userId,
            },
          );

          // Update hr_loans with payment voucher details & disbursement metadata
          await query(
            `UPDATE hr_loans SET
              disbursed_at = NOW(),
              disbursed_by = :userId,
              disbursement_voucher_id = :voucherId,
              disbursement_voucher_no = :voucherNo,
              payment_account_id = :paymentAccId,
              disbursement_method = :paymentMethod,
              disbursement_notes = :notes
             WHERE id = :loanId`,
            {
              userId,
              voucherId,
              voucherNo,
              paymentAccId,
              paymentMethod: payMethod,
              notes: vNarration,
              loanId: loanRequestId,
            },
          );
        } catch (pvErr) {
          console.error("Warning: Failed to create payment voucher in finance:", pvErr);
        }
      }

      // 4. Ensure dynamic payroll columns for this loan
      const colLoan = `loan_${loanRequestId}`;
      await ensureCol("hr_payroll_items", colLoan, "DECIMAL(15,2) DEFAULT 0").catch(() => {});
      await ensureCol("hr_payslips", colLoan, "DECIMAL(15,2) DEFAULT 0").catch(() => {});
      if (loan_id) {
        const colLt = `loan_${loan_id}`;
        await ensureCol("hr_payroll_items", colLt, "DECIMAL(15,2) DEFAULT 0").catch(() => {});
        await ensureCol("hr_payslips", colLt, "DECIMAL(15,2) DEFAULT 0").catch(() => {});
      }
    }

    res.status(201).json({
      success: true,
      id: loanRequestId,
      request_number: requestNo,
      status: initStatus,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      message: isDirectDisburse
        ? `Loan disbursed successfully${voucherNo ? ` (Payment Voucher #${voucherNo})` : ""}`
        : initStatus === "PENDING_APPROVAL"
        ? `Loan request ${requestNo} submitted and forwarded for approval`
        : `Loan request ${requestNo} saved as draft`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Forward Loan Request into Approval Workflow
 */
export async function forwardLoanRequest(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const loanId = Number(req.params.id);
    const { target_user_id, target_approver_id, workflow_id, comments, notes } = req.body;
    const resolvedTargetUser = target_user_id || target_approver_id || null;

    const [loan] = await query(
      `SELECT * FROM hr_loans WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan request not found");

    await query(
      `UPDATE hr_loans SET
        status = 'PENDING_APPROVAL',
        forwarded_to_user_id = :target_user_id,
        workflow_id = :workflow_id
       WHERE id = :loanId`,
      {
        target_user_id: resolvedTargetUser ? Number(resolvedTargetUser) : null,
        workflow_id: workflow_id ? Number(workflow_id) : null,
        loanId,
      },
    );

    res.json({
      success: true,
      status: "PENDING_APPROVAL",
      message: "Loan request forwarded for approval",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Approve Loan Request
 */
export async function approveLoanRequest(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const loanId = Number(req.params.id);

    const [loan] = await query(
      `SELECT * FROM hr_loans WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan request not found");

    if (loan.status === "ACTIVE" || loan.status === "COMPLETED") {
      throw httpError(400, "BAD_REQUEST", `Cannot approve loan already in ${loan.status} status`);
    }

    await query(
      `UPDATE hr_loans SET
        status = 'APPROVED',
        approved_by = :userId,
        approved_at = NOW(),
        rejection_reason = NULL
       WHERE id = :loanId`,
      { userId, loanId },
    );

    res.json({
      success: true,
      status: "APPROVED",
      message: "Loan request approved successfully! It is now ready for disbursement.",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reject Loan Request
 */
export async function rejectLoanRequest(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const loanId = Number(req.params.id);
    const { reason, comments, rejection_reason } = req.body;

    const [loan] = await query(
      `SELECT * FROM hr_loans WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan request not found");

    if (loan.status === "ACTIVE" || loan.status === "COMPLETED") {
      throw httpError(400, "BAD_REQUEST", `Cannot reject loan already in ${loan.status} status`);
    }

    await query(
      `UPDATE hr_loans SET
        status = 'REJECTED',
        rejection_reason = :rejectionReason
       WHERE id = :loanId`,
      {
        rejectionReason: rejection_reason || reason || comments || "Rejected by reviewer",
        loanId,
      },
    );

    res.json({
      success: true,
      status: "REJECTED",
      message: "Loan request has been rejected",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Reverse Loan Approval
 */
export async function reverseLoanApproval(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const loanId = Number(req.params.id);

    const [loan] = await query(
      `SELECT * FROM hr_loans WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan request not found");

    if (loan.status === "ACTIVE" || loan.status === "COMPLETED" || loan.disbursed_at) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Cannot reverse approval for a loan that has already been disbursed. Manage via disbursements.",
      );
    }

    await query(
      `UPDATE hr_loans SET
        status = 'PENDING_APPROVAL',
        approved_by = NULL,
        approved_at = NULL
       WHERE id = :loanId`,
      { loanId },
    );

    res.json({
      success: true,
      status: "PENDING_APPROVAL",
      message: "Loan request approval has been reversed to pending",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Disburse an approved loan with Finance Payment Voucher (Direct Payment)
 */
export async function disburseLoan(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const branchId = req.scope?.branchId || 1;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const loanId = Number(req.params.id);
    const {
      payment_account_id,
      disbursement_date,
      payment_method,
      disbursement_method,
      cheque_date = null,
      cost_center_id = null,
      project_id = null,
      disbursement_notes,
      notes = "",
    } = req.body;
    const paymentMethod = disbursement_method || payment_method || "Bank Transfer";
    const finalNotes = disbursement_notes || notes || "";

    const [loan] = await query(
      `SELECT l.*, e.first_name, e.last_name, e.emp_code
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       WHERE l.id = :loanId AND (l.company_id = :companyId OR l.company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan record not found");

    if (loan.status !== "APPROVED" && loan.status !== "PENDING") {
      throw httpError(
        400,
        "BAD_REQUEST",
        `Only approved loans can be disbursed. Current status: ${loan.status}`,
      );
    }

    const loanAmount = Number(loan.amount || 0);
    if (loanAmount <= 0) {
      throw httpError(400, "BAD_REQUEST", "Loan amount must be greater than zero to disburse");
    }

    const disbDate = disbursement_date || new Date().toISOString().slice(0, 10);

    // 1. Resolve Payment Account (Credit Account - Bank/Cash)
    let paymentAccId = payment_account_id ? Number(payment_account_id) : null;
    if (!paymentAccId) {
      const isBankLike = ["BANK_TRANSFER", "CHEQUE", "CREDIT_CARD", "MOBILE_MONEY"].includes(
        String(payment_method).toUpperCase(),
      );
      const defAccRows = await query(
        `SELECT a.id, a.name FROM fin_accounts a
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE (a.company_id = :companyId OR a.company_id = 1)
           AND a.is_postable = 1 AND a.is_active = 1
           AND (g.name LIKE :pattern OR g.code IN ('1005', '1006', 'AST_BANK', 'AST_CASH'))
         ORDER BY a.id ASC LIMIT 1`,
        { companyId, pattern: isBankLike ? "%Bank%" : "%Cash%" },
      );
      paymentAccId = defAccRows[0]?.id || null;
    }

    if (!paymentAccId) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Please select a valid Payment/Disbursement Account (Cash or Bank)",
      );
    }

    // 2. Resolve Loan Type Asset Account (Debit Account in Chart of Accounts)
    let loanAccountId = null;
    if (loan.loan_id) {
      const [lt] = await query(
        `SELECT account_id, name FROM hr_setup_loan_types WHERE id = :lid`,
        { lid: loan.loan_id },
      );
      loanAccountId = lt?.account_id || null;
      if (!loanAccountId) {
        loanAccountId = await ensureLoanTypeAccount({
          companyId,
          loanTypeId: loan.loan_id,
          loanTypeName: lt?.name || loan.loan_type,
        });
      }
    } else {
      const [lt] = await query(
        `SELECT id, account_id FROM hr_setup_loan_types WHERE name = :ltName LIMIT 1`,
        { ltName: loan.loan_type },
      );
      if (lt) {
        loanAccountId =
          lt.account_id ||
          (await ensureLoanTypeAccount({
            companyId,
            loanTypeId: lt.id,
            loanTypeName: loan.loan_type,
          }));
      } else {
        loanAccountId = await ensureLoanTypeAccount({
          companyId,
          loanTypeId: null,
          loanTypeName: loan.loan_type,
        });
      }
    }

    // 3. Create Payment Voucher (PV) in Finance
    let voucherId = null;
    let voucherNo = null;

    if (paymentAccId && loanAccountId) {
      try {
        const fyRows = await query(
          `SELECT id FROM fin_fiscal_years WHERE (company_id = :companyId OR company_id = 1) ORDER BY is_open DESC, start_date DESC LIMIT 1`,
          { companyId },
        );
        const fiscalYearId = fyRows[0]?.id || 1;

        // Payment Voucher: code 'PAYV' or 'PV', prefix 'PV'
        const vtRows = await query(
          `SELECT id, prefix, next_number FROM fin_voucher_types 
           WHERE code IN ('PAYV', 'PV') AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL) 
           ORDER BY CASE WHEN code = 'PAYV' THEN 1 ELSE 2 END LIMIT 1`,
          { companyId },
        );
        const vt = vtRows[0] || { id: 12, prefix: "PV", next_number: 1 };
        const nextNum = Number(vt.next_number || 1);
        voucherNo = `${vt.prefix || "PV"}${String(nextNum).padStart(6, "0")}`;

        await query(
          `UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE id = :vtid`,
          { vtid: vt.id },
        ).catch(() => {});

        const empName = `${loan.first_name || ""} ${loan.last_name || ""}`.trim();
        const narration = `Loan disbursement to ${empName} (${loan.loan_type})${notes ? ` - ${notes}` : ""}`;

        const vIns = await query(
          `INSERT INTO fin_vouchers (
            company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no,
            voucher_date, narration, currency_id, exchange_rate, total_debit,
            total_credit, balanced_amount, status, created_by, approved_by, posted_by,
            cost_center_id, project_id
          ) VALUES (
            :companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo,
            :disbDate, :narration, 1, 1, :loanAmount,
            :loanAmount, :loanAmount, 'POSTED', :userId, :userId, :userId,
            :costCenterId, :projectId
          )`,
          {
            companyId,
            branchId,
            fiscalYearId,
            voucherTypeId: vt.id,
            voucherNo,
            disbDate,
            narration,
            loanAmount,
            userId,
            costCenterId: cost_center_id ? Number(cost_center_id) : null,
            projectId: project_id ? Number(project_id) : null,
          },
        );
        voucherId = vIns.insertId;

        // Line 1: Debit Loan Receivable Account (Asset increases)
        await query(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description,
            debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
          ) VALUES (
            :companyId, :voucherId, 1, :loanAccountId, :desc1,
            :loanAmount, 0, :chequeDate, :paymentMethod, 1, 1, :userId
          )`,
          {
            companyId,
            voucherId,
            loanAccountId,
            desc1: `Loan principal disbursement - ${empName} (${loan.loan_type})`,
            loanAmount,
            chequeDate: cheque_date || null,
            paymentMethod: payment_method || "Bank Transfer",
            userId,
          },
        );

        // Line 2: Credit Payment Account (Bank / Cash decreases)
        await query(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description,
            debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
          ) VALUES (
            :companyId, :voucherId, 2, :paymentAccId, :desc2,
            0, :loanAmount, :chequeDate, :paymentMethod, 1, 1, :userId
          )`,
          {
            companyId,
            voucherId,
            paymentAccId,
            desc2: `Disbursed from payment account - ${empName} (${loan.loan_type})`,
            loanAmount,
            chequeDate: cheque_date || null,
            paymentMethod: payment_method || "Bank Transfer",
            userId,
          },
        );
      } catch (pvErr) {
        console.error("Warning: Failed to auto-generate payment voucher in finance:", pvErr);
      }
    }

    // 4. Update hr_loans to ACTIVE and set amount_due
    await query(
      `UPDATE hr_loans SET
        status = 'ACTIVE',
        amount_due = :loanAmount,
        start_date = :disbDate,
        disbursed_at = NOW(),
        disbursed_by = :userId,
        disbursement_voucher_id = :voucherId,
        disbursement_voucher_no = :voucherNo,
        payment_account_id = :paymentAccId,
        disbursement_method = :paymentMethod,
        disbursement_notes = :notes
       WHERE id = :loanId`,
      {
        loanAmount,
        disbDate,
        userId,
        voucherId,
        voucherNo,
        paymentAccId,
        paymentMethod,
        notes: finalNotes || null,
        loanId,
      },
    );

    res.json({
      success: true,
      message: `Loan of GHS ${loanAmount.toLocaleString()} disbursed successfully${voucherNo ? ` (Payment Voucher #${voucherNo})` : ""}`,
      status: "ACTIVE",
      voucher_id: voucherId,
      voucher_no: voucherNo,
      disbursement_voucher_no: voucherNo,
      disbursement_voucher_id: voucherId,
      disbursed_at: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

export async function saveLoan(req, res, next) {
  try {
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      employee_id,
      loan_type,
      amount,
      interest_rate,
      repayment_period_months,
      monthly_installment,
      start_date,
      status,
    } = req.body;

    // Lookup loan_id from hr_setup_loan_types
    const ltRows = await query(
      "SELECT id FROM hr_setup_loan_types WHERE name = :loan_type AND company_id = :companyId LIMIT 1",
      { loan_type, companyId },
    );
    const loan_id = ltRows?.[0]?.id || null;

    const params = {
      employee_id,
      loan_type,
      loan_id,
      amount: toNumber(amount, 0),
      interest_rate: toNumber(interest_rate, 0),
      repayment_period_months: toNumber(repayment_period_months, 0),
      monthly_installment: toNumber(monthly_installment, 0),
      start_date: start_date || null,
      status: status || "PENDING",
      userId,
      companyId,
    };

    // Use frontend values if provided, otherwise default to current calculation
    // Note: Database triggers will also ensure these are calculated on insert/update
    let endDate = req.body.end_date || null;
    let amountDue =
      req.body.amount_due !== undefined
        ? toNumber(req.body.amount_due, params.amount)
        : params.amount;

    if (!endDate && params.start_date) {
      const start = new Date(params.start_date);
      const end = new Date(start);
      end.setMonth(start.getMonth() + params.repayment_period_months);
      endDate = end.toISOString().split("T")[0];
    }

    const finalParams = { ...params, endDate, amountDue };

    if (id) {
      await query(
        `UPDATE hr_loans SET 
          loan_type = :loan_type, loan_id = :loan_id, amount = :amount, interest_rate = :interest_rate, 
          repayment_period_months = :repayment_period_months, monthly_installment = :monthly_installment, 
          start_date = :start_date, status = :status, end_date = :endDate, amount_due = :amountDue, updated_by = :userId
         WHERE id = :id AND company_id = :companyId`,
        { ...finalParams, id },
      );

      if (params.loan_id) {
        const colName = `loan_${params.loan_id}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      const colName = `loan_${id}`;
      await ensureCol(
        "hr_payroll_items",
        colName,
        "DECIMAL(15,2) DEFAULT 0",
      ).catch(() => {});
      await ensureCol("hr_payslips", colName, "DECIMAL(15,2) DEFAULT 0").catch(
        () => {},
      );

      res.json({ message: "Loan updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_loans (company_id, branch_id, employee_id, loan_type, loan_id, amount, interest_rate, repayment_period_months, monthly_installment, start_date, status, end_date, amount_due, created_by)
         VALUES (:companyId, :branchId, :employee_id, :loan_type, :loan_id, :amount, :interest_rate, :repayment_period_months, :monthly_installment, :start_date, :status, :endDate, :amountDue, :userId)`,
        { ...finalParams, branchId, branchIdsStr },
      );

      if (params.loan_id) {
        const colName = `loan_${params.loan_id}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      const lref = result.insertId;
      if (lref) {
        const colName = `loan_${lref}`;
        await ensureCol(
          "hr_payroll_items",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
        await ensureCol(
          "hr_payslips",
          colName,
          "DECIMAL(15,2) DEFAULT 0",
        ).catch(() => {});
      }

      res.status(201).json({ id: result.insertId, message: "Loan created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Get active loans for a specific payroll period and check whether they are skipped
 */
export async function getLoansPeriodStatus(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const period_id = req.query.period_id ? Number(req.query.period_id) : null;
    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");

    const periods = await query(
      `SELECT * FROM hr_payroll_periods 
       WHERE id = :period_id 
         AND (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL OR 1=1)
       LIMIT 1`,
      { period_id, companyId },
    );
    const period = periods?.[0];
    if (!period) throw httpError(404, "NOT_FOUND", "Payroll period not found");

    let periodMonth = "";
    if (period.start_date) {
      const pDate = new Date(period.start_date);
      if (!isNaN(pDate.getTime())) {
        periodMonth = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    const pEndDate = period.end_date
      ? new Date(period.end_date).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);

    const loans = await query(
      `SELECT l.id, l.employee_id, l.loan_type, l.amount, l.monthly_installment, l.amount_due, l.status,
              e.emp_code, e.first_name, e.last_name,
              s.id as skip_id, s.reason as skip_reason
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       LEFT JOIN hr_loan_skips s ON s.loan_id = l.id 
         AND (s.company_id = :companyId OR s.company_id IS NULL OR :companyId IS NULL) 
         AND (s.period_id = :periodId OR s.skip_month = :periodMonth)
       WHERE (l.company_id = :companyId OR l.company_id IS NULL OR :companyId IS NULL)
         AND l.status = 'ACTIVE'
         AND l.amount_due > 0
         AND (l.affect_payslip = 1 OR l.affect_payslip IS NULL)
         AND (l.start_date IS NULL OR l.start_date <= :pEndDate)
       ORDER BY e.first_name ASC`,
      { companyId, periodId: period_id, periodMonth, pEndDate },
    );

    res.json({
      period,
      period_month: periodMonth,
      items: loans.map((l) => ({
        ...l,
        amount: Number(l.amount || 0),
        amount_due: Number(l.amount_due ?? l.amount ?? 0),
        monthly_installment: Number(l.monthly_installment || 0),
        is_skipped: Boolean(l.skip_id),
      })),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Add a skip record so that a loan deduction is skipped for a given month/period
 */
export async function addLoanSkip(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const loanId = Number(req.params.id);
    let { period_id, skip_month, reason } = req.body;

    if (!loanId) throw httpError(400, "BAD_REQUEST", "loan_id required");

    // Verify loan exists and belongs to company
    const [loan] = await query(
      `SELECT id, employee_id, amount_due, status FROM hr_loans 
       WHERE id = :loanId AND (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan not found");

    if (period_id && !skip_month) {
      const [period] = await query(
        `SELECT start_date FROM hr_payroll_periods 
         WHERE id = :period_id AND (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL)`,
        { period_id, companyId },
      );
      if (period?.start_date) {
        const d = new Date(period.start_date);
        if (!isNaN(d.getTime())) {
          skip_month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        }
      }
    }

    if (!skip_month) {
      throw httpError(400, "BAD_REQUEST", "skip_month (YYYY-MM) or period_id required");
    }

    await query(
      `INSERT INTO hr_loan_skips (company_id, loan_id, period_id, skip_month, reason, created_by)
       VALUES (:companyId, :loanId, :period_id, :skip_month, :reason, :userId)
       ON DUPLICATE KEY UPDATE reason = :reason, period_id = :period_id, created_by = :userId`,
      {
        companyId,
        loanId,
        period_id: period_id ? Number(period_id) : null,
        skip_month,
        reason: reason || "Skipped for this month",
        userId,
      },
    );

    res.json({
      success: true,
      message: `Loan deduction skipped for ${skip_month}`,
      skip_month,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Remove a skip record so that deduction resumes for that month
 */
export async function removeLoanSkip(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const loanId = Number(req.params.id);
    const skipId = Number(req.params.skipId);

    await query(
      `DELETE FROM hr_loan_skips 
       WHERE id = :skipId AND loan_id = :loanId AND (company_id = :companyId OR company_id IS NULL OR :companyId IS NULL)`,
      { skipId, loanId, companyId },
    );

    res.json({ success: true, message: "Loan deduction skip removed" });
  } catch (err) {
    next(err);
  }
}

/**
 * List all skips configured for a loan
 */
export async function listLoanSkips(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const loanId = Number(req.params.id);

    const skips = await query(
      `SELECT s.*, p.period_name, COALESCE(u.full_name, u.username) as created_by_name
       FROM hr_loan_skips s
       LEFT JOIN hr_payroll_periods p ON p.id = s.period_id
       LEFT JOIN adm_users u ON u.id = s.created_by
       WHERE s.loan_id = :loanId AND s.company_id = :companyId
       ORDER BY s.skip_month DESC`,
      { loanId, companyId },
    );

    res.json({ items: skips });
  } catch (err) {
    next(err);
  }
}

/**
 * Record a manual loan payment or manual deduction
 */
export async function recordManualRepayment(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const branchId = req.scope?.branchId || 1;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const loanId = Number(req.params.id);
    const {
      amount_paid,
      payment_date,
      payment_method = "CASH",
      deposit_account_id,
      cheque_date = null,
      cost_center_id = null,
      project_id = null,
      reference = "",
      notes = "",
    } = req.body;

    const payAmt = Number(amount_paid);
    if (!payAmt || isNaN(payAmt) || payAmt <= 0) {
      throw httpError(400, "BAD_REQUEST", "Please enter a valid positive payment amount");
    }

    const [loan] = await query(
      `SELECT l.id, l.employee_id, l.loan_type, l.loan_id, l.amount, l.amount_due, l.status,
              e.first_name, e.last_name, e.emp_code
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       WHERE l.id = :loanId AND (l.company_id = :companyId OR l.company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan not found");

    const currentDue = Number(loan.amount_due ?? loan.amount ?? 0);
    if (currentDue <= 0) {
      throw httpError(400, "BAD_REQUEST", "This loan has already been fully repaid");
    }

    if (payAmt > currentDue) {
      throw httpError(
        400,
        "BAD_REQUEST",
        `Payment amount cannot exceed the remaining balance of ${currentDue.toFixed(2)}`,
      );
    }

    const newAmountDue = Math.max(0, currentDue - payAmt);
    const newStatus = newAmountDue <= 0 ? "COMPLETED" : loan.status;
    const payDate = payment_date || new Date().toISOString().slice(0, 10);

    // 1. Resolve Deposit Account (Bank or Cash Account)
    let depositAccId = deposit_account_id ? Number(deposit_account_id) : null;
    if (!depositAccId) {
      const isBankLike = ["BANK_TRANSFER", "CHEQUE", "CREDIT_CARD", "MOBILE_MONEY"].includes(
        String(payment_method).toUpperCase(),
      );
      const defAccRows = await query(
        `SELECT a.id, a.name FROM fin_accounts a
         JOIN fin_account_groups g ON g.id = a.group_id
         WHERE (a.company_id = :companyId OR a.company_id = 1)
           AND a.is_postable = 1 AND a.is_active = 1
           AND (g.name LIKE :pattern OR g.code IN ('1005', '1006', 'AST_BANK', 'AST_CASH'))
         ORDER BY a.id ASC LIMIT 1`,
        { companyId, pattern: isBankLike ? "%Bank%" : "%Cash%" },
      );
      depositAccId = defAccRows[0]?.id || null;
    }

    // 2. Resolve Credit Account (Employee Loan Receivable account from loan type)
    let loanAccountId = null;
    if (loan.loan_id) {
      const [lt] = await query(
        `SELECT account_id, name FROM hr_setup_loan_types WHERE id = :lid`,
        { lid: loan.loan_id },
      );
      loanAccountId = lt?.account_id || null;
      if (!loanAccountId) {
        loanAccountId = await ensureLoanTypeAccount({
          companyId,
          loanTypeId: loan.loan_id,
          loanTypeName: lt?.name || loan.loan_type,
        });
      }
    } else {
      const [lt] = await query(
        `SELECT id, account_id FROM hr_setup_loan_types WHERE name = :ltName LIMIT 1`,
        { ltName: loan.loan_type },
      );
      if (lt) {
        loanAccountId =
          lt.account_id ||
          (await ensureLoanTypeAccount({
            companyId,
            loanTypeId: lt.id,
            loanTypeName: loan.loan_type,
          }));
      } else {
        loanAccountId = await ensureLoanTypeAccount({
          companyId,
          loanTypeId: null,
          loanTypeName: loan.loan_type,
        });
      }
    }

    // 3. Create Receipt Voucher (RV) in Finance if Deposit Account and Loan Account exist
    let voucherId = null;
    let voucherNo = null;

    if (depositAccId && loanAccountId) {
      try {
        const fyRows = await query(
          `SELECT id FROM fin_fiscal_years WHERE (company_id = :companyId OR company_id = 1) ORDER BY is_open DESC, start_date DESC LIMIT 1`,
          { companyId },
        );
        const fiscalYearId = fyRows[0]?.id || 1;

        const vtRows = await query(
          `SELECT id, prefix, next_number FROM fin_voucher_types WHERE code = 'RV' AND (company_id = :companyId OR company_id = 1 OR company_id IS NULL) LIMIT 1`,
          { companyId },
        );
        const vt = vtRows[0] || { id: 1, prefix: "RV", next_number: 1 };
        const nextNum = Number(vt.next_number || 1);
        voucherNo = `${vt.prefix || "RV"}${String(nextNum).padStart(6, "0")}`;

        await query(
          `UPDATE fin_voucher_types SET next_number = next_number + 1 WHERE id = :vtid`,
          { vtid: vt.id },
        ).catch(() => {});

        const empName = `${loan.first_name || ""} ${loan.last_name || ""}`.trim();
        const narration = `Direct Receipt: Loan repayment from ${empName} (${loan.loan_type})${notes ? ` - ${notes}` : ""}`;

        const vIns = await query(
          `INSERT INTO fin_vouchers (
            company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no,
            voucher_date, narration, currency_id, exchange_rate, total_debit,
            total_credit, balanced_amount, status, created_by, approved_by, posted_by,
            cost_center_id, project_id
          ) VALUES (
            :companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo,
            :payDate, :narration, 1, 1, :payAmt,
            :payAmt, :payAmt, 'POSTED', :userId, :userId, :userId,
            :costCenterId, :projectId
          )`,
          {
            companyId,
            branchId,
            fiscalYearId,
            voucherTypeId: vt.id,
            voucherNo,
            payDate,
            narration,
            payAmt,
            userId,
            costCenterId: cost_center_id ? Number(cost_center_id) : null,
            projectId: project_id ? Number(project_id) : null,
          },
        );
        voucherId = vIns.insertId;

        // Line 1: Debit Deposit Account (Cash / Bank)
        await query(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description,
            debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
          ) VALUES (
            :companyId, :voucherId, 1, :depositAccId, :desc1,
            :payAmt, 0, :chequeDate, :paymentMethod, 1, 1, :userId
          )`,
          {
            companyId,
            voucherId,
            depositAccId,
            desc1: `Direct receipt to deposit account - ${empName} (${loan.loan_type})`,
            payAmt,
            chequeDate: cheque_date || null,
            paymentMethod: payment_method || "CASH",
            userId,
          },
        );

        // Line 2: Credit Loan Receivable Account
        await query(
          `INSERT INTO fin_voucher_lines (
            company_id, voucher_id, line_no, account_id, description,
            debit, credit, cheque_date, payment_method, currency_id, exchange_rate, created_by
          ) VALUES (
            :companyId, :voucherId, 2, :loanAccountId, :desc2,
            0, :payAmt, :chequeDate, :paymentMethod, 1, 1, :userId
          )`,
          {
            companyId,
            voucherId,
            loanAccountId,
            desc2: `Loan repayment credit - ${empName} (${loan.loan_type})`,
            payAmt,
            chequeDate: cheque_date || null,
            paymentMethod: payment_method || "CASH",
            userId,
          },
        );
      } catch (vErr) {
        console.error("Warning: Failed to auto-generate receipt voucher in finance:", vErr);
      }
    }

    // 4. Insert into hr_loan_repayments
    const insertRes = await query(
      `INSERT INTO hr_loan_repayments (
        company_id, employee_id, loan_id, amount_paid, payment_date, payroll_id,
        payment_type, payment_method, reference, notes, remaining_balance,
        voucher_id, deposit_account_id, cost_center_id, project_id, cheque_date, created_by
      ) VALUES (
        :companyId, :employeeId, :loanId, :amountPaid, :paymentDate, NULL,
        'MANUAL', :paymentMethod, :reference, :notes, :newAmountDue,
        :voucherId, :depositAccId, :costCenterId, :projectId, :chequeDate, :userId
      )`,
      {
        companyId,
        employeeId: loan.employee_id,
        loanId: loan.id,
        amountPaid: payAmt,
        paymentDate: payDate,
        paymentMethod: payment_method || "CASH",
        reference: voucherNo || reference || null,
        notes: notes || null,
        newAmountDue,
        voucherId,
        depositAccId,
        costCenterId: cost_center_id ? Number(cost_center_id) : null,
        projectId: project_id ? Number(project_id) : null,
        chequeDate: cheque_date || null,
        userId,
      },
    );

    // 5. Update hr_loans
    await query(
      `UPDATE hr_loans 
       SET amount_due = :newAmountDue, status = :newStatus, updated_by = :userId 
       WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      {
        newAmountDue,
        newStatus,
        userId,
        loanId: loan.id,
        companyId,
      },
    );

    res.json({
      success: true,
      message: `Direct receipt repayment of GHS ${payAmt.toFixed(2)} recorded successfully${voucherNo ? ` (Receipt Voucher #${voucherNo})` : ""}`,
      repayment_id: insertRes.insertId,
      voucher_id: voucherId,
      voucher_no: voucherNo,
      disbursement_voucher_no: voucherNo,
      disbursement_voucher_id: voucherId,
      amount_paid: payAmt,
      new_amount_due: newAmountDue,
      status: newStatus,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all repayments (payroll & manual) for a loan
 */
export async function getLoanRepayments(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const loanId = Number(req.params.id);

    const [loan] = await query(
      `SELECT l.*, e.first_name, e.last_name, e.emp_code
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       WHERE l.id = :loanId AND (l.company_id = :companyId OR l.company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan not found");

    const items = await query(
      `SELECT lr.*, p.period_name, COALESCE(u.full_name, u.username) as created_by_name,
              fv.voucher_no, da.name as deposit_account_name, da.code as deposit_account_code
       FROM hr_loan_repayments lr
       LEFT JOIN hr_payroll pr ON pr.id = lr.payroll_id
       LEFT JOIN hr_payroll_periods p ON p.id = pr.period_id
       LEFT JOIN adm_users u ON u.id = lr.created_by
       LEFT JOIN fin_vouchers fv ON fv.id = lr.voucher_id
       LEFT JOIN fin_accounts da ON da.id = lr.deposit_account_id
       WHERE lr.loan_id = :loanId AND (lr.company_id = :companyId OR lr.company_id = 1)
       ORDER BY lr.payment_date DESC, lr.id DESC`,
      { loanId, companyId },
    );

    const totalRepaid = items.reduce((sum, r) => sum + Number(r.amount_paid || 0), 0);

    res.json({
      loan: {
        ...loan,
        amount: Number(loan.amount || 0),
        amount_due: Number(loan.amount_due ?? loan.amount ?? 0),
        monthly_installment: Number(loan.monthly_installment || 0),
      },
      items: items.map((r) => ({
        ...r,
        amount_paid: Number(r.amount_paid || 0),
        remaining_balance: r.remaining_balance !== null ? Number(r.remaining_balance) : null,
      })),
      total_repaid: totalRepaid,
      amount_due: Number(loan.amount_due ?? loan.amount ?? 0),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Revert a manual repayment
 */
export async function revertManualRepayment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const loanId = Number(req.params.id);
    const repaymentId = Number(req.params.repaymentId);

    const [repayment] = await query(
      `SELECT * FROM hr_loan_repayments WHERE id = :repaymentId AND loan_id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { repaymentId, loanId, companyId },
    );
    if (!repayment) throw httpError(404, "NOT_FOUND", "Repayment record not found");

    if (repayment.payroll_id || repayment.payment_type !== "MANUAL") {
      throw httpError(400, "BAD_REQUEST", "Cannot revert automated payroll deductions directly. Adjust via payroll.");
    }

    const [loan] = await query(
      `SELECT id, amount, amount_due, status FROM hr_loans WHERE id = :loanId AND (company_id = :companyId OR company_id = 1)`,
      { loanId, companyId },
    );
    if (!loan) throw httpError(404, "NOT_FOUND", "Loan not found");

    const restoredAmountDue = Math.min(
      Number(loan.amount),
      Number(loan.amount_due || 0) + Number(repayment.amount_paid),
    );
    const restoredStatus = restoredAmountDue > 0 && loan.status === "COMPLETED" ? "ACTIVE" : loan.status;

    await query(
      `UPDATE hr_loans SET amount_due = :restoredAmountDue, status = :restoredStatus, updated_by = :userId WHERE id = :loanId`,
      { restoredAmountDue, restoredStatus, userId, loanId },
    );

    // Revert associated Receipt Voucher if created
    if (repayment.voucher_id) {
      await query(`DELETE FROM fin_voucher_lines WHERE voucher_id = :vid`, { vid: repayment.voucher_id }).catch(() => {});
      await query(`DELETE FROM fin_vouchers WHERE id = :vid`, { vid: repayment.voucher_id }).catch(() => {});
    }

    await query(
      `DELETE FROM hr_loan_repayments WHERE id = :repaymentId`,
      { repaymentId },
    );

    res.json({
      success: true,
      message: "Manual repayment and associated receipt voucher reverted successfully",
      new_amount_due: restoredAmountDue,
      status: restoredStatus,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Helper to ensure a Chart of Accounts account exists for a Loan Type
 */
export async function ensureLoanTypeAccount({ companyId, loanTypeId, loanTypeName, accountId = null }) {
  const compId = companyId || 1;
  // If accountId is provided, check if valid
  if (accountId) {
    const [acc] = await query(
      `SELECT id FROM fin_accounts WHERE id = :accountId AND (company_id = :compId OR company_id = 1 OR company_id IS NULL)`,
      { accountId, compId },
    );
    if (acc) {
      if (loanTypeId) {
        await query(
          `UPDATE hr_setup_loan_types SET account_id = :accId WHERE id = :loanTypeId`,
          { accId: acc.id, loanTypeId },
        );
      }
      return acc.id;
    }
  }

  // 1. Ensure "Staff Loans" Account Group exists under Current Assets
  let groupRows = await query(
    `SELECT id, name FROM fin_account_groups 
     WHERE (name = 'Staff Loans' OR name = 'Staff Loan' OR name = 'Employee Loans' OR name = 'Employee Loan')
       AND nature = 'ASSET'
       AND (company_id = :compId OR company_id = 1 OR company_id IS NULL)
     LIMIT 1`,
    { compId },
  );

  let groupId = null;
  if (groupRows.length > 0) {
    groupId = groupRows[0].id;
    if (groupRows[0].name !== 'Staff Loans') {
      await query(`UPDATE fin_account_groups SET name = 'Staff Loans' WHERE id = :gid`, { gid: groupId });
    }
  } else {
    // Find parent Current Assets (parent_id: 21, 6, etc.)
    const [parent] = await query(
      `SELECT id FROM fin_account_groups 
       WHERE id IN (21, 6) AND nature = 'ASSET' AND (company_id = :compId OR company_id = 1 OR company_id IS NULL)
       LIMIT 1`,
      { compId },
    );
    const parentId = parent?.id || 21;

    let groupCode = '1012';
    const [codeExists] = await query(
      `SELECT id FROM fin_account_groups WHERE code = :code AND (company_id = :compId OR company_id = 1 OR company_id IS NULL) LIMIT 1`,
      { code: groupCode, compId },
    );
    if (codeExists) {
      groupCode = '1010.SL';
    }

    const insGroup = await query(
      `INSERT INTO fin_account_groups (company_id, parent_id, code, name, nature)
       VALUES (:compId, :parentId, :code, 'Staff Loans', 'ASSET')`,
      { compId, parentId, code: groupCode },
    );
    groupId = insGroup.insertId;
  }

  // 2. Check if an existing fin_account matches this loan type name
  const exactName = `Staff Loan - ${loanTypeName}`;
  const legacyName = `Employee Loan - ${loanTypeName}`;
  const [existingAcc] = await query(
    `SELECT id, name FROM fin_accounts 
     WHERE (name = :exactName OR name = :legacyName OR name = :loanTypeName)
       AND (company_id = :compId OR company_id = 1 OR company_id IS NULL)
     LIMIT 1`,
    { exactName, legacyName, loanTypeName, compId },
  );
  if (existingAcc) {
    // Ensure account name and group are updated to Staff Loans
    await query(
      `UPDATE fin_accounts SET name = :exactName, group_id = :groupId WHERE id = :accId`,
      { exactName, groupId, accId: existingAcc.id },
    );
    if (loanTypeId) {
      await query(
        `UPDATE hr_setup_loan_types SET account_id = :accId WHERE id = :loanTypeId`,
        { accId: existingAcc.id, loanTypeId },
      );
    }
    return existingAcc.id;
  }

  // 3. Generate unique code LOAN-XXX
  const maxCodeRows = await query(
    `SELECT code FROM fin_accounts WHERE (company_id = :compId OR company_id = 1) AND code LIKE 'LOAN-%' ORDER BY id DESC LIMIT 1`,
    { compId },
  );
  let nextNum = loanTypeId || 1;
  if (maxCodeRows[0]?.code) {
    const m = maxCodeRows[0].code.match(/LOAN-(\d+)/);
    if (m) nextNum = Math.max(nextNum, Number(m[1]) + 1);
  }
  let code = `LOAN-${String(nextNum).padStart(3, "0")}`;
  const [codeTaken] = await query(
    `SELECT id FROM fin_accounts WHERE code = :code AND (company_id = :compId OR company_id = 1) LIMIT 1`,
    { code, compId },
  );
  if (codeTaken) {
    code = `LOAN-${Date.now().toString().slice(-4)}`;
  }

  const ins = await query(
    `INSERT INTO fin_accounts 
       (company_id, group_id, code, name, balance_type, currency_id, is_control_account, is_postable, is_active)
     VALUES 
       (:compId, :groupId, :code, :name, 'DEBIT', 1, 0, 1, 1)`,
    { compId, groupId, code, name: exactName },
  );
  const newAccountId = ins.insertId;

  if (loanTypeId) {
    await query(
      `UPDATE hr_setup_loan_types SET account_id = :newAccountId WHERE id = :loanTypeId`,
      { newAccountId, loanTypeId },
    );
  }

  return newAccountId;
}

export async function listLoanTypes(req, res, next) {
  try {
    await query(
      `CREATE TABLE IF NOT EXISTS hr_setup_loan_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        account_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => {});
    const companyId = req.scope?.companyId || req.user?.company_id || 1;

    // Fetch existing loan types and auto-heal missing finance accounts
    const rawItems = await query(
      `SELECT lt.id, lt.name, lt.account_id 
       FROM hr_setup_loan_types lt
       WHERE (:companyId IS NULL OR lt.company_id = :companyId OR lt.company_id = 1 OR lt.company_id IS NULL)`,
      { companyId },
    );

    for (const item of rawItems) {
      let needsAccount = !item.account_id;
      if (item.account_id) {
        const [accCheck] = await query(
          `SELECT id FROM fin_accounts WHERE id = :aid`,
          { aid: item.account_id },
        );
        if (!accCheck) needsAccount = true;
      }
      if (needsAccount) {
        await ensureLoanTypeAccount({
          companyId,
          loanTypeId: item.id,
          loanTypeName: item.name,
        }).catch(() => {});
      }
    }

    const items = await query(
      `SELECT 
         lt.id, 
         lt.name, 
         lt.is_active, 
         lt.account_id,
         a.code AS account_code,
         a.name AS account_name,
         a.balance_type AS account_balance_type,
         g.name AS account_group_name,
         g.code AS account_group_code,
         g.nature AS account_nature
       FROM hr_setup_loan_types lt
       LEFT JOIN fin_accounts a ON a.id = lt.account_id
       LEFT JOIN fin_account_groups g ON g.id = a.group_id
       WHERE (:companyId IS NULL OR lt.company_id = :companyId OR lt.company_id = 1 OR lt.company_id IS NULL) 
       ORDER BY lt.name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveLoanType(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    await query(
      `CREATE TABLE IF NOT EXISTS hr_setup_loan_types (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(100) NOT NULL,
        account_id BIGINT UNSIGNED NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => {});
    const { id, name, is_active, account_id } = req.body;
    let targetId = id;
    if (id) {
      await query(
        `UPDATE hr_setup_loan_types SET name = :name, is_active = :is_active WHERE id = :id AND (company_id = :companyId OR company_id = 1)`,
        { id, name, is_active: is_active ? 1 : 0, companyId },
      );
    } else {
      const r = await query(
        `INSERT INTO hr_setup_loan_types (company_id, name, is_active) VALUES (:companyId, :name, :is_active)`,
        { companyId, name, is_active: is_active ? 1 : 0 },
      );
      targetId = r.insertId;
    }

    // Ensure finance account is created or updated
    const finalAccountId = await ensureLoanTypeAccount({
      companyId,
      loanTypeId: targetId,
      loanTypeName: name,
      accountId: account_id || null,
    });

    const [updatedRow] = await query(
      `SELECT 
         lt.id, lt.name, lt.is_active, lt.account_id,
         a.code AS account_code, a.name AS account_name, g.name AS account_group_name
       FROM hr_setup_loan_types lt
       LEFT JOIN fin_accounts a ON a.id = lt.account_id
       LEFT JOIN fin_account_groups g ON g.id = a.group_id
       WHERE lt.id = :targetId`,
      { targetId },
    );

    res.status(id ? 200 : 201).json({
      id: targetId,
      item: updatedRow,
      account_id: finalAccountId,
      message: id ? "Loan type updated with finance account" : "Loan type created with finance account",
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Tax Config APIs
 */
export async function getGraTaxRates(req, res, next) {
  try {
    const graPayload = {
      success: true,
      source: "Ghana Revenue Authority (GRA)",
      authority: "GRA Official Direct Tax Gazette (gra.gov.gh)",
      authority_url: "https://gra.gov.gh",
      current_act: "Act 1178",
      current_act_name: "Income Tax (Amendment) Act, 2026 (Act 1178)",
      effective_date: "2026-09-01",
      currency: "GHS",
      frequency: "MONTHLY",
      verified_at: new Date().toISOString(),
      description:
        "Official gazetted graduated resident individual PAYE monthly rates under the Income Tax (Amendment) Act, 2026 (Act 1178), effective September 1, 2026.",
      // Current active bands (Act 1178)
      bands: [
        {
          chargeableIncome: 588,
          rate: 0,
          label: "First GH¢ 588.00 (Tax-Free threshold)",
        },
        { chargeableIncome: 80, rate: 5, label: "Next GH¢ 80.00 @ 5%" },
        { chargeableIncome: 100, rate: 10, label: "Next GH¢ 100.00 @ 10%" },
        {
          chargeableIncome: 2900,
          rate: 17.5,
          label: "Next GH¢ 2,900.00 @ 17.5%",
        },
        {
          chargeableIncome: 16000,
          rate: 25,
          label: "Next GH¢ 16,000.00 @ 25%",
        },
        {
          chargeableIncome: 30332,
          rate: 30,
          label: "Next GH¢ 30,332.00 @ 30%",
        },
        {
          chargeableIncome: 0,
          rate: 35,
          label: "Exceeding GH¢ 50,000.00 (Excess) @ 35%",
        },
      ],
      schedules: [
        {
          act: "Act 1178",
          name: "Act 1178 (Effective Sept 1, 2026 – Present)",
          is_current: true,
          effective_date: "2026-09-01",
          tax_free_threshold: 588,
          bands: [
            { chargeableIncome: 588, rate: 0, label: "First GH¢ 588.00 (0%)" },
            { chargeableIncome: 80, rate: 5, label: "Next GH¢ 80.00 (5%)" },
            { chargeableIncome: 100, rate: 10, label: "Next GH¢ 100.00 (10%)" },
            {
              chargeableIncome: 2900,
              rate: 17.5,
              label: "Next GH¢ 2,900.00 (17.5%)",
            },
            {
              chargeableIncome: 16000,
              rate: 25,
              label: "Next GH¢ 16,000.00 (25%)",
            },
            {
              chargeableIncome: 30332,
              rate: 30,
              label: "Next GH¢ 30,332.00 (30%)",
            },
            {
              chargeableIncome: 0,
              rate: 35,
              label: "Exceeding GH¢ 50,000.00 (35%)",
            },
          ],
        },
        {
          act: "Act 1094",
          name: "Act 1094 (Jan 1, 2024 – Aug 31, 2026)",
          is_current: false,
          effective_date: "2024-01-01",
          tax_free_threshold: 490,
          bands: [
            { chargeableIncome: 490, rate: 0, label: "First GH¢ 490.00 (0%)" },
            { chargeableIncome: 110, rate: 5, label: "Next GH¢ 110.00 (5%)" },
            { chargeableIncome: 130, rate: 10, label: "Next GH¢ 130.00 (10%)" },
            {
              chargeableIncome: 3166.67,
              rate: 17.5,
              label: "Next GH¢ 3,166.67 (17.5%)",
            },
            {
              chargeableIncome: 16000,
              rate: 25,
              label: "Next GH¢ 16,000.00 (25%)",
            },
            {
              chargeableIncome: 30520,
              rate: 30,
              label: "Next GH¢ 30,520.00 (30%)",
            },
            {
              chargeableIncome: 0,
              rate: 35,
              label: "Exceeding GH¢ 50,416.67 (35%)",
            },
          ],
        },
      ],
    };
    return res.json(graPayload);
  } catch (err) {
    next(err);
  }
}

export async function listTaxConfigs(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_tax_config
         WHERE company_id = :companyId AND is_active = 1 ORDER BY tax_name ASC, min_amount ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTaxConfig(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    await ensureHRTables();
    await query(
      `CREATE TABLE IF NOT EXISTS hr_tax_config (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        company_id BIGINT UNSIGNED NOT NULL,
        tax_name VARCHAR(100) NOT NULL,
        tax_type VARCHAR(40) NOT NULL,
        min_amount DECIMAL(18,4) NULL,
        max_amount DECIMAL(18,4) NULL,
        tax_rate DECIMAL(9,4) NULL,
        fixed_amount DECIMAL(18,4) NULL,
        employee_contribution_rate DECIMAL(9,4) NULL,
        employer_contribution_rate DECIMAL(9,4) NULL,
        taxable_components TEXT NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        KEY idx_company (company_id),
        KEY idx_type (tax_type)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      {},
    ).catch(() => []);
    await query(
      `ALTER TABLE hr_tax_config MODIFY COLUMN tax_type VARCHAR(50) NOT NULL`,
      {},
    ).catch(() => []);
    if (Array.isArray(req.body?.configs)) {
      const { configs = [], idsToDelete = [] } = req.body;
      for (const cfg of configs) {
        const id = toNumber(cfg.id, null);
        const tax_name = cfg.tax_name;
        let tax_type = cfg.tax_type;
        if (String(tax_type || "").toUpperCase() === "PROVIDENCE_FUND") {
          tax_type = "PROVIDENT_FUND";
        }
        const min_amount = toNumber(cfg.min_amount, 0);
        const max_amount = toNumber(cfg.max_amount, null);
        const tax_rate = toNumber(cfg.tax_rate, 0);
        const fixed_amount = toNumber(cfg.fixed_amount, 0);
        const employee_contribution_rate = toNumber(
          cfg.employee_contribution_rate,
          0,
        );
        const employer_contribution_rate = toNumber(
          cfg.employer_contribution_rate,
          0,
        );
        const base_component = cfg.base_component || "BASIC";
        const is_active = cfg.is_active ? 1 : 0;
        let compsJson = null;
        try {
          if (Array.isArray(cfg.taxable_components)) {
            compsJson = JSON.stringify(cfg.taxable_components);
          } else if (
            typeof cfg.taxable_components === "string" &&
            cfg.taxable_components.trim()
          ) {
            compsJson = cfg.taxable_components;
          }
        } catch {}
        if (id) {
          await query(
            `UPDATE hr_tax_config SET 
              tax_name = :tax_name, tax_type = :tax_type, min_amount = :min_amount, 
              max_amount = :max_amount, tax_rate = :tax_rate, fixed_amount = :fixed_amount,
              employee_contribution_rate = :employee_contribution_rate,
              employer_contribution_rate = :employer_contribution_rate,
              base_component = :base_component,
              is_active = :is_active, taxable_components = :taxable_components
             WHERE id = :id AND company_id = :companyId`,
            {
              id,
              tax_name,
              tax_type,
              min_amount,
              max_amount,
              tax_rate,
              fixed_amount,
              employee_contribution_rate,
              employer_contribution_rate,
              base_component,
              is_active,
              taxable_components: compsJson,
              companyId,
            },
          );
        } else {
          await query(
            `INSERT INTO hr_tax_config (company_id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, employee_contribution_rate, employer_contribution_rate, base_component, is_active, taxable_components)
             VALUES (:companyId, :tax_name, :tax_type, :min_amount, :max_amount, :tax_rate, :fixed_amount, :employee_contribution_rate, :employer_contribution_rate, :base_component, :is_active, :taxable_components)`,
            {
              tax_name,
              tax_type,
              min_amount,
              max_amount,
              tax_rate,
              fixed_amount,
              employee_contribution_rate,
              employer_contribution_rate,
              base_component,
              is_active,
              taxable_components: compsJson,
              companyId,
            },
          );
        }
      }
      if (Array.isArray(idsToDelete) && idsToDelete.length) {
        for (const delId of idsToDelete) {
          await query(
            `DELETE FROM hr_tax_config WHERE id = :id AND company_id = :companyId`,
            { id: delId, companyId },
          );
        }
      }
      res.json({ message: "Statutory configurations saved" });
      return;
    }
    const {
      id,
      tax_name,
      tax_type,
      min_amount,
      max_amount,
      tax_rate,
      fixed_amount,
      is_active,
      taxable_components,
    } = req.body;

    const params = {
      tax_name,
      tax_type:
        String(tax_type || "").toUpperCase() === "PROVIDENCE_FUND"
          ? "PROVIDENT_FUND"
          : tax_type,
      min_amount: toNumber(min_amount, 0),
      max_amount: toNumber(max_amount, null),
      tax_rate: toNumber(tax_rate, 0),
      fixed_amount: toNumber(fixed_amount, 0),
      is_active: is_active ? 1 : 0,
      companyId,
    };
    let compsJson = null;
    try {
      if (Array.isArray(taxable_components)) {
        compsJson = JSON.stringify(taxable_components);
      } else if (
        typeof taxable_components === "string" &&
        taxable_components.trim()
      ) {
        compsJson = taxable_components;
      }
    } catch {}

    if (id) {
      await query(
        `UPDATE hr_tax_config SET 
          tax_name = :tax_name, tax_type = :tax_type, min_amount = :min_amount, 
          max_amount = :max_amount, tax_rate = :tax_rate, fixed_amount = :fixed_amount, is_active = :is_active, taxable_components = :taxable_components
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id, taxable_components: compsJson },
      );
      res.json({ message: "Tax config updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_tax_config (company_id, tax_name, tax_type, min_amount, max_amount, tax_rate, fixed_amount, is_active, taxable_components)
         VALUES (:companyId, :tax_name, :tax_type, :min_amount, :max_amount, :tax_rate, :fixed_amount, :is_active, :taxable_components)`,
        { ...params, taxable_components: compsJson },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Tax config created" });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Salary Structure APIs
 */
export async function listSalaryStructures(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT *,
          created_at FROM hr_salary_structures
         WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveSalaryStructure(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, name, description, is_active, components } = req.body;

    const params = {
      name,
      description,
      is_active: is_active ? 1 : 0,
      companyId,
    };
    let compsJson = null;
    try {
      if (components && typeof components === "object") {
        compsJson = JSON.stringify(components);
      } else if (typeof components === "string" && components.trim()) {
        compsJson = components;
      }
    } catch {}

    if (id) {
      await query(
        `UPDATE hr_salary_structures SET name = :name, description = :description, is_active = :is_active, components = :components
         WHERE id = :id AND company_id = :companyId`,
        { ...params, id, components: compsJson },
      );
      res.json({ message: "Salary structure updated" });
    } else {
      await query(
        `DELETE FROM hr_salary_structures WHERE company_id = :companyId`,
        { companyId },
      ).catch(() => []);
      const result = await query(
        `INSERT INTO hr_salary_structures (company_id, name, description, is_active, components)
         VALUES (:companyId, :name, :description, :is_active, :components)`,
        { ...params, components: compsJson },
      );
      res
        .status(201)
        .json({ id: result.insertId, message: "Salary structure created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function getActiveSalaryStructure(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const rows = await query(
      `SELECT id, name, description, is_active, components FROM hr_salary_structures
         WHERE company_id = :companyId AND is_active = 1 
       ORDER BY id DESC LIMIT 1`,
      { companyId },
    );
    const item = rows[0] || null;
    res.json({ item });
  } catch (err) {
    next(err);
  }
}

export async function listBaseSalaries(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};

    // Get the latest base salary per employee using a more robust join
    const items = await query(
      `SELECT e.id as employee_id, e.emp_code, e.first_name, e.last_name, 
              COALESCE(bs.base_salary, e.base_salary, 0) as base_salary,
              bs.effective_date FROM hr_employees e
       LEFT JOIN (
         SELECT t1.employee_id, t1.base_salary, t1.effective_date
         FROM hr_employee_base_salaries t1
         INNER JOIN (
           SELECT employee_id, MAX(id) as max_id
           FROM hr_employee_base_salaries
         WHERE company_id = :companyId
           GROUP BY employee_id
         ) t2 ON t1.id = t2.max_id
       ) bs ON bs.employee_id = e.id
       WHERE e.company_id = :companyId 
         AND e.status = 'ACTIVE' 
         AND e.deleted_at IS NULL
       ORDER BY e.first_name ASC`,
      { companyId },
    );

    const allComponents = await query(
      `SELECT c.id, c.employee_id, c.component_name,
              COALESCE(NULLIF(c.component_type, ''), d.component_type, 'ALLOWANCE') AS component_type,
              COALESCE(NULLIF(c.calculation_type, ''), 'AMOUNT') AS calculation_type,
              c.value, c.basis_component_id, c.definition_id, d.manual_calculation,
              c.effective_from, c.effective_to
         FROM hr_employee_salary_components c
         LEFT JOIN hr_salary_component_definitions d ON d.id = c.definition_id AND d.company_id = c.company_id
        WHERE c.company_id = :companyId AND c.is_active = 1`,
      { companyId }
    );
    const compsByEmp = new Map();
    for (const comp of allComponents) {
      if (!compsByEmp.has(comp.employee_id)) {
        compsByEmp.set(comp.employee_id, []);
      }
      compsByEmp.get(comp.employee_id).push(comp);
    }
    const resultItems = items.map((emp) => ({
      ...emp,
      components: compsByEmp.get(emp.employee_id) || [],
    }));

    res.json({ items: resultItems });
  } catch (err) {
    console.error("DEBUG: listBaseSalaries ERROR:", err);
    next(err);
  }
}

export async function listSalaryComponentDefinitions(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT id, component_name, component_type, manual_calculation, is_active
         FROM hr_salary_component_definitions
        WHERE company_id = :companyId
        ORDER BY component_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveSalaryComponentDefinition(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const id = toNumber(req.body?.id, null);
    const componentName = String(req.body?.component_name || "").trim();
    const rawType = String(req.body?.component_type || "").trim().toUpperCase();
    const componentType =
      rawType === "DEDUCTION"
        ? "DEDUCTION"
        : rawType === "ALLOWANCE" || !rawType
          ? "ALLOWANCE"
          : rawType;
    const manualCalculation = req.body?.manual_calculation ? 1 : 0;
    const isActive =
      req.body?.is_active === false || req.body?.is_active === 0 ? 0 : 1;
    if (!componentName || componentName.length > 100) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Enter a component name up to 100 characters",
      );
    }
    if (!["ALLOWANCE", "DEDUCTION"].includes(componentType)) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Component type must be Allowance or Deduction",
      );
    }
    const duplicate = await query(
      `SELECT id FROM hr_salary_component_definitions
        WHERE company_id = :companyId AND LOWER(component_name) = LOWER(:componentName)
          AND (:id IS NULL OR id <> :id)
        LIMIT 1`,
      { companyId, componentName, id },
    );
    if (duplicate.length) {
      throw httpError(
        409,
        "DUPLICATE_COMPONENT",
        "A salary component with this name already exists",
      );
    }
    let targetDefId = null;
    if (id) {
      const current = await query(
        `SELECT id FROM hr_salary_component_definitions WHERE id = :id AND company_id = :companyId LIMIT 1`,
        { id, companyId },
      );
      if (!current.length)
        throw httpError(404, "NOT_FOUND", "Salary component not found");
      await query(
        `UPDATE hr_salary_component_definitions
            SET component_name = :componentName, component_type = :componentType,
                manual_calculation = :manualCalculation, is_active = :isActive
          WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          componentName,
          componentType,
          manualCalculation,
          isActive,
        },
      );
    } else {
      const insertRes = await query(
        `INSERT INTO hr_salary_component_definitions
           (company_id, component_name, component_type, manual_calculation, is_active, created_by)
         VALUES (:companyId, :componentName, :componentType, :manualCalculation, :isActive, :userId)`,
        {
          companyId,
          componentName,
          componentType,
          manualCalculation,
          isActive,
          userId,
        },
      );
      targetDefId = insertRes?.insertId;
    }

    const finalDefId = id || targetDefId;
    if (finalDefId) {
      const isManual = Number(manualCalculation) === 1;
      const colName = isManual
        ? `employee_component_${900000000000 + Number(finalDefId)}`
        : `employee_component_${Number(finalDefId)}`;
      const isEarning = String(componentType || "").toUpperCase() === "ALLOWANCE";
      await registerSalaryComponent(companyId, {
        column_name: colName,
        label: componentName,
        component_type: isEarning ? "ALLOWANCE" : "DEDUCTION",
        display_order: isEarning ? 30 : 80,
        is_earning: isEarning ? 1 : 0,
        is_fixed: 0,
        source_type: "NONE",
        source_id: null,
      }).catch(() => {});
    }

    res.json({ message: "Salary component definition saved" });
  } catch (err) {
    console.error("Failed to save salary component definition:", err);
    next(err);
  }
}

export async function saveBaseSalary(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { employee_id, base_salary } = req.body;
    const effective_date = new Date().toISOString().slice(0, 10);

    // 1. Insert historical record into hr_employee_base_salaries
    await query(
      `INSERT INTO hr_employee_base_salaries (company_id, employee_id, base_salary, effective_date, created_by)
       VALUES (:companyId, :employee_id, :base_salary, :effective_date, :userId)`,
      {
        companyId,
        employee_id,
        base_salary: Number(base_salary || 0),
        effective_date,
        userId,
      },
    );

    // 2. Update the base_salary directly on hr_employees table
    await query(
      `UPDATE hr_employees SET base_salary = :base_salary WHERE id = :employee_id AND company_id = :companyId`,
      { base_salary: Number(base_salary || 0), employee_id, companyId },
    );

    res.json({ message: "Base salary updated successfully" });
  } catch (err) {
    console.error("DEBUG saveBaseSalary ERROR:", err);
    next(err);
  }
}

export async function listEmployeeSalaryComponents(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const employeeId = toNumber(req.params.employeeId, null);
    if (!employeeId) throw httpError(400, "BAD_REQUEST", "Invalid employee ID");
    const employee = await query(
      `SELECT id FROM hr_employees WHERE id = :employeeId AND company_id = :companyId AND deleted_at IS NULL LIMIT 1`,
      { employeeId, companyId },
    );
    if (!employee.length)
      throw httpError(404, "NOT_FOUND", "Employee not found");
    const items = await query(
      `SELECT c.id, c.employee_id,
              COALESCE(NULLIF(c.component_name, ''), d.component_name, 'Component') AS component_name,
              COALESCE(NULLIF(c.component_type, ''), d.component_type, 'ALLOWANCE') AS component_type,
              COALESCE(NULLIF(c.calculation_type, ''), 'AMOUNT') AS calculation_type,
              c.value, c.basis_component_id, c.definition_id, d.manual_calculation,
              b.component_name AS basis_component_name,
              c.effective_from, c.effective_to
         FROM hr_employee_salary_components c
         LEFT JOIN hr_employee_salary_components b ON b.id = c.basis_component_id
         LEFT JOIN hr_salary_component_definitions d ON d.id = c.definition_id AND d.company_id = c.company_id
        WHERE c.company_id = :companyId AND c.employee_id = :employeeId AND c.is_active = 1
        ORDER BY c.id ASC`,
      { companyId, employeeId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmployeeSalaryComponents(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const employeeId = toNumber(req.params.employeeId, null);
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const submitted = req.body?.items;
    if (!employeeId) throw httpError(400, "BAD_REQUEST", "Invalid employee ID");
    if (!Array.isArray(submitted) || submitted.length > 50) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Salary components must be a list of at most 50 items",
      );
    }
    const employee = await query(
      `SELECT id FROM hr_employees WHERE id = :employeeId AND company_id = :companyId AND deleted_at IS NULL LIMIT 1`,
      { employeeId, companyId },
    );
    if (!employee.length)
      throw httpError(404, "NOT_FOUND", "Employee not found");

    const today = new Date().toISOString().slice(0, 10);
    const clean = await Promise.all(
      submitted.map(async (item, index) => {
        const definitionId = toNumber(item?.definition_id, null);
        const definition = definitionId
          ? (
              await query(
                `SELECT id, component_name, component_type, manual_calculation
               FROM hr_salary_component_definitions
              WHERE id = :definitionId AND company_id = :companyId AND is_active = 1 LIMIT 1`,
                { definitionId, companyId },
              )
            )[0]
          : null;
        if (definitionId && !definition) {
          throw httpError(
            400,
            "BAD_REQUEST",
            "Select an active configured salary component",
          );
        }
        const componentName = String(
          definition?.component_name || item?.component_name || "",
        ).trim();
        const componentType = String(
          definition?.component_type || item?.component_type || "ALLOWANCE",
        ).toUpperCase();
        const calculationType = String(
          definition?.manual_calculation
            ? "AMOUNT"
            : item?.calculation_type || "AMOUNT",
        ).toUpperCase();
        const value = definition?.manual_calculation ? 0 : Number(item?.value);
        const effectiveFrom = String(item?.effective_from || today).slice(
          0,
          10,
        );
        const effectiveTo = item?.effective_to
          ? String(item.effective_to).slice(0, 10)
          : null;
        const clientKey = String(item?.client_key || `row-${index}`);
        if (!componentName || componentName.length > 100) {
          throw httpError(
            400,
            "BAD_REQUEST",
            "Each salary component needs a name up to 100 characters",
          );
        }
        if (!["ALLOWANCE", "DEDUCTION"].includes(componentType)) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Invalid component type for ${componentName}`,
          );
        }
        if (!["AMOUNT", "PERCENT"].includes(calculationType)) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Invalid calculation type for ${componentName}`,
          );
        }
        if (
          !Number.isFinite(value) ||
          value < 0 ||
          (calculationType === "PERCENT" && value > 100)
        ) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Enter a valid ${calculationType === "PERCENT" ? "percentage from 0 to 100" : "non-negative amount"} for ${componentName}`,
          );
        }
        if (
          !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) ||
          (effectiveTo && !/^\d{4}-\d{2}-\d{2}$/.test(effectiveTo))
        ) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Invalid effective date for ${componentName}`,
          );
        }
        if (effectiveTo && effectiveTo < effectiveFrom) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `End date cannot be before start date for ${componentName}`,
          );
        }
        return {
          id: item?.id ? toNumber(item.id, null) : null,
          definitionId,
          manualCalculation: Number(definition?.manual_calculation || 0) === 1,
          clientKey,
          componentName,
          componentType,
          calculationType,
          value,
          basisRef:
            calculationType === "PERCENT"
              ? String(item?.basis_component_ref || "BASIC")
              : "BASIC",
          effectiveFrom,
          effectiveTo,
        };
      }),
    );
    if (new Set(clean.map((item) => item.clientKey)).size !== clean.length) {
      throw httpError(
        400,
        "BAD_REQUEST",
        "Salary component keys must be unique",
      );
    }

    const byId = new Map(
      clean.filter((item) => item.id).map((item) => [String(item.id), item]),
    );
    const byKey = new Map(clean.map((item) => [item.clientKey, item]));
    for (const item of clean) {
      if (item.id) {
        const owned = await query(
          `SELECT id FROM hr_employee_salary_components WHERE id = :id AND employee_id = :employeeId AND company_id = :companyId LIMIT 1`,
          { id: item.id, employeeId, companyId },
        );
        if (!owned.length)
          throw httpError(
            400,
            "BAD_REQUEST",
            "A salary component does not belong to this employee",
          );
      }
      if (item.manualCalculation && item.calculationType !== "AMOUNT") {
        throw httpError(
          400,
          "BAD_REQUEST",
          `${item.componentName} uses a monthly manual amount; it cannot be percentage based`,
        );
      }
      if (item.basisRef !== "BASIC") {
        const basis = byId.get(item.basisRef) || byKey.get(item.basisRef);
        if (!basis)
          throw httpError(
            400,
            "BAD_REQUEST",
            `Invalid percentage basis for ${item.componentName}`,
          );
        if (basis.manualCalculation) {
          throw httpError(
            400,
            "BAD_REQUEST",
            `Manual component ${basis.componentName} cannot be used as a recurring percentage basis`,
          );
        }
        if (basis === item)
          throw httpError(
            400,
            "BAD_REQUEST",
            `${item.componentName} cannot be based on itself`,
          );
        item.basisItem = basis;
      }
    }
    const visited = new Set();
    const visiting = new Set();
    const visit = (item) => {
      if (visiting.has(item))
        throw httpError(
          400,
          "BAD_REQUEST",
          "Percentage component bases cannot contain a circular reference",
        );
      if (visited.has(item)) return;
      visiting.add(item);
      if (item.basisItem) visit(item.basisItem);
      visiting.delete(item);
      visited.add(item);
    };
    clean.forEach(visit);

    await query(
      `UPDATE hr_employee_salary_components SET is_active = 0
        WHERE company_id = :companyId AND employee_id = :employeeId AND is_active = 1`,
      { companyId, employeeId },
    );
    const idsByItem = new Map();
    const hasKeyCol = await hasColumn("hr_employee_salary_components", "component_key");

    for (const [index, item] of clean.entries()) {
      const componentKey = item.definitionId ? `def_${item.definitionId}` : `comp_${Date.now()}_${index}`;
      const params = {
        companyId,
        employeeId,
        componentName: item.componentName,
        componentType: item.componentType,
        calculationType: item.calculationType,
        value: item.value,
        effectiveFrom: item.effectiveFrom,
        effectiveTo: item.effectiveTo,
        userId,
      };

      if (item.id) {
        if (hasKeyCol) {
          await query(
            `UPDATE hr_employee_salary_components
                SET definition_id = :definitionId, component_key = :componentKey, component_name = :componentName, component_type = :componentType,
                    calculation_type = :calculationType, value = :value, basis_component_id = NULL,
                    effective_from = :effectiveFrom, effective_to = :effectiveTo, is_active = 1
              WHERE id = :id AND employee_id = :employeeId AND company_id = :companyId`,
            { ...params, id: item.id, definitionId: item.definitionId, componentKey },
          );
        } else {
          await query(
            `UPDATE hr_employee_salary_components
                SET definition_id = :definitionId, component_name = :componentName, component_type = :componentType,
                    calculation_type = :calculationType, value = :value, basis_component_id = NULL,
                    effective_from = :effectiveFrom, effective_to = :effectiveTo, is_active = 1
              WHERE id = :id AND employee_id = :employeeId AND company_id = :companyId`,
            { ...params, id: item.id, definitionId: item.definitionId },
          );
        }
        idsByItem.set(item, item.id);
      } else {
        let result;
        if (hasKeyCol) {
          result = await query(
            `INSERT INTO hr_employee_salary_components
               (company_id, employee_id, definition_id, component_key, component_name, component_type, calculation_type, value,
                effective_from, effective_to, is_active, created_by)
              VALUES (:companyId, :employeeId, :definitionId, :componentKey, :componentName, :componentType, :calculationType,
                :value, :effectiveFrom, :effectiveTo, 1, :userId)`,
            { ...params, definitionId: item.definitionId, componentKey },
          );
        } else {
          result = await query(
            `INSERT INTO hr_employee_salary_components
               (company_id, employee_id, definition_id, component_name, component_type, calculation_type, value,
                effective_from, effective_to, is_active, created_by)
              VALUES (:companyId, :employeeId, :definitionId, :componentName, :componentType, :calculationType,
                :value, :effectiveFrom, :effectiveTo, 1, :userId)`,
            { ...params, definitionId: item.definitionId },
          );
        }
        idsByItem.set(item, result.insertId);
      }
    }
    for (const item of clean) {
      const basisId = item.basisItem ? idsByItem.get(item.basisItem) : null;
      await query(
        `UPDATE hr_employee_salary_components SET basis_component_id = :basisId
          WHERE id = :id AND employee_id = :employeeId AND company_id = :companyId`,
        { basisId, id: idsByItem.get(item), employeeId, companyId },
      );
    }
    res.json({
      message: "Employee salary components saved",
      count: clean.length,
    });
  } catch (err) {
    next(err);
  }
}

export async function saveBaseSalariesBulk(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const { rows } = req.body;
    if (!Array.isArray(rows)) {
      return res
        .status(400)
        .json({ message: "Invalid payload: rows must be an array" });
    }

    const effective_date = new Date().toISOString().slice(0, 10);
    let successCount = 0;

    for (const row of rows) {
      if (!row || !row.emp_code || row.base_salary == null) continue;

      const empRes = await query(
        `SELECT id,
          created_at FROM hr_employees
         WHERE emp_code = :emp_code AND company_id = :companyId AND status = 'ACTIVE'`,
        { emp_code: String(row.emp_code).trim(), companyId },
      );
      if (!empRes.length) continue;

      const employee_id = empRes[0].id;
      const base_salary = Number(row.base_salary || 0);

      await query(
        `INSERT INTO hr_employee_base_salaries (company_id, employee_id, base_salary, effective_date, created_by)
         VALUES (:companyId, :employee_id, :base_salary, :effective_date, :userId)`,
        { companyId, employee_id, base_salary, effective_date, userId },
      );

      await query(
        `UPDATE hr_employees SET base_salary = :base_salary WHERE id = :employee_id AND company_id = :companyId`,
        { base_salary, employee_id, companyId },
      );

      // Upsert non-manual salary components if provided
      if (Array.isArray(row.components) && row.components.length > 0) {
        for (const comp of row.components) {
          const definitionId = toNumber(comp.definition_id, null);
          const val = Number(comp.value || 0);
          const compName = String(comp.component_name || "").trim();
          if (!definitionId && !compName) continue;

          const existing = await query(
            `SELECT id FROM hr_employee_salary_components
             WHERE company_id = :companyId AND employee_id = :employee_id
               AND (definition_id = :definitionId OR (definition_id IS NULL AND component_name = :compName))
               AND is_active = 1
             LIMIT 1`,
            { companyId, employee_id, definitionId, compName },
          );

          if (existing.length > 0) {
            await query(
              `UPDATE hr_employee_salary_components
               SET value = :val, is_active = 1, updated_at = NOW()
               WHERE id = :id AND company_id = :companyId`,
              { val, id: existing[0].id, companyId },
            );
          } else {
            await query(
              `INSERT INTO hr_employee_salary_components
                 (company_id, employee_id, definition_id, component_name, component_type,
                  calculation_type, value, effective_from, is_active, created_by)
               VALUES
                 (:companyId, :employee_id, :definitionId, :compName, :compType,
                  :calcType, :val, :effective_date, 1, :userId)`,
              {
                companyId,
                employee_id,
                definitionId,
                compName: compName || "Salary component",
                compType: comp.component_type || "ALLOWANCE",
                calcType: comp.calculation_type || "AMOUNT",
                val,
                effective_date,
                userId,
              },
            );
          }
        }
      }

      successCount++;
    }

    res.json({
      message: `Successfully updated ${successCount} base salaries.`,
    });
  } catch (err) {
    next(err);
  }
}

export async function closePayroll(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const {
      payroll_id,
      finance_post,
      expense_account_id: directExpenseId,
      payable_account_id: directPayableId,
      narration,
      mappings: userMappings = {},
    } = req.body;
    let expense_account_id = userMappings.salary_expense || directExpenseId;
    let payable_account_id = userMappings.salary_payable || directPayableId;
    const [hdr] = await query(
      `SELECT *,
          created_at FROM hr_payroll
         WHERE id = :id AND company_id = :companyId`,
      { id: payroll_id, companyId },
    );
    if (!hdr) throw httpError(404, "NOT_FOUND", "Payroll not found");
    await query(
      `UPDATE hr_payroll SET status = 'CLOSED', closed_at = NOW() WHERE id = :id`,
      { id: payroll_id },
    );
    await query(
      `UPDATE hr_payslips ps 
       JOIN hr_payroll_items pi ON pi.employee_id = ps.employee_id AND pi.payroll_id = :payroll_id
       SET ps.status = 'PAID', ps.paid_at = NOW() 
       WHERE ps.period_id = :period_id`,
      { payroll_id, period_id: hdr.period_id },
    );
    try {
      const { notifyWorkflowForward } =
        await import("../services/notifications/workflowNotify.js");
      await notifyWorkflowForward({
        companyId,
        userId: req.user?.id || req.user?.sub || 1,
        workflowInstanceId: null,
        documentId: hdr.id,
        documentType: "Payroll",
        title: "Payroll Closed",
        message: `Payroll for period #${hdr.period_id} has been closed.`,
        action: "INFO",
        senderName: req.user?.name || req.user?.username || "System",
      });
    } catch {}
    if (finance_post && expense_account_id && payable_account_id) {
      // 1. Fetch Salary Component mappings
      const mappings = await query(
        `SELECT c.column_name, m.account_id, a.code, a.name
         FROM hr_salary_component_accounts m
         JOIN hr_salary_components c ON c.id = m.component_id AND c.company_id = m.company_id
         JOIN fin_accounts a ON a.id = m.account_id AND a.company_id = m.company_id
         WHERE m.company_id = :companyId`,
        { companyId },
      );
      const mappingByCol = {};
      for (const map of mappings) {
        if (map.account_id) {
          mappingByCol[map.column_name] = {
            account_id: Number(map.account_id),
            name: map.name,
            code: map.code,
          };
        }
      }
      if (userMappings.salary_expense) mappingByCol["basic_salary"] = { account_id: Number(userMappings.salary_expense) };
      if (userMappings.allowances_expense) mappingByCol["allowances"] = { account_id: Number(userMappings.allowances_expense) };
      if (userMappings.ssf_employer_expense) mappingByCol["ssf_employer"] = { account_id: Number(userMappings.ssf_employer_expense) };
      if (userMappings.tier3_employer_expense) mappingByCol["tier3_employer"] = { account_id: Number(userMappings.tier3_employer_expense) };
      if (userMappings.salary_payable) mappingByCol["net_salary"] = { account_id: Number(userMappings.salary_payable) };
      if (userMappings.ssnit_payable) {
        mappingByCol["ssnit"] = { account_id: Number(userMappings.ssnit_payable) };
        mappingByCol["ssf_employee"] = { account_id: Number(userMappings.ssnit_payable) };
      }
      if (userMappings.tier3_payable) {
        mappingByCol["tier3_employee"] = { account_id: Number(userMappings.tier3_payable) };
        mappingByCol["tier3"] = { account_id: Number(userMappings.tier3_payable) };
      }
      if (userMappings.paye_payable) mappingByCol["income_tax"] = { account_id: Number(userMappings.paye_payable) };
      if (userMappings.deductions_payable) mappingByCol["deductions"] = { account_id: Number(userMappings.deductions_payable) };

      // 2. Query exact totals for all payroll item components
      const totalsRows = await query(
        `SELECT 
           COALESCE(SUM(basic_salary), 0) AS basic_salary,
           COALESCE(SUM(allowances), 0) AS allowances,
           COALESCE(SUM(deductions), 0) AS deductions,
           COALESCE(SUM(income_tax), 0) AS income_tax,
           COALESCE(SUM(ssf_employee), 0) AS ssf_employee,
           COALESCE(SUM(ssf_employer), 0) AS ssf_employer,
           COALESCE(SUM(tier3_employee), 0) AS tier3_employee,
           COALESCE(SUM(tier3_employer), 0) AS tier3_employer,
           COALESCE(SUM(net_salary), 0) AS net_salary
         FROM hr_payroll_items
         WHERE payroll_id = :pid`,
        { pid: payroll_id },
      );
      const totalsObj = totalsRows?.[0] || {};
      const basic = Number(totalsObj.basic_salary || 0);
      const allowances = Number(totalsObj.allowances || 0);
      const deductions = Number(totalsObj.deductions || 0);
      const income_tax = Number(totalsObj.income_tax || 0);
      const ssf_employee = Number(totalsObj.ssf_employee || 0);
      const ssf_employer = Number(totalsObj.ssf_employer || 0);
      const tier3_employee = Number(totalsObj.tier3_employee || 0);
      const tier3_employer = Number(totalsObj.tier3_employer || 0);
      const net_salary = Number(totalsObj.net_salary || 0);

      // Total expense debits
      const totalExpenseDebits =
        Math.round((basic + allowances + ssf_employer + tier3_employer) * 100) /
        100;

      // 3. Setup fiscal year, voucher type and metadata
      const fyRows = await query(
        `SELECT id FROM fin_fiscal_years
         WHERE (company_id = :companyId OR company_id = 1) AND (is_open = 1 OR is_open IS NULL)
         ORDER BY start_date DESC LIMIT 1`,
        { companyId },
      );
      const fiscalYearId = fyRows.length ? fyRows[0].id : null;
      const vtRows = await query(
        `SELECT id FROM fin_voucher_types
         WHERE code = 'JV' LIMIT 1`,
      );
      const voucherTypeId = vtRows.length ? vtRows[0].id : null;
      const voucherNo = `PR${Date.now()}`;
      const voucherDate = new Date().toISOString().slice(0, 10);
      const createdBy = req.user?.id || req.user?.sub || null;

      // Create Voucher Header
      const vIns = await query(
        `INSERT INTO fin_vouchers
           (company_id, branch_id, fiscal_year_id, voucher_type_id, voucher_no, voucher_date, narration, currency_id, exchange_rate, total_debit, total_credit, status, created_by, approved_by, posted_by)
         VALUES
           (:companyId, :branchId, :fiscalYearId, :voucherTypeId, :voucherNo, :voucherDate, :narration, NULL, 1, :totalDebit, :totalCredit, 'POSTED', :createdBy, :approvedBy, :postedBy)`,
        {
          companyId,
          branchId: req.scope.branchId,
          fiscalYearId,
          voucherTypeId,
          voucherNo,
          voucherDate,
          narration:
            narration || `Payroll posting for period #${hdr.period_id}`,
          totalDebit: totalExpenseDebits,
          totalCredit: totalExpenseDebits,
          createdBy,
          approvedBy: createdBy,
          postedBy: createdBy,
        },
      );
      const voucherId = Number(vIns?.insertId || 0);
      let lineNo = 1;

      // Helper function to insert voucher lines
      const insertLine = async (accountId, description, debit, credit) => {
        if (!accountId) return;
        await query(
          `INSERT INTO fin_voucher_lines
             (company_id, voucher_id, line_no, account_id, description, debit, credit, tax_code_id, cost_center, reference_no)
           VALUES
             (:companyId, :voucherId, :lineNo, :accountId, :description, :debit, :credit, NULL, NULL, NULL)`,
          {
            companyId,
            voucherId,
            lineNo: lineNo++,
            accountId,
            description,
            debit: Math.round(debit * 100) / 100,
            credit: Math.round(credit * 100) / 100,
          },
        );
      };

      // ─── DEBIT LINES (EXPENSES) ───
      // Basic / Gross Salary Debit
      await insertLine(expense_account_id, "Basic Salaries Expense", basic, 0);

      // Allowances Debit
      if (allowances > 0) {
        const allowanceAccId =
          mappingByCol["allowances"]?.account_id || expense_account_id;
        await insertLine(
          allowanceAccId,
          "Staff Allowances Expense",
          allowances,
          0,
        );
      }

      // SSF Employer Debit
      if (ssf_employer > 0) {
        const ssfEmployerAccId =
          mappingByCol["ssf_employer"]?.account_id || expense_account_id;
        await insertLine(
          ssfEmployerAccId,
          "Employer SSF Expense",
          ssf_employer,
          0,
        );
      }

      // Tier 3 Employer Debit
      if (tier3_employer > 0) {
        const tier3EmployerAccId =
          mappingByCol["tier3_employer"]?.account_id || expense_account_id;
        await insertLine(
          tier3EmployerAccId,
          "Employer Tier 3 Expense",
          tier3_employer,
          0,
        );
      }

      // ─── CREDIT LINES (PAYABLES / LIABILITIES) ───
      // Net Salary Payable Credit
      const netSalaryAccId =
        mappingByCol["net_salary"]?.account_id || payable_account_id;
      await insertLine(netSalaryAccId, "Net Salaries Payable", 0, net_salary);

      // Income Tax (PAYE) Credit
      if (income_tax > 0) {
        let taxAccId = mappingByCol["income_tax"]?.account_id;
        if (!taxAccId) {
          const payeAccRows = await query(
            `SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = 'PAYE Payable' LIMIT 1`,
            { companyId },
          );
          if (payeAccRows.length) taxAccId = Number(payeAccRows[0].id);
        }
        if (taxAccId) {
          await insertLine(taxAccId, "PAYE Payable", 0, income_tax);
        }
      }

      // SSNIT / SSF Payable (Employee + Employer) Credit
      const ssnitTotal = ssf_employee + ssf_employer;
      if (ssnitTotal > 0) {
        let ssfAccId =
          mappingByCol["ssnit"]?.account_id ||
          mappingByCol["ssf_employee"]?.account_id;
        if (!ssfAccId) {
          const ssnitAccRows = await query(
            `SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = 'SSNIT/Pension Payable' LIMIT 1`,
            { companyId },
          );
          if (ssnitAccRows.length) ssfAccId = Number(ssnitAccRows[0].id);
        }
        if (ssfAccId) {
          await insertLine(ssfAccId, "SSNIT/Pension Payable", 0, ssnitTotal);
        }
      }

      // Tier 3 / Provident Fund Payable (Employee + Employer) Credit
      const providentTotal = tier3_employee + tier3_employer;
      if (providentTotal > 0) {
        let provAccId =
          mappingByCol["tier3_employee"]?.account_id ||
          mappingByCol["tier2"]?.account_id;
        if (!provAccId) {
          const provAccRows = await query(
            `SELECT id FROM fin_accounts WHERE company_id = :companyId AND name = 'Provident Fund Payable' LIMIT 1`,
            { companyId },
          );
          if (provAccRows.length) provAccId = Number(provAccRows[0].id);
        }
        await insertLine(
          provAccId || payable_account_id,
          "Provident Fund Payable",
          0,
          providentTotal,
        );
      }

      // Staff Loan Recoveries Credit (Credited to staff loan asset accounts)
      const loanRepayRows = await query(
        `SELECT lr.loan_id, l.loan_type, lr.amount_paid,
                COALESCE(lt.account_id, l.payment_account_id) AS account_id,
                a.name AS account_name, a.code AS account_code
         FROM hr_loan_repayments lr
         JOIN hr_loans l ON l.id = lr.loan_id
         LEFT JOIN hr_setup_loan_types lt ON lt.id = l.loan_id OR lt.name = l.loan_type
         LEFT JOIN fin_accounts a ON a.id = lt.account_id
         WHERE lr.payroll_id = :pid AND lr.amount_paid > 0`,
        { pid: payroll_id },
      );

      let totalLoansRepaid = 0;
      const loanAccountTotals = {};
      for (const lr of loanRepayRows || []) {
        const amt = Number(lr.amount_paid || 0);
        totalLoansRepaid += amt;
        const accKey = `loan_account_${lr.account_id || lr.loan_type}`;
        const targetAccId = Number(userMappings[accKey] || lr.account_id || 0);
        if (targetAccId) {
          if (!loanAccountTotals[targetAccId]) {
            loanAccountTotals[targetAccId] = {
              name: lr.account_name || `Staff Loan - ${lr.loan_type || "Loan"}`,
              amount: 0,
            };
          }
          loanAccountTotals[targetAccId].amount += amt;
        }
      }

      for (const [accIdStr, info] of Object.entries(loanAccountTotals)) {
        await insertLine(
          Number(accIdStr),
          `Staff Loan Recovery - ${info.name}`,
          0,
          info.amount,
        );
      }

      // Other Deductions Payable Credit (deductions excluding statutory PAYE, SSF, Tier 3, and loans)
      const otherDeductionsTotal = Math.max(
        0,
        Math.round((deductions - income_tax - ssf_employee - tier3_employee - totalLoansRepaid) * 100) / 100,
      );
      if (otherDeductionsTotal > 0) {
        const deductionsAccId =
          mappingByCol["deductions"]?.account_id || payable_account_id;
        await insertLine(
          deductionsAccId,
          "Other Deductions Payable",
          0,
          otherDeductionsTotal,
        );
      }
    }
    res.json({ message: "Payroll closed" });
  } catch (err) {
    next(err);
  }
}
/**
/**
 * Onboarding - Assign Checklist to Employee
 */
export async function assignOnboardingChecklist(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { employee_id, checklist_id, assigned_date } = req.body;
    if (!employee_id || !checklist_id)
      throw httpError(
        400,
        "BAD_REQUEST",
        "employee_id and checklist_id required",
      );

    const result = await query(
      `INSERT INTO hr_onboarding_assignments (company_id, employee_id, checklist_id, assigned_date, status, created_by)
       VALUES (:companyId, :employee_id, :checklist_id, :assigned_date, 'PENDING', :userId)`,
      {
        companyId,
        employee_id,
        checklist_id,
        assigned_date: assigned_date || new Date().toISOString().slice(0, 10),
        userId,
      },
    );

    const tasks = await query(
      `SELECT *,
          created_at FROM hr_onboarding_tasks
         WHERE checklist_id = :checklist_id ORDER BY task_order ASC`,
      { checklist_id },
    ).catch(() => []);
    for (const t of tasks) {
      // eslint-disable-next-line no-await-in-loop
      await query(
        `INSERT INTO hr_onboarding_assignment_tasks (assignment_id, task_order, title, description, completed)
         VALUES (:assignment_id, :task_order, :title, :description, 0)`,
        {
          assignment_id: result.insertId,
          task_order: t.task_order,
          title: t.title,
          description: t.description || null,
        },
      );
    }

    res
      .status(201)
      .json({ id: result.insertId, message: "Onboarding assigned" });
  } catch (err) {
    next(err);
  }
}

export async function backfillTier3(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const taxRows = await query(
      `SELECT employee_contribution_rate,
          created_at FROM hr_tax_config
         WHERE company_id = :companyId AND is_active = 1 AND 
             (tax_type = 'PROVIDENT_FUND' OR UPPER(tax_name) LIKE '%TIER 3%' OR UPPER(tax_name) LIKE '%TIER-3%')`,
      { companyId },
    );
    let rate = 0;
    for (const r of taxRows) {
      rate += Number(r.employee_contribution_rate || 0);
    }
    rate = rate / 100;
    const existCol = async (table, col) => {
      const r = await query(
        `SELECT COUNT(*) AS c,
          created_at FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :t AND COLUMN_NAME = :c`,
        { t: table, c: col },
      ).catch(() => []);
      return Number(r?.[0]?.c || 0) > 0;
    };
    if (!(await existCol("hr_payroll_items", "tier3_employee"))) {
      await query(
        `ALTER TABLE hr_payroll_items ADD COLUMN tier3_employee DECIMAL(18,4) NOT NULL DEFAULT 0`,
        {},
      ).catch(() => {});
    }
    if (!(await existCol("hr_payslips", "tier3_employee"))) {
      await query(
        `ALTER TABLE hr_payslips ADD COLUMN tier3_employee DECIMAL(18,4) NOT NULL DEFAULT 0`,
        {},
      ).catch(() => {});
    }
    const rows = await query(
      `SELECT pi.payroll_id, pi.employee_id, pi.basic_salary, p.period_id,
          pi.created_at FROM hr_payroll_items pi
       JOIN hr_payroll p ON p.id = pi.payroll_id
         WHERE p.company_id = :companyId`,
      { companyId },
    );
    let updated = 0;
    for (const r of rows) {
      const amount = Number(r.basic_salary || 0) * rate;
      await query(
        `UPDATE hr_payroll_items SET tier3_employee = :amt WHERE payroll_id = :pid AND employee_id = :eid`,
        { amt: amount, pid: r.payroll_id, eid: r.employee_id },
      ).catch(() => {});
      await query(
        `UPDATE hr_payslips SET tier3_employee = :amt WHERE employee_id = :eid AND period_id = :period_id`,
        { amt: amount, eid: r.employee_id, period_id: r.period_id },
      ).catch(() => {});
      updated++;
    }
    res.json({ message: "Tier 3 backfill completed", updated });
  } catch (err) {
    next(err);
  }
}

export async function updateOnboardingTask(req, res, next) {
  try {
    const { assignment_id, task_id, completed } = req.body;
    if (!assignment_id || !task_id)
      throw httpError(400, "BAD_REQUEST", "assignment_id and task_id required");

    await query(
      `UPDATE hr_onboarding_assignment_tasks 
       SET completed = :completed, completed_at = CASE WHEN :completed = 1 THEN NOW() ELSE NULL END 
       WHERE id = :task_id AND assignment_id = :assignment_id`,
      { completed: completed ? 1 : 0, task_id, assignment_id },
    );

    const pendingCountRows = await query(
      `SELECT COUNT(*) AS c,
          created_at FROM hr_onboarding_assignment_tasks
         WHERE assignment_id = :assignment_id AND completed = 0`,
      { assignment_id },
    );
    const remaining = Number(pendingCountRows?.[0]?.c || 0);
    await query(
      `UPDATE hr_onboarding_assignments 
       SET status = CASE WHEN :remaining = 0 THEN 'COMPLETED' ELSE 'IN_PROGRESS' END
       WHERE id = :assignment_id`,
      { remaining, assignment_id },
    );
    res.json({ message: "Task updated" });
  } catch (err) {
    next(err);
  }
}

export async function listOnboardingAssignments(req, res, next) {
  try {
    const { employee_id } = req.query;
    const clauses = [];
    const params = {};
    if (employee_id) {
      clauses.push("a.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(
      `SELECT a.*, e.first_name, e.last_name, c.name AS checklist_name,
          a.created_at FROM hr_onboarding_assignments a
       LEFT JOIN hr_employees e ON e.id = a.employee_id
       LEFT JOIN hr_onboarding_checklists c ON c.id = a.checklist_id
       ${where}
         ORDER BY a.created_at DESC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Locations
 */
export async function listLocations(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT * FROM hr_locations
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL) ORDER BY location_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveLocation(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const branchId = req.scope.branchId || req.user?.branch_id || 1;
    const { id, location_name, address, is_active } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    if (id) {
      await query(
        `UPDATE hr_locations SET location_name = :location_name, address = :address, is_active = :is_active, updated_by = :userId WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          location_name,
          address,
          is_active: is_active === false ? 0 : 1,
          userId,
        },
      );
    } else {
      await query(
        `INSERT INTO hr_locations (company_id, branch_id, location_name, address, is_active, created_by) VALUES (:companyId, :branchId, :location_name, :address, :is_active, :userId)`,
        {
          companyId,
          branchId,
          location_name,
          address,
          is_active: is_active === false ? 0 : 1,
          userId,
        },
      );
    }
    res.json({ message: "Location saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Parameters
 */
export async function listParameters(req, res, next) {
  try {
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT id, param_key, param_value FROM hr_setup_parameters
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL)`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveParameters(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { parameters } = req.body;
    if (parameters && typeof parameters === "object") {
      for (const [key, value] of Object.entries(parameters)) {
        await query(
          `INSERT INTO hr_setup_parameters (company_id, param_key, param_value) 
           VALUES (:companyId, :key, :value) 
           ON DUPLICATE KEY UPDATE param_value = :value`,
          { companyId, key, value: String(value) },
        );
      }
    }
    res.json({ message: "Parameters saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * HR Reports
 */
export async function reportEmployees(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { dept_id, q } = req.query;
    const clauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr) OR e.branch_id IS NULL)",
      "e.deleted_at IS NULL",
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };
    if (dept_id) {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = dept_id;
    }
    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }
    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT e.id, e.emp_code, e.first_name, e.last_name, d.dept_name, p.pos_name, e.email, e.phone, e.status,
          e.created_at FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_positions p ON p.id = e.pos_id
       ${where}
         ORDER BY e.emp_code ASC`,
      params,
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportSSF(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { period_id, month, from_date, to_date, dept_id, q } = req.query;

    const clauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr) OR e.branch_id IS NULL)",
      "e.deleted_at IS NULL",
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };

    if (period_id && period_id !== "ALL") {
      clauses.push("p.id = :period_id");
      params.period_id = Number(period_id);
    }
    if (month && month !== "ALL") {
      clauses.push("(DATE_FORMAT(p.start_date, '%Y-%m') = :month OR DATE_FORMAT(p.end_date, '%Y-%m') = :month)");
      params.month = month;
    }
    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (from_date) {
      clauses.push("p.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("p.end_date <= :to_date");
      params.to_date = to_date;
    }
    if (q) {
      clauses.push("(e.emp_code LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q)");
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT 
        ps.id AS payslip_id,
        ps.period_id,
        p.period_name,
        DATE_FORMAT(p.start_date, '%Y-%m') AS period_month,
        p.start_date,
        p.end_date,
        e.id AS employee_id,
        e.emp_code,
        CONCAT(e.first_name, ' ', COALESCE(CONCAT(e.middle_name, ' '), ''), e.last_name) AS full_name,
        COALESCE(e.ssnit_number, e.ssnit_no, '') AS ssnit_number,
        COALESCE(d.dept_name, 'General') AS dept_name,
        COALESCE(pos.pos_name, '') AS pos_name,
        ROUND(ps.basic_salary, 2) AS basic_salary,
        ROUND(ps.ssf_employee, 2) AS ssf_employee,
        ROUND(COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)), 2) AS ssf_employer,
        ROUND(ps.ssf_employee + COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)), 2) AS total_ssnit,
        ROUND(COALESCE(ps.tier3_employee, 0), 2) AS tier3_employee,
        ROUND(COALESCE(ps.tier3_employer, 0), 2) AS tier3_employer,
        ROUND(COALESCE(ps.tier3_employee, 0) + COALESCE(ps.tier3_employer, 0), 2) AS total_tier3,
        ROUND(
          ps.ssf_employee + 
          COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)) + 
          COALESCE(ps.tier3_employee, 0) + 
          COALESCE(ps.tier3_employer, 0),
          2
        ) AS total_statutory_remittance,
        ps.created_at
      FROM hr_payslips ps
      JOIN hr_employees e ON e.id = ps.employee_id
      JOIN hr_payroll_periods p ON p.id = ps.period_id
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      LEFT JOIN hr_positions pos ON pos.id = e.pos_id
      ${where}
      ORDER BY p.start_date DESC, e.emp_code ASC`,
      params
    ).catch(() => []);

    const summary = {
      headcount: items.length,
      total_basic_salary: items.reduce((acc, it) => acc + Number(it.basic_salary || 0), 0),
      total_ssf_employee: items.reduce((acc, it) => acc + Number(it.ssf_employee || 0), 0),
      total_ssf_employer: items.reduce((acc, it) => acc + Number(it.ssf_employer || 0), 0),
      total_ssnit: items.reduce((acc, it) => acc + Number(it.total_ssnit || 0), 0),
      total_tier3_employee: items.reduce((acc, it) => acc + Number(it.tier3_employee || 0), 0),
      total_tier3_employer: items.reduce((acc, it) => acc + Number(it.tier3_employer || 0), 0),
      total_tier3: items.reduce((acc, it) => acc + Number(it.total_tier3 || 0), 0),
      total_remittance: items.reduce((acc, it) => acc + Number(it.total_statutory_remittance || 0), 0),
    };

    res.json({ items, summary });
  } catch (err) {
    next(err);
  }
}

export async function reportPAYE(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { period_id, month, from_date, to_date, dept_id, q } = req.query;

    const clauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr) OR e.branch_id IS NULL)",
      "e.deleted_at IS NULL",
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };

    if (period_id && period_id !== "ALL") {
      clauses.push("p.id = :period_id");
      params.period_id = Number(period_id);
    }
    if (month && month !== "ALL") {
      clauses.push("(DATE_FORMAT(p.start_date, '%Y-%m') = :month OR DATE_FORMAT(p.end_date, '%Y-%m') = :month)");
      params.month = month;
    }
    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (from_date) {
      clauses.push("p.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("p.end_date <= :to_date");
      params.to_date = to_date;
    }
    if (q) {
      clauses.push("(e.emp_code LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q)");
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT 
        ps.id AS payslip_id,
        ps.period_id,
        p.period_name,
        DATE_FORMAT(p.start_date, '%Y-%m') AS period_month,
        p.start_date,
        p.end_date,
        e.id AS employee_id,
        e.emp_code,
        CONCAT(e.first_name, ' ', COALESCE(CONCAT(e.middle_name, ' '), ''), e.last_name) AS full_name,
        COALESCE(e.tin, e.national_id, '') AS tax_id,
        COALESCE(d.dept_name, 'General') AS dept_name,
        COALESCE(pos.pos_name, '') AS pos_name,
        ROUND(ps.basic_salary, 2) AS basic_salary,
        ROUND(ps.allowances, 2) AS allowances,
        ROUND(ps.basic_salary + ps.allowances, 2) AS gross_salary,
        ROUND(ps.ssf_employee, 2) AS ssf_relief,
        ROUND(COALESCE(ps.tier3_employee, 0), 2) AS tier3_relief,
        ROUND(COALESCE(ps.tax_relief, 0), 2) AS personal_tax_relief,
        ROUND(ps.ssf_employee + COALESCE(ps.tier3_employee, 0) + COALESCE(ps.tax_relief, 0), 2) AS total_tax_reliefs,
        ROUND(COALESCE(ps.subtotal_a, GREATEST(0, (ps.basic_salary + ps.allowances) - (ps.ssf_employee + COALESCE(ps.tier3_employee, 0) + COALESCE(ps.tax_relief, 0)))), 2) AS taxable_income,
        ROUND(ps.income_tax, 2) AS paye_tax,
        ROUND(ps.net_salary, 2) AS net_salary,
        ps.created_at
      FROM hr_payslips ps
      JOIN hr_employees e ON e.id = ps.employee_id
      JOIN hr_payroll_periods p ON p.id = ps.period_id
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      LEFT JOIN hr_positions pos ON pos.id = e.pos_id
      ${where}
      ORDER BY p.start_date DESC, e.emp_code ASC`,
      params
    ).catch(() => []);

    const summary = {
      headcount: items.length,
      total_basic_salary: items.reduce((acc, it) => acc + Number(it.basic_salary || 0), 0),
      total_allowances: items.reduce((acc, it) => acc + Number(it.allowances || 0), 0),
      total_gross_salary: items.reduce((acc, it) => acc + Number(it.gross_salary || 0), 0),
      total_ssf_relief: items.reduce((acc, it) => acc + Number(it.ssf_relief || 0), 0),
      total_tier3_relief: items.reduce((acc, it) => acc + Number(it.tier3_relief || 0), 0),
      total_personal_relief: items.reduce((acc, it) => acc + Number(it.personal_tax_relief || 0), 0),
      total_tax_reliefs: items.reduce((acc, it) => acc + Number(it.total_tax_reliefs || 0), 0),
      total_taxable_income: items.reduce((acc, it) => acc + Number(it.taxable_income || 0), 0),
      total_paye_tax: items.reduce((acc, it) => acc + Number(it.paye_tax || 0), 0),
      total_net_salary: items.reduce((acc, it) => acc + Number(it.net_salary || 0), 0),
    };

    res.json({ items, summary });
  } catch (err) {
    next(err);
  }
}

export async function reportSalaries(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { period_id, month, from_date, to_date, dept_id, q } = req.query;

    const clauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr) OR e.branch_id IS NULL)",
      "e.deleted_at IS NULL",
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };

    if (period_id && period_id !== "ALL") {
      clauses.push("p.id = :period_id");
      params.period_id = Number(period_id);
    }
    if (month && month !== "ALL") {
      clauses.push("(DATE_FORMAT(p.start_date, '%Y-%m') = :month OR DATE_FORMAT(p.end_date, '%Y-%m') = :month)");
      params.month = month;
    }
    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (from_date) {
      clauses.push("p.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("p.end_date <= :to_date");
      params.to_date = to_date;
    }
    if (q) {
      clauses.push("(e.emp_code LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q)");
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT 
        ps.id AS payslip_id,
        ps.period_id,
        p.period_name,
        DATE_FORMAT(p.start_date, '%Y-%m') AS period_month,
        p.start_date,
        p.end_date,
        e.id AS employee_id,
        e.emp_code,
        CONCAT(e.first_name, ' ', COALESCE(CONCAT(e.middle_name, ' '), ''), e.last_name) AS full_name,
        COALESCE(d.dept_name, 'General') AS dept_name,
        COALESCE(pos.pos_name, '') AS pos_name,
        ROUND(ps.basic_salary, 2) AS basic_salary,
        ROUND(ps.allowances, 2) AS allowances,
        ROUND(ps.basic_salary + ps.allowances, 2) AS gross_salary,
        ROUND(ps.ssf_employee, 2) AS ssf_employee,
        ROUND(ps.income_tax, 2) AS paye_tax,
        ROUND(COALESCE(ps.loan_deductions_total, 0), 2) AS loan_deductions,
        ROUND(GREATEST(0, ps.deductions - ps.ssf_employee - ps.income_tax - COALESCE(ps.loan_deductions_total, 0)), 2) AS other_deductions,
        ROUND(ps.deductions, 2) AS total_deductions,
        ROUND(ps.net_salary, 2) AS net_salary,
        COALESCE(e.bank_name, '') AS bank_name,
        COALESCE(e.bank_account_no, e.bank_account_number, '') AS bank_account_no,
        ps.status,
        ps.created_at
      FROM hr_payslips ps
      JOIN hr_employees e ON e.id = ps.employee_id
      JOIN hr_payroll_periods p ON p.id = ps.period_id
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      LEFT JOIN hr_positions pos ON pos.id = e.pos_id
      ${where}
      ORDER BY p.start_date DESC, e.emp_code ASC`,
      params
    ).catch(() => []);

    const summary = {
      headcount: items.length,
      total_basic_salary: items.reduce((acc, it) => acc + Number(it.basic_salary || 0), 0),
      total_allowances: items.reduce((acc, it) => acc + Number(it.allowances || 0), 0),
      total_gross_salary: items.reduce((acc, it) => acc + Number(it.gross_salary || 0), 0),
      total_ssf_employee: items.reduce((acc, it) => acc + Number(it.ssf_employee || 0), 0),
      total_paye_tax: items.reduce((acc, it) => acc + Number(it.paye_tax || 0), 0),
      total_loan_deductions: items.reduce((acc, it) => acc + Number(it.loan_deductions || 0), 0),
      total_other_deductions: items.reduce((acc, it) => acc + Number(it.other_deductions || 0), 0),
      total_deductions: items.reduce((acc, it) => acc + Number(it.total_deductions || 0), 0),
      total_net_salary: items.reduce((acc, it) => acc + Number(it.net_salary || 0), 0),
    };

    res.json({ items, summary });
  } catch (err) {
    next(err);
  }
}

export async function reportMonthlyPayroll(req, res, next) {
  try {
    await ensureHRTables();
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { period_id, month, dept_id, q } = req.query;

    const baseClauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr) OR e.branch_id IS NULL)",
      "e.deleted_at IS NULL",
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };

    if (period_id && period_id !== "ALL") {
      baseClauses.push("p.id = :period_id");
      params.period_id = Number(period_id);
    }
    if (month && month !== "ALL") {
      baseClauses.push("(DATE_FORMAT(p.start_date, '%Y-%m') = :month OR DATE_FORMAT(p.end_date, '%Y-%m') = :month)");
      params.month = month;
    }
    if (dept_id && dept_id !== "ALL") {
      baseClauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (q) {
      baseClauses.push("(e.emp_code LIKE :q OR e.first_name LIKE :q OR e.last_name LIKE :q)");
      params.q = `%${q}%`;
    }

    const where = `WHERE ${baseClauses.join(" AND ")}`;

    // Detailed employee records
    const detailed = await query(
      `SELECT 
        ps.id AS payslip_id,
        ps.period_id,
        p.period_name,
        DATE_FORMAT(p.start_date, '%Y-%m') AS period_month,
        p.start_date,
        p.end_date,
        e.id AS employee_id,
        e.emp_code,
        CONCAT(e.first_name, ' ', COALESCE(CONCAT(e.middle_name, ' '), ''), e.last_name) AS full_name,
        COALESCE(e.ssnit_number, e.ssnit_no, '') AS ssnit_number,
        COALESCE(e.tin, e.national_id, '') AS tax_id,
        COALESCE(d.dept_name, 'General') AS dept_name,
        COALESCE(pos.pos_name, '') AS pos_name,
        ROUND(ps.basic_salary, 2) AS basic_salary,
        ROUND(ps.allowances, 2) AS allowances,
        ROUND(ps.basic_salary + ps.allowances, 2) AS gross_salary,
        ROUND(ps.ssf_employee, 2) AS ssf_employee,
        ROUND(COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)), 2) AS ssf_employer,
        ROUND(ps.ssf_employee + COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)), 2) AS total_ssnit,
        ROUND(COALESCE(ps.tier3_employee, 0), 2) AS tier3_employee,
        ROUND(COALESCE(ps.tier3_employer, 0), 2) AS tier3_employer,
        ROUND(COALESCE(ps.tax_relief, 0), 2) AS personal_tax_relief,
        ROUND(COALESCE(ps.subtotal_a, GREATEST(0, (ps.basic_salary + ps.allowances) - (ps.ssf_employee + COALESCE(ps.tier3_employee, 0) + COALESCE(ps.tax_relief, 0)))), 2) AS taxable_income,
        ROUND(ps.income_tax, 2) AS paye_tax,
        ROUND(COALESCE(ps.loan_deductions_total, 0), 2) AS loan_deductions,
        ROUND(GREATEST(0, ps.deductions - ps.ssf_employee - ps.income_tax - COALESCE(ps.loan_deductions_total, 0)), 2) AS other_deductions,
        ROUND(ps.deductions, 2) AS total_deductions,
        ROUND(ps.net_salary, 2) AS net_salary,
        ROUND((ps.basic_salary + ps.allowances) + COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)) + COALESCE(ps.tier3_employer, 0), 2) AS total_employer_cost,
        COALESCE(e.bank_name, '') AS bank_name,
        COALESCE(e.bank_account_no, e.bank_account_number, '') AS bank_account_no,
        ps.status,
        ps.created_at
      FROM hr_payslips ps
      JOIN hr_employees e ON e.id = ps.employee_id
      JOIN hr_payroll_periods p ON p.id = ps.period_id
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      LEFT JOIN hr_positions pos ON pos.id = e.pos_id
      ${where}
      ORDER BY d.dept_name ASC, e.emp_code ASC`,
      params
    ).catch(() => []);

    // Consolidated grouping by department
    const consolidated = await query(
      `SELECT 
        COALESCE(d.dept_name, 'General') AS dept_name,
        COUNT(ps.id) AS headcount,
        ROUND(SUM(ps.basic_salary), 2) AS total_basic_salary,
        ROUND(SUM(ps.allowances), 2) AS total_allowances,
        ROUND(SUM(ps.basic_salary + ps.allowances), 2) AS total_gross_salary,
        ROUND(SUM(ps.ssf_employee), 2) AS total_ssf_employee,
        ROUND(SUM(COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2))), 2) AS total_ssf_employer,
        ROUND(SUM(ps.ssf_employee + COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2))), 2) AS total_ssf_combined,
        ROUND(SUM(COALESCE(ps.tier3_employee, 0)), 2) AS total_tier3_employee,
        ROUND(SUM(COALESCE(ps.tier3_employer, 0)), 2) AS total_tier3_employer,
        ROUND(SUM(COALESCE(ps.tax_relief, 0)), 2) AS total_tax_relief,
        ROUND(SUM(COALESCE(ps.subtotal_a, GREATEST(0, (ps.basic_salary + ps.allowances) - (ps.ssf_employee + COALESCE(ps.tier3_employee, 0) + COALESCE(ps.tax_relief, 0))))), 2) AS total_taxable_income,
        ROUND(SUM(ps.income_tax), 2) AS total_paye_tax,
        ROUND(SUM(COALESCE(ps.loan_deductions_total, 0)), 2) AS total_loan_deductions,
        ROUND(SUM(ps.deductions), 2) AS total_deductions,
        ROUND(SUM(ps.net_salary), 2) AS total_net_salary,
        ROUND(SUM((ps.basic_salary + ps.allowances) + COALESCE(ps.ssf_employer, ROUND(ps.basic_salary * 0.13, 2)) + COALESCE(ps.tier3_employer, 0)), 2) AS total_employer_cost
      FROM hr_payslips ps
      JOIN hr_employees e ON e.id = ps.employee_id
      JOIN hr_payroll_periods p ON p.id = ps.period_id
      LEFT JOIN hr_departments d ON d.id = e.dept_id
      ${where}
      GROUP BY d.id, d.dept_name
      ORDER BY d.dept_name ASC`,
      params
    ).catch(() => []);

    const summary = {
      headcount: detailed.length,
      total_basic_salary: detailed.reduce((acc, it) => acc + Number(it.basic_salary || 0), 0),
      total_allowances: detailed.reduce((acc, it) => acc + Number(it.allowances || 0), 0),
      total_gross_salary: detailed.reduce((acc, it) => acc + Number(it.gross_salary || 0), 0),
      total_ssf_employee: detailed.reduce((acc, it) => acc + Number(it.ssf_employee || 0), 0),
      total_ssf_employer: detailed.reduce((acc, it) => acc + Number(it.ssf_employer || 0), 0),
      total_ssf_combined: detailed.reduce((acc, it) => acc + Number(it.total_ssnit || 0), 0),
      total_tier3_employee: detailed.reduce((acc, it) => acc + Number(it.tier3_employee || 0), 0),
      total_tier3_employer: detailed.reduce((acc, it) => acc + Number(it.tier3_employer || 0), 0),
      total_personal_tax_relief: detailed.reduce((acc, it) => acc + Number(it.personal_tax_relief || 0), 0),
      total_taxable_income: detailed.reduce((acc, it) => acc + Number(it.taxable_income || 0), 0),
      total_paye_tax: detailed.reduce((acc, it) => acc + Number(it.paye_tax || 0), 0),
      total_loan_deductions: detailed.reduce((acc, it) => acc + Number(it.loan_deductions || 0), 0),
      total_other_deductions: detailed.reduce((acc, it) => acc + Number(it.other_deductions || 0), 0),
      total_deductions: detailed.reduce((acc, it) => acc + Number(it.total_deductions || 0), 0),
      total_net_salary: detailed.reduce((acc, it) => acc + Number(it.net_salary || 0), 0),
      total_employer_cost: detailed.reduce((acc, it) => acc + Number(it.total_employer_cost || 0), 0),
    };

    res.json({
      detailed,
      consolidated,
      summary,
    });
  } catch (err) {
    next(err);
  }
}

export async function reportEmployeeLoans(req, res, next) {
  try {
    const {
      companyId = null,
      branchId = null,
      branchIdsStr = "",
    } = req.scope || {};
    const { from_date, to_date, dept_id, q } = req.query || {};

    const clauses = [
      "(:companyId IS NULL OR l.company_id = :companyId OR l.company_id IS NULL OR l.company_id = 1)",
      "(:branchIdsStr = '' OR FIND_IN_SET(l.branch_id, :branchIdsStr) OR l.branch_id IS NULL)"
    ];
    const params = {
      companyId: companyId ?? null,
      branchId: branchId ?? null,
      branchIdsStr: branchIdsStr ?? "",
    };

    if (dept_id) {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (from_date) {
      clauses.push("l.start_date >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("l.start_date <= :to_date");
      params.to_date = to_date;
    }
    if (q && String(q).trim()) {
      clauses.push("(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q OR l.loan_type LIKE :q)");
      params.q = `%${String(q).trim()}%`;
    }

    const items = await query(
      `SELECT l.id, e.emp_code, e.first_name, e.last_name, d.dept_name, l.loan_type, l.amount, l.monthly_installment, l.start_date, l.status,
              l.created_at 
       FROM hr_loans l
       JOIN hr_employees e ON e.id = l.employee_id
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY l.start_date DESC`,
      params,
    ).catch(() => []);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function reportEmployeeAllowances(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { from_date, to_date, dept_id, q } = req.query || {};

    const clauses = [
      "(:companyId IS NULL OR e.company_id = :companyId OR e.company_id IS NULL OR e.company_id = 1)"
    ];
    const params = { companyId: companyId ?? null };

    if (dept_id) {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = Number(dept_id);
    }
    if (from_date) {
      clauses.push("DATE(m.created_at) >= :from_date");
      params.from_date = from_date;
    }
    if (to_date) {
      clauses.push("DATE(m.created_at) <= :to_date");
      params.to_date = to_date;
    }
    if (q && String(q).trim()) {
      clauses.push("(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q OR a.allowance_name LIKE :q)");
      params.q = `%${String(q).trim()}%`;
    }

    const items = await query(
      `SELECT e.emp_code, e.first_name, e.last_name, d.dept_name, a.allowance_name, a.amount_type, a.amount,
              m.created_at 
       FROM hr_employee_allowance_mappings m
       JOIN hr_employees e ON e.id = m.employee_id
       JOIN hr_allowances a ON a.id = m.allowance_id
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       WHERE ${clauses.join(" AND ")}
       ORDER BY e.emp_code ASC`,
      params,
    ).catch(() => []);
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

/**
 * Bulk Payslip Emails
 */
export async function sendEmailBulk(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { payslipIds } = req.body;
    if (!Array.isArray(payslipIds)) {
      throw httpError(400, "BAD_REQUEST", "payslipIds must be an array");
    }

    let count = 0;
    for (const payslipId of payslipIds) {
      const rows = await query(
        `SELECT p.*, e.first_name, e.last_name, e.email, pr.period_name
           FROM hr_payslips p
         JOIN hr_employees e ON e.id = p.employee_id
         JOIN hr_payroll_periods pr ON pr.id = p.period_id
         WHERE p.id = :id AND e.company_id = :companyId`,
        { id: payslipId, companyId },
      );

      if (rows.length > 0 && rows[0].email) {
        const [bulkCheckPr] = await query(
          "SELECT status FROM hr_payroll WHERE period_id = :periodId AND company_id = :companyId ORDER BY id DESC LIMIT 1",
          { periodId: rows[0].period_id, companyId }
        ).catch(() => []);
        const bPrStat = String(bulkCheckPr?.status || '').toUpperCase();
        if (!['APPROVED', 'CLOSED'].includes(bPrStat)) {
          throw httpError(403, "FORBIDDEN", "Cannot send payslips: Processed salary for this period has not been approved yet.");
        }
        const p = rows[0];
        const html = `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #ddd; max-width: 600px;">
            <h2 style="color: #1d4ed8; margin-top: 0;">Payslip for ${
              p.period_name
            }</h2>
            <p>Dear ${p.first_name} ${p.last_name},</p>
            <p>Your payslip for ${
              p.period_name
            } has been generated and is now available for your review.</p>
            <div style="background: #f8fafc; padding: 15px; border-radius: 4px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Basic Salary</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.basic_salary,
                  ).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Allowances</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.allowances,
                  ).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;"><strong>Deductions</strong></td>
                  <td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0; text-align: right;">${Number(
                    p.deductions,
                  ).toFixed(2)}</td>
                </tr>
                <tr style="font-size: 1.1em;">
                  <td style="padding: 12px 0;"><strong>Net Salary</strong></td>
                  <td style="padding: 12px 0; text-align: right; color: #15803d;"><strong>${Number(
                    p.net_salary,
                  ).toFixed(2)}</strong></td>
                </tr>
              </table>
            </div>
            <p>Regards,<br/>Human Resources Department</p>
          </div>
        `;

        let attachments = [];
        try {
          const port = req.socket.localPort || process.env.PORT || 5000;
          const baseUrl = `http://127.0.0.1:${port}`;
          const token = req.headers.authorization;
          const fwdHeaders = {
            "Content-Type": "application/json",
            ...(token ? { Authorization: token } : {}),
            ...(req.headers["x-company-id"]
              ? { "x-company-id": req.headers["x-company-id"] }
              : {}),
            ...(req.headers["x-branch-id"]
              ? { "x-branch-id": req.headers["x-branch-id"] }
              : {}),
          };

          // Step 1: Get the rendered HTML
          const htmlUrl = `${baseUrl}/api/documents/salary-slip/${payslipId}/render`;
          const htmlRes = await fetch(htmlUrl, {
            method: "POST",
            headers: fwdHeaders,
            body: JSON.stringify({ format: "html" }),
          });
          if (!htmlRes.ok) {
            console.warn(
              "[SEND-PAYSLIP-BULK] Failed to fetch HTML, status:",
              htmlRes.status,
            );
            throw new Error("HTML fetch failed");
          }
          const payslipHtml = await htmlRes.text();

          // Step 2: Convert HTML to PDF
          const pdfUrl = `${baseUrl}/api/documents/raw-html-to-pdf`;
          const pdfRes = await fetch(pdfUrl, {
            method: "POST",
            headers: fwdHeaders,
            body: JSON.stringify({ html: payslipHtml }),
          });
          if (!pdfRes.ok) {
            console.warn(
              "[SEND-PAYSLIP-BULK] Failed to generate PDF, status:",
              pdfRes.status,
            );
            throw new Error("PDF generation failed");
          }
          const arrayBuffer = await pdfRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          if (buffer.length > 0) {
            const safeName = `Payslip_${p.period_name.replace(/\s+/g, "_")}_${p.first_name}_${p.last_name}.pdf`;
            attachments.push({
              filename: safeName,
              content: buffer,
              contentType: "application/pdf",
            });
            console.log(
              `[SEND-PAYSLIP-BULK] PDF attached: ${safeName} (${buffer.length} bytes)`,
            );
          }
        } catch (e) {
          console.warn(
            "[SEND-PAYSLIP-BULK] Warning: Error generating PDF attachment:",
            e.message,
          );
        }

        await sendMail({
          to: p.email,
          subject: `Your Payslip for ${p.period_name}`,
          html,
          attachments,
        });
        count++;
      }
    }

    res.json({ message: `${count} payslip(s) sent successfully` });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Employment Types
 */
export async function listEmploymentTypes(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT * FROM hr_setup_employment_types
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL) ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmploymentType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_employment_types SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_employment_types (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Employment type saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Employee Categories
 */
export async function listEmployeeCategories(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT * FROM hr_setup_employee_categories
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL) ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmployeeCategory(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_employee_categories SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_employee_categories (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Employee category saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Setup - Allowance Types
 */
export async function listAllowanceTypes(req, res, next) {
  try {
    await ensureHRTables();
    const companyId = req.scope?.companyId || req.user?.company_id || 1;
    const items = await query(
      `SELECT * FROM hr_setup_allowance_types
         WHERE (:companyId IS NULL OR company_id = :companyId OR company_id = 1 OR company_id IS NULL) ORDER BY name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveAllowanceType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = null } = req.scope || {};
    const { id, name } = req.body;
    if (id) {
      await query(
        `UPDATE hr_setup_allowance_types SET name = :name WHERE id = :id AND company_id = :companyId`,
        { id, name, companyId },
      );
    } else {
      await query(
        `INSERT INTO hr_setup_allowance_types (company_id, name) VALUES (:companyId, :name)`,
        { companyId, name },
      );
    }
    res.json({ message: "Allowance type saved" });
  } catch (err) {
    next(err);
  }
}

/**
 * Work Schedules — link employees to shifts and off days
 */
async function ensureWorkSchedulesTable() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === "true") return;
  await query(
    `CREATE TABLE IF NOT EXISTS hr_work_schedules (
      id INT AUTO_INCREMENT PRIMARY KEY,
      company_id INT NOT NULL,
      employee_id INT NOT NULL,
      shift_id INT,
      off_days JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_emp_schedule (company_id, employee_id)
    )`,
    {},
  );
}

export async function listWorkSchedules(req, res, next) {
  try {
    await ensureWorkSchedulesTable();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT ws.*, 
              e.emp_code, e.first_name, e.last_name, e.status as emp_status,
              s.code as shift_code, s.name as shift_name, s.start_time, s.end_time, s.break_minutes,
          ws.created_at FROM hr_work_schedules ws
       JOIN hr_employees e ON e.id = ws.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_shifts s ON s.id = ws.shift_id
         WHERE ws.company_id = :companyId
       ORDER BY e.first_name ASC, e.last_name ASC`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveWorkSchedule(req, res, next) {
  try {
    await ensureWorkSchedulesTable();
    const { companyId = null } = req.scope || {};
    const { id, employee_id, shift_id, off_days, is_active } = req.body;

    if (id) {
      await query(
        `UPDATE hr_work_schedules 
         SET shift_id = :shift_id, off_days = :off_days, is_active = :is_active
         WHERE id = :id AND company_id = :companyId`,
        {
          id,
          shift_id: shift_id || null,
          off_days: JSON.stringify(off_days || []),
          is_active: is_active !== false ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Work schedule updated" });
    } else {
      await query(
        `INSERT INTO hr_work_schedules (company_id, employee_id, shift_id, off_days, is_active)
         VALUES (:companyId, :employee_id, :shift_id, :off_days, 1)
         ON DUPLICATE KEY UPDATE shift_id = VALUES(shift_id), off_days = VALUES(off_days), is_active = VALUES(is_active)`,
        {
          companyId,
          employee_id,
          shift_id: shift_id || null,
          off_days: JSON.stringify(off_days || []),
        },
      );
      res.json({ message: "Work schedule saved" });
    }
  } catch (err) {
    next(err);
  }
}

// ============================================================
//  LEAVE MANAGEMENT ERP – Enterprise Leave System
//  Priority: APPLICATION > SCHEDULE > ROSTER
// ============================================================

async function ensureLeaveTables() {
  if (process.env.SKIP_DYNAMIC_SCHEMA_SYNC === "true") return;
  // Leave Types (e.g. Annual, Sick, Maternity)
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_types (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      type_name       VARCHAR(100) NOT NULL,
      max_days        INT DEFAULT 0,
      is_paid         TINYINT(1) DEFAULT 1,
      is_active       TINYINT(1) DEFAULT 1,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_type (company_id, type_name)
    )`,
    {},
  );
  try {
    const hasIsActive = await hasColumn("hr_leave_types", "is_active");
    if (!hasIsActive) {
      await query(
        "ALTER TABLE hr_leave_types ADD COLUMN is_active TINYINT(1) DEFAULT 1 AFTER is_paid",
        {},
      );
    }
    const hasMaxDays = await hasColumn("hr_leave_types", "max_days");
    if (!hasMaxDays) {
      await query(
        "ALTER TABLE hr_leave_types ADD COLUMN max_days INT DEFAULT 0 AFTER type_name",
        {},
      );
    }
  } catch {}

  // Leave Records – master audit log
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_records (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      employee_id     INT NOT NULL,
      leave_type_id   INT,
      start_date      DATE NOT NULL,
      end_date        DATE NOT NULL,
      total_days      DECIMAL(5,1) DEFAULT 0,
      source          ENUM('APPLICATION','SCHEDULE','ROSTER') NOT NULL DEFAULT 'APPLICATION',
      status          ENUM('ACTIVE','OVERRIDDEN','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
      reason          TEXT,
      remarks         TEXT,
      created_by      INT,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_emp_dates (employee_id, start_date, end_date),
      INDEX idx_company_status (company_id, status),
      INDEX idx_source (source)
    )`,
    {},
  );

  // Leave Balances – allocation per employee per year per leave type
  await query(
    `CREATE TABLE IF NOT EXISTS hr_leave_balances (
      id              INT AUTO_INCREMENT PRIMARY KEY,
      company_id      INT NOT NULL,
      employee_id     INT NOT NULL,
      leave_type_id   INT NOT NULL,
      year            INT NOT NULL,
      allocated_days  DECIMAL(5,1) DEFAULT 0,
      created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_emp_type_year (company_id, employee_id, leave_type_id, year)
    )`,
    {},
  );
}

// ── Leave Types ──────────────────────────────────────────────
export async function listLeaveTypes(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT * FROM hr_leave_types
         WHERE company_id = :companyId ORDER BY type_name ASC`,
      { companyId },
    );
    console.log("LEAVE TYPES:", items);
    res.json({ items });
  } catch (err) {
    console.error(err);
    next(err);
  }
}

export async function getLeaveType(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT * FROM hr_leave_types
         WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Leave type not found");
    res.json({ item: rows[0] });
  } catch (err) {
    next(err);
  }
}

export async function saveLeaveType(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const { id, type_name, max_days, is_paid, is_active } = req.body;
    if (id) {
      await query(
        `UPDATE hr_leave_types SET type_name=:type_name, max_days=:max_days, is_paid=:is_paid, is_active=:is_active
         WHERE id=:id AND company_id=:companyId`,
        {
          id,
          type_name,
          max_days: toNumber(max_days, 0),
          is_paid: is_paid ? 1 : 0,
          is_active: is_active ? 1 : 0,
          companyId,
        },
      );
      res.json({ message: "Leave type updated" });
    } else {
      const r = await query(
        `INSERT INTO hr_leave_types (company_id, type_name, max_days, is_paid, is_active)
         VALUES (:companyId, :type_name, :max_days, :is_paid, 1)`,
        {
          companyId,
          type_name,
          max_days: toNumber(max_days, 0),
          is_paid: is_paid !== false ? 1 : 0,
        },
      );
      res.status(201).json({ id: r.insertId, message: "Leave type created" });
    }
  } catch (err) {
    next(err);
  }
}

// ── Dashboard ────────────────────────────────────────────────
export async function getLeaveDashboard(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const today = new Date().toISOString().slice(0, 10);
    const currentYear = new Date().getFullYear();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const futureIso = futureDate.toISOString().slice(0, 10);

    const [onLeaveRows, upcomingRows, totalRows] = await Promise.all([
      query(
        `SELECT COUNT(DISTINCT employee_id) AS cnt,
          created_at FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND start_date <= :today AND end_date >= :today`,
        { companyId, today },
      ),
      query(
        `SELECT COUNT(DISTINCT employee_id) AS cnt,
          created_at FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND start_date > :today AND start_date <= :futureIso`,
        { companyId, today, futureIso },
      ),
      query(
        `SELECT COALESCE(SUM(total_days), 0) AS total,
          created_at FROM hr_leave_records
         WHERE company_id = :companyId AND status = 'ACTIVE'
           AND YEAR(start_date) = :currentYear`,
        { companyId, currentYear },
      ),
    ]);

    res.json({
      onLeaveToday: Number(onLeaveRows[0]?.cnt || 0),
      upcomingLeave: Number(upcomingRows[0]?.cnt || 0),
      totalUsedThisYear: Number(totalRows[0]?.total || 0),
    });
  } catch (err) {
    next(err);
  }
}

// ── Apply Leave (APPLICATION – highest priority) ─────────────
export async function applyLeave(req, res, next) {
  const conn = await pool.getConnection();
  try {
    await ensureLeaveTables();
    await conn.beginTransaction();
    const { companyId = null } = req.scope || {};
    const { employee_id, leave_type_id, start_date, end_date, reason } =
      req.body;

    if (!employee_id || !leave_type_id || !start_date || !end_date) {
      throw httpError(
        400,
        "VALIDATION",
        "employee_id, leave_type_id, start_date and end_date are required",
      );
    }

    const totalDays =
      (new Date(end_date).getTime() - new Date(start_date).getTime()) /
        (1000 * 3600 * 24) +
      1;

    // Mark overlapping ACTIVE records as OVERRIDDEN
    await conn.query(
      `UPDATE hr_leave_records
       SET status = 'OVERRIDDEN', updated_at = NOW()
       WHERE company_id = ? AND employee_id = ? AND status = 'ACTIVE'
         AND source IN ('SCHEDULE','ROSTER')
         AND start_date <= ? AND end_date >= ?`,
      [companyId, employee_id, end_date, start_date],
    );

    // Insert new APPLICATION record
    const [result] = await conn.query(
      `INSERT INTO hr_leave_records
         (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'APPLICATION', 'ACTIVE', ?, ?)`,
      [
        companyId,
        employee_id,
        leave_type_id,
        start_date,
        end_date,
        totalDays,
        reason || null,
        req.user?.id || null,
      ],
    );

    await conn.commit();

    // Email HR notification (fire-and-forget)
    try {
      const [empRow] = await conn.query(
        `SELECT e.first_name, e.last_name, e.emp_code, lt.type_name,
          e.created_at FROM hr_employees e
         LEFT JOIN hr_leave_types lt ON lt.id = ?
         WHERE e.id = ? LIMIT 1`,
        [leave_type_id, employee_id],
      );
      const emp = empRow;
      if (emp) {
        sendMail({
          to: "hr@company.com",
          subject: `Leave Application – ${emp.first_name} ${emp.last_name} (${emp.emp_code})`,
          html: `<p><strong>${emp.first_name} ${emp.last_name}</strong> has applied for <strong>${emp.type_name}</strong> leave from <strong>${start_date}</strong> to <strong>${end_date}</strong> (${totalDays} day(s)).</p>${reason ? `<p>Reason: ${reason}</p>` : ""}`,
        }).catch(() => {});
      }
    } catch {}

    res.status(201).json({
      id: result.insertId,
      message: "Leave application submitted",
      totalDays,
    });
  } catch (err) {
    await conn.rollback();
    next(err);
  } finally {
    conn.release();
  }
}

// ── Schedule Leave (HR assigns, SCHEDULE priority) ───────────
export async function scheduleLeave(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const { employee_ids, leave_type_id, start_date, end_date, remarks } =
      req.body;

    if (!Array.isArray(employee_ids) || !employee_ids.length) {
      throw httpError(
        400,
        "VALIDATION",
        "employee_ids must be a non-empty array",
      );
    }
    if (!leave_type_id || !start_date || !end_date) {
      throw httpError(
        400,
        "VALIDATION",
        "leave_type_id, start_date and end_date are required",
      );
    }

    const totalDays =
      (new Date(end_date).getTime() - new Date(start_date).getTime()) /
        (1000 * 3600 * 24) +
      1;

    let scheduled = 0;
    const employeeDetails = [];

    for (const empId of employee_ids) {
      // Skip if APPLICATION already covers this period (APPLICATION wins)
      const existing = await query(
        `SELECT id,
          created_at FROM hr_leave_records
         WHERE company_id = :companyId AND employee_id = :empId
           AND status = 'ACTIVE' AND source = 'APPLICATION'
           AND start_date <= :end_date AND end_date >= :start_date
         LIMIT 1`,
        { companyId, empId, start_date, end_date },
      );
      if (existing.length) continue; // APPLICATION has priority, skip

      await query(
        `INSERT INTO hr_leave_records
           (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, remarks, created_by)
         VALUES (:companyId, :empId, :leave_type_id, :start_date, :end_date, :totalDays, 'SCHEDULE', 'ACTIVE', :remarks, :createdBy)`,
        {
          companyId,
          empId,
          leave_type_id,
          start_date,
          end_date,
          totalDays,
          remarks: remarks || null,
          createdBy: req.user?.id || null,
        },
      );
      scheduled++;
      employeeDetails.push(empId);
    }

    // Notify employees (fire-and-forget)
    try {
      const empRows = await query(
        `SELECT e.first_name, e.last_name, e.email, lt.type_name,
          e.created_at FROM hr_employees e
         LEFT JOIN hr_leave_types lt ON lt.id = :leave_type_id
         WHERE e.id IN (${employeeDetails.map(() => "?").join(",")}) AND e.email IS NOT NULL`,
        {
          leave_type_id,
          ...Object.fromEntries(employeeDetails.map((id, i) => [i, id])),
        },
      );
      for (const emp of empRows || []) {
        if (emp.email) {
          sendMail({
            to: emp.email,
            subject: `Leave Scheduled: ${emp.type_name} (${start_date} – ${end_date})`,
            html: `<p>Dear ${emp.first_name},</p><p>HR has scheduled <strong>${emp.type_name}</strong> leave for you from <strong>${start_date}</strong> to <strong>${end_date}</strong> (${totalDays} day(s)).</p>`,
          }).catch(() => {});
        }
      }
    } catch {}

    res.json({ scheduled, message: `${scheduled} leave record(s) scheduled` });
  } catch (err) {
    next(err);
  }
}

// ── Roster Leave (annual plan, lowest priority) ───────────────
export async function saveLeaveRoster(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const { year, items } = req.body;

    if (!Array.isArray(items) || !items.length) {
      throw httpError(400, "VALIDATION", "items must be a non-empty array");
    }

    let rostered = 0;
    for (const item of items) {
      const { employee_id, leave_type_id, start_date, end_date } = item;
      if (!employee_id || !start_date || !end_date) continue;

      const totalDays =
        (new Date(end_date).getTime() - new Date(start_date).getTime()) /
          (1000 * 3600 * 24) +
        1;

      // Only insert if no APPLICATION or SCHEDULE covering same period
      const existing = await query(
        `SELECT id,
          created_at FROM hr_leave_records
         WHERE company_id = :companyId AND employee_id = :employee_id
           AND status = 'ACTIVE' AND source IN ('APPLICATION','SCHEDULE')
           AND start_date <= :end_date AND end_date >= :start_date
         LIMIT 1`,
        { companyId, employee_id, start_date, end_date },
      );
      if (existing.length) continue;

      await query(
        `INSERT INTO hr_leave_records
           (company_id, employee_id, leave_type_id, start_date, end_date, total_days, source, status, remarks, created_by)
         VALUES (:companyId, :employee_id, :leave_type_id, :start_date, :end_date, :totalDays, 'ROSTER', 'ACTIVE', :remarks, :createdBy)`,
        {
          companyId,
          employee_id,
          leave_type_id: leave_type_id || null,
          start_date,
          end_date,
          totalDays,
          remarks: year ? `Roster ${year}` : null,
          createdBy: req.user?.id || null,
        },
      );
      rostered++;
    }

    res.json({ rostered, message: `${rostered} roster record(s) saved` });
  } catch (err) {
    next(err);
  }
}

// ── List Leave Records (full audit trail) ────────────────────
export async function listLeaveRecords(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { employee_id, source, status, start_date, end_date, dept_id, q } =
      req.query;

    const clauses = [
      "lr.company_id = :companyId",
      "(:branchIdsStr = '' OR FIND_IN_SET(lr.branch_id, :branchIdsStr))",
    ];
    const params = { companyId, branchId, branchIdsStr };

    if (employee_id) {
      clauses.push("lr.employee_id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }
    if (source && source !== "ALL") {
      clauses.push("lr.source = :source");
      params.source = source;
    }
    if (status && status !== "ALL") {
      clauses.push("lr.status = :status");
      params.status = status;
    }
    if (start_date) {
      clauses.push("lr.end_date >= :start_date");
      params.start_date = start_date;
    }
    if (end_date) {
      clauses.push("lr.start_date <= :end_date");
      params.end_date = end_date;
    }
    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = toNumber(dept_id, null);
    }
    if (q) {
      clauses.push(
        "(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)",
      );
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const items = await query(
      `SELECT lr.id, lr.employee_id, lr.leave_type_id, lr.start_date, lr.end_date, lr.total_days,
              lr.source, lr.status, lr.reason, lr.remarks, lr.created_at, lr.updated_at,
              e.first_name, e.last_name, e.emp_code,
              d.dept_name,
              lt.type_name,
          lr.created_at FROM hr_leave_records lr
       JOIN hr_employees e ON e.id = lr.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
       ${where}
         ORDER BY lr.created_at DESC`,
      params,
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

// ── Delete Leave Record ──────────────────────────────────────
export async function deleteLeaveRecord(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(
      `SELECT id,
          created_at FROM hr_leave_records
         WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Record not found");
    await query(`DELETE FROM hr_leave_records WHERE id = :id`, { id });
    res.json({ message: "Leave record deleted" });
  } catch (err) {
    next(err);
  }
}

// ── Update Leave Record ──────────────────────────────────────
export async function updateLeave(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const { start_date, end_date, status, remarks, leave_type_id } = req.body;

    const rows = await query(
      `SELECT id,
          created_at FROM hr_leave_records
         WHERE id = :id AND company_id = :companyId LIMIT 1`,
      { id, companyId },
    );
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Record not found");

    let totalDays = null;
    if (start_date && end_date) {
      totalDays =
        (new Date(end_date).getTime() - new Date(start_date).getTime()) /
          (1000 * 3600 * 24) +
        1;
    }

    await query(
      `UPDATE hr_leave_records
       SET start_date   = COALESCE(:start_date, start_date),
           end_date     = COALESCE(:end_date, end_date),
           total_days   = COALESCE(:total_days, total_days),
           status       = COALESCE(:status, status),
           remarks      = COALESCE(:remarks, remarks),
           leave_type_id = COALESCE(:leave_type_id, leave_type_id)
       WHERE id = :id`,
      {
        id,
        start_date: start_date || null,
        end_date: end_date || null,
        total_days: totalDays,
        status: status || null,
        remarks: remarks || null,
        leave_type_id: leave_type_id || null,
      },
    );
    res.json({ message: "Leave record updated" });
  } catch (err) {
    next(err);
  }
}

// ── Leave Calendar (ACTIVE only, color by source) ────────────
export async function leaveCalendar(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const { year, month } = req.query;

    const clauses = ["lr.company_id = :companyId", "lr.status = 'ACTIVE'"];
    const params = { companyId };

    if (year && month) {
      // Get records that overlap the given month
      const firstDay = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(Number(year), Number(month), 0)
        .toISOString()
        .slice(0, 10); // last day of month
      clauses.push("lr.start_date <= :lastDay AND lr.end_date >= :firstDay");
      params.firstDay = firstDay;
      params.lastDay = lastDay;
    } else if (year) {
      clauses.push("YEAR(lr.start_date) = :year");
      params.year = year;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const events = await query(
      `SELECT lr.id, lr.employee_id, lr.start_date, lr.end_date, lr.total_days, lr.source, lr.status,
              e.first_name, e.last_name, e.emp_code,
              lt.type_name,
          lr.created_at FROM hr_leave_records lr
       JOIN hr_employees e ON e.id = lr.employee_id AND e.deleted_at IS NULL
       LEFT JOIN hr_leave_types lt ON lt.id = lr.leave_type_id
       ${where}
         ORDER BY lr.start_date ASC`,
      params,
    );

    res.json({ events });
  } catch (err) {
    next(err);
  }
}

// ── Leave Balances (dynamic: allocated vs used) ──────────────
export async function listLeaveBalances(req, res, next) {
  try {
    await ensureLeaveTables();
    const { companyId = null } = req.scope || {};
    const { year, dept_id, employee_id } = req.query;
    const currentYear = year ? Number(year) : new Date().getFullYear();

    const clauses = [
      "e.company_id = :companyId",
      "e.deleted_at IS NULL",
      "e.status = 'ACTIVE'",
    ];
    const params = { companyId, currentYear };

    if (dept_id && dept_id !== "ALL") {
      clauses.push("e.dept_id = :dept_id");
      params.dept_id = toNumber(dept_id, null);
    }
    if (employee_id) {
      clauses.push("e.id = :employee_id");
      params.employee_id = toNumber(employee_id, null);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;

    const items = await query(
      `SELECT
         e.id AS employee_id,
         e.emp_code,
         e.first_name,
         e.last_name,
         d.dept_name,
         lt.id AS leave_type_id,
         lt.type_name,
         COALESCE(lb.allocated_days, lt.max_days, 0)    AS allocated_days,
         COALESCE(SUM(CASE WHEN lr.status = 'ACTIVE' AND YEAR(lr.start_date) = :currentYear THEN lr.total_days ELSE 0 END), 0) AS used_days,
          e.created_at FROM hr_employees e
       LEFT JOIN hr_departments d ON d.id = e.dept_id
       CROSS JOIN hr_leave_types lt ON lt.company_id = :companyId AND lt.is_active = 1
       LEFT JOIN hr_leave_balances lb
         ON lb.employee_id = e.id AND lb.leave_type_id = lt.id AND lb.year = :currentYear AND lb.company_id = :companyId
       LEFT JOIN hr_leave_records lr
         ON lr.employee_id = e.id AND lr.leave_type_id = lt.id AND lr.company_id = :companyId
       ${where}
         GROUP BY e.id, lt.id, lb.allocated_days, lt.max_days
       ORDER BY e.first_name ASC, lt.type_name ASC`,
      params,
    );

    res.json({ items, year: currentYear });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────
// ── Tax Reliefs & Employee Tax Deductions ────────────────────
// ─────────────────────────────────────────────────────────────

export async function listTaxReliefTypes(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const items = await query(
      `SELECT * FROM hr_tax_relief_types WHERE (company_id = :companyId OR company_id = 1) AND is_active = 1 ORDER BY id ASC`,
      { companyId }
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveTaxReliefType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      code,
      name,
      description,
      max_annual_amount,
      max_monthly_amount,
      requires_approval,
      is_active,
    } = req.body;

    if (!name) throw httpError(400, "BAD_REQUEST", "Relief name is required");
    const mAmount = Number(
      max_monthly_amount || (max_annual_amount ? Number(max_annual_amount) / 12 : 0)
    );
    const aAmount = Number(max_annual_amount || mAmount * 12);

    if (id) {
      await query(
        `UPDATE hr_tax_relief_types
            SET code = COALESCE(:code, code), name = :name, description = :description,
                max_annual_amount = :aAmount, max_monthly_amount = :mAmount,
                requires_approval = :requires_approval, is_active = :is_active
          WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          code: code || null,
          name,
          description: description || null,
          aAmount,
          mAmount,
          requires_approval: requires_approval ? 1 : 0,
          is_active: is_active !== false ? 1 : 0,
        }
      );
      res.json({ message: "Tax relief type updated" });
    } else {
      const result = await query(
        `INSERT INTO hr_tax_relief_types
           (company_id, code, name, description, max_annual_amount, max_monthly_amount, requires_approval, is_active, created_by)
         VALUES
           (:companyId, :code, :name, :description, :aAmount, :mAmount, :requires_approval, 1, :userId)`,
        {
          companyId,
          code: code || `RELIEF_${Date.now()}`,
          name,
          description: description || null,
          aAmount,
          mAmount,
          requires_approval: requires_approval ? 1 : 0,
          userId,
        }
      );
      res.status(201).json({ id: result.insertId, message: "Tax relief type created" });
    }
  } catch (err) {
    next(err);
  }
}

export async function deleteTaxReliefType(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const { id } = req.params;
    await query(
      `UPDATE hr_tax_relief_types SET is_active = 0 WHERE id = :id AND (company_id = :companyId OR company_id = 1)`,
      { id, companyId }
    );
    res.json({ message: "Tax relief type deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function listEmployeeTaxReliefs(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1, branchId = null, branchIdsStr = "" } = req.scope || {};
    const { employee_id, status, q } = req.query;

    const clauses = [
      "r.company_id = :companyId",
      "(:branchIdsStr = '' OR FIND_IN_SET(e.branch_id, :branchIdsStr))"
    ];
    const params = { companyId, branchId, branchIdsStr };

    if (employee_id) {
      clauses.push("r.employee_id = :employee_id");
      params.employee_id = employee_id;
    }
    if (status) {
      clauses.push("r.status = :status");
      params.status = status;
    }
    if (q) {
      clauses.push("(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q OR r.relief_name LIKE :q)");
      params.q = `%${q}%`;
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
    const items = await query(
      `SELECT r.*,
              e.emp_code, e.first_name, e.last_name, e.base_salary,
              t.name AS type_name, t.code AS type_code,
              COALESCE(u.full_name, u.username) AS approved_by_name
         FROM hr_employee_tax_reliefs r
         JOIN hr_employees e ON e.id = r.employee_id
         LEFT JOIN hr_tax_relief_types t ON t.id = r.relief_type_id
         LEFT JOIN adm_users u ON u.id = r.approved_by
         ${where}
        ORDER BY r.created_at DESC`,
      params
    );

    res.json({ items });
  } catch (err) {
    next(err);
  }
}

export async function saveEmployeeTaxRelief(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const userId = toNumber(req.user?.id || req.user?.sub, null);
    const {
      id,
      employee_id,
      relief_type_id,
      relief_name,
      monthly_amount,
      annual_amount,
      start_date,
      end_date,
      certificate_number,
      description,
      attachment_url,
      status,
    } = req.body;

    let targetEmpId = toNumber(employee_id, null);
    if (!targetEmpId && userId) {
      const myEmp = await query(
        `SELECT id FROM hr_employees WHERE user_id = :userId AND company_id = :companyId AND status = 'ACTIVE' LIMIT 1`,
        { userId, companyId }
      );
      if (myEmp.length) targetEmpId = myEmp[0].id;
    }
    if (!targetEmpId) throw httpError(400, "BAD_REQUEST", "Employee is required");

    let mAmount = Number(monthly_amount || 0);
    let aAmount = Number(annual_amount || 0);
    if (mAmount > 0 && aAmount <= 0) {
      aAmount = Math.round(mAmount * 12 * 100) / 100;
    } else if (aAmount > 0 && mAmount <= 0) {
      mAmount = Math.round((aAmount / 12) * 100) / 100;
    }
    if (mAmount <= 0) throw httpError(400, "BAD_REQUEST", "Valid tax relief amount is required");

    let finalName = relief_name ? String(relief_name).trim() : "";
    if (!finalName && relief_type_id) {
      const typeRow = await query(
        `SELECT name FROM hr_tax_relief_types WHERE id = :relief_type_id LIMIT 1`,
        { relief_type_id }
      );
      if (typeRow.length) finalName = typeRow[0].name;
    }
    if (!finalName) finalName = "Tax Relief";

    const sDate = start_date ? String(start_date).slice(0, 10) : new Date().toISOString().slice(0, 10);
    const eDate = end_date ? String(end_date).slice(0, 10) : null;

    if (id) {
      await query(
        `UPDATE hr_employee_tax_reliefs
            SET relief_type_id = :relief_type_id,
                relief_name = :finalName,
                monthly_amount = :mAmount,
                annual_amount = :aAmount,
                start_date = :sDate,
                end_date = :eDate,
                certificate_number = :certificate_number,
                description = :description,
                attachment_url = :attachment_url,
                status = COALESCE(:status, status),
                updated_at = NOW()
          WHERE id = :id AND company_id = :companyId`,
        {
          id,
          companyId,
          relief_type_id: relief_type_id ? Number(relief_type_id) : null,
          finalName,
          mAmount,
          aAmount,
          sDate,
          eDate,
          certificate_number: certificate_number || null,
          description: description || null,
          attachment_url: attachment_url || null,
          status: status || null,
        }
      );
      res.json({ message: "Tax relief updated successfully" });
    } else {
      const initialStatus = status || "ACTIVE";
      const result = await query(
        `INSERT INTO hr_employee_tax_reliefs
           (company_id, employee_id, relief_type_id, relief_name, monthly_amount, annual_amount,
            start_date, end_date, certificate_number, description, attachment_url, status, created_by)
         VALUES
           (:companyId, :targetEmpId, :relief_type_id, :finalName, :mAmount, :aAmount,
            :sDate, :eDate, :certificate_number, :description, :attachment_url, :initialStatus, :userId)`,
        {
          companyId,
          targetEmpId,
          relief_type_id: relief_type_id ? Number(relief_type_id) : null,
          finalName,
          mAmount,
          aAmount,
          sDate,
          eDate,
          certificate_number: certificate_number || null,
          description: description || null,
          attachment_url: attachment_url || null,
          initialStatus,
          userId,
        }
      );
      res.status(201).json({ id: result.insertId, message: "Tax relief submitted successfully" });
    }
  } catch (err) {
    next(err);
  }
}

export async function updateTaxReliefStatus(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const { id } = req.params;
    const { status, rejection_reason } = req.body;
    const userId = toNumber(req.user?.id || req.user?.sub, null);

    if (!["APPROVED", "ACTIVE", "REJECTED", "INACTIVE", "PENDING"].includes(status)) {
      throw httpError(400, "BAD_REQUEST", "Invalid status");
    }

    await query(
      `UPDATE hr_employee_tax_reliefs
          SET status = :status,
              approved_by = :userId,
              approved_at = NOW(),
              rejection_reason = :rejection_reason,
              updated_at = NOW()
        WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        status,
        userId,
        rejection_reason: rejection_reason || null,
      }
    );

    res.json({ message: `Tax relief ${status.toLowerCase()} successfully` });
  } catch (err) {
    next(err);
  }
}

export async function deleteEmployeeTaxRelief(req, res, next) {
  try {
    await ensureHRTables();
    const { companyId = 1 } = req.scope || {};
    const { id } = req.params;

    await query(
      `DELETE FROM hr_employee_tax_reliefs WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );

    res.json({ message: "Tax relief deleted successfully" });
  } catch (err) {
    next(err);
  }
}

export async function sendPromotionLetter(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const promoId = req.params.id;

    const [promo] = await query(
      `SELECT pr.*, e.id AS employee_id, e.first_name, e.last_name, e.email, e.emp_code,
              p1.pos_name AS prev_pos_name,
              p2.pos_name AS new_pos_name,
              d1.dept_name AS prev_dept_name,
              d2.dept_name AS new_dept_name,
              c.name AS company_name
       FROM hr_promotions pr
       JOIN hr_employees e ON e.id = pr.employee_id
       LEFT JOIN hr_positions p1 ON p1.id = pr.previous_pos_id
       LEFT JOIN hr_positions p2 ON p2.id = pr.new_pos_id
       LEFT JOIN hr_departments d1 ON d1.id = pr.previous_dept_id
       LEFT JOIN hr_departments d2 ON d2.id = pr.new_dept_id
       LEFT JOIN adm_companies c ON c.id = pr.company_id
       WHERE pr.id = :promoId AND (:companyId IS NULL OR pr.company_id = :companyId)`,
      { promoId, companyId }
    );

    if (!promo) {
      throw httpError(404, "NOT_FOUND", "Promotion record not found");
    }
    const empEmail = String(promo.email || "").trim();
    if (!empEmail) {
      throw httpError(400, "BAD_REQUEST", "Employee has no email address configured in their staff profile");
    }

    const actionUpper = String(promo.action_type || "").toUpperCase();
    const isReassignment = actionUpper === "REASSIGNMENT" || actionUpper === "DEMOTION";
    const isDemotion = isReassignment;
    const isTransfer = String(promo.action_type || "").toUpperCase() === "TRANSFER";
    const companyName = promo.company_name || "OmniSuite";
    const empFullName = `${promo.first_name || ""} ${promo.last_name || ""}`.trim() || "Staff Member";
    const prevRole = promo.prev_pos_name || "Previous Position";
    const newRole = promo.new_pos_name || "New Position";
    const effDate = promo.promotion_date
      ? new Date(promo.promotion_date).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        });

    const paramKeys = isReassignment
      ? ["reassignment_letter_subject", "reassignment_letter_template", "demotion_letter_subject", "demotion_letter_template"]
      : ["promotion_letter_subject", "promotion_letter_template"];

    const customParams = await query(
      `SELECT param_key, param_value FROM hr_setup_parameters 
       WHERE (company_id = :companyId OR company_id = 1) AND param_key IN (:paramKeys)`,
      { companyId, paramKeys }
    ).catch(() => []);
    const paramMap = new Map((customParams || []).map(p => [p.param_key, p.param_value]));

    const customSub = isReassignment
      ? (paramMap.get("reassignment_letter_subject") || paramMap.get("demotion_letter_subject"))
      : paramMap.get("promotion_letter_subject");
    const customBody = isReassignment
      ? (paramMap.get("reassignment_letter_template") || paramMap.get("demotion_letter_template"))
      : paramMap.get("promotion_letter_template");

    const renderPlaceholders = (text) => {
      if (!text) return "";
      return text
        .replace(/\{\{employee_name\}\}/g, empFullName)
        .replace(/\{\{previous_position\}\}/g, prevRole)
        .replace(/\{\{new_position\}\}/g, newRole)
        .replace(/\{\{effective_date\}\}/g, effDate)
        .replace(/\{\{new_salary\}\}/g, promo.new_salary ? `GHS ${Number(promo.new_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "")
        .replace(/\{\{company_name\}\}/g, companyName)
        .replace(/\{\{remarks\}\}/g, promo.remarks || "");
    };

    const defaultSubject = isReassignment
      ? `Official Notice: Role Reassignment to ${newRole} - ${companyName}`
      : isTransfer
        ? `Official Notice: Transfer to ${newRole} - ${companyName}`
        : `Congratulations on Your Promotion to ${newRole} - ${companyName}`;

    const letterSubject = customSub ? renderPlaceholders(customSub) : defaultSubject;

    let letterHtml = "";
    if (customBody) {
      letterHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; color: #1e293b; line-height: 1.7;">
          ${renderPlaceholders(customBody).replace(/\n/g, "<br />")}
        </div>
      `;
    } else {
      const headerBg = isReassignment
        ? "linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)"
        : isTransfer
          ? "linear-gradient(135deg, #1e293b 0%, #334155 100%)"
          : "linear-gradient(135deg, #065f46 0%, #047857 100%)";

      const badgeText = isReassignment
        ? "OFFICIAL ROLE REASSIGNMENT NOTICE"
        : isTransfer
          ? "LATERAL TRANSFER NOTICE"
          : "OFFICIAL PROMOTION LETTER";

      const introParagraph = isDemotion
        ? `This official letter serves to formally notify you that following recent internal reviews and administrative assessments, your employment role within <strong>${companyName}</strong> has been reassigned to <strong>${newRole}</strong> (transitioning from your previous role of <em>${prevRole}</em>), effective <strong>${effDate}</strong>.`
        : isTransfer
          ? `We write to inform you that your role at <strong>${companyName}</strong> has been realigned to <strong>${newRole}</strong> (transitioning from <em>${prevRole}</em>), effective <strong>${effDate}</strong>.`
          : `On behalf of executive management and the entire team at <strong>${companyName}</strong>, we are delighted to officially congratulate you on your promotion to the position of <strong>${newRole}</strong>, moving upward from your previous role of <em>${prevRole}</em>, effective <strong>${effDate}</strong>!`;

      const remarksBlock = promo.remarks
        ? `<div style="background: #f8fafc; border-left: 4px solid ${isDemotion ? '#ef4444' : '#10b981'}; padding: 12px 16px; margin: 20px 0; font-size: 14px; color: #334155;"><strong>Administrative Notes / Remarks:</strong><br />${promo.remarks}</div>`
        : "";

      letterHtml = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <div style="background: ${headerBg}; padding: 32px 28px; text-align: center; color: #ffffff;">
            <span style="display: inline-block; background: rgba(255, 255, 255, 0.2); font-size: 11px; font-weight: 700; letter-spacing: 1px; padding: 4px 12px; border-radius: 9999px; margin-bottom: 12px;">
              ${badgeText}
            </span>
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px;">${companyName}</h1>
            <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">Human Resources & Talent Management</p>
          </div>
          <div style="padding: 32px 28px; color: #1e293b; line-height: 1.65;">
            <p style="font-size: 15px; margin-top: 0;">Dear <strong>${empFullName}</strong> (Staff ID: <code>${promo.emp_code || "N/A"}</code>),</p>
            <p style="font-size: 14px; color: #334155;">${introParagraph}</p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 18px; margin: 22px 0;">
              <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; margin-bottom: 12px;">
                Summary of Assignment
              </div>
              <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 6px 0; color: #64748b; width: 140px;">Action Type:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: ${isReassignment ? '#1d4ed8' : '#047857'};">${isReassignment ? 'ROLE REASSIGNMENT' : (promo.action_type || "PROMOTION")}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Previous Position:</td>
                  <td style="padding: 6px 0; font-weight: 500; color: #475569;">${prevRole}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Assigned Position:</td>
                  <td style="padding: 6px 0; font-weight: 700; color: #0f172a;">${newRole}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">Effective Date:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">${effDate}</td>
                </tr>
                ${!isReassignment && promo.new_salary ? `
                <tr>
                  <td style="padding: 6px 0; color: #64748b;">New Base Salary:</td>
                  <td style="padding: 6px 0; font-weight: 600; color: #0f172a;">GHS ${Number(promo.new_salary).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>` : ""}
              </table>
            </div>
            ${remarksBlock}
            <p style="font-size: 14px; color: #334155; margin-bottom: 24px;">
              ${
                isDemotion
                  ? "Your supervisor will meet with you to review your updated duties, expectations, and reporting alignment. Please feel free to reach out to the HR department if you have any questions."
                  : "We appreciate your continued commitment to our organizational goals and look forward to your impactful contributions in your new role."
              }
            </p>
            <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 13px; color: #64748b;">
              <p style="margin: 0; font-weight: 600; color: #0f172a;">Human Resources Department</p>
              <p style="margin: 4px 0 0; color: #64748b;">${companyName}</p>
            </div>
          </div>
        </div>
      `;
    }

    await sendMail({
      to: empEmail,
      subject: letterSubject,
      html: letterHtml,
    });

    res.json({ message: `${isReassignment ? "Reassignment" : "Promotion"} letter sent successfully to ${empEmail}` });
  } catch (err) {
    next(err);
  }
}


/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PAYROLL APPROVAL WORKFLOW CONTROLLERS
 * ─────────────────────────────────────────────────────────────────────────────
 */

export async function submitPayrollForApproval(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || 1;
    const { period_id, workflow_id, target_user_id, comments } = req.body || {};

    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");

    const payrollRows = await query(
      `SELECT * FROM hr_payroll WHERE period_id = :period_id AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
      { period_id, companyId }
    );
    if (!payrollRows || !payrollRows.length) {
      throw httpError(404, "NOT_FOUND", "No payroll record found for this period. Generate payroll first.");
    }
    const payroll = payrollRows[0];

    // Calculate total net amount
    const sumRows = await query(
      `SELECT COALESCE(SUM(net_salary), 0) AS total_net FROM hr_payroll_items WHERE payroll_id = :id`,
      { id: payroll.id }
    ).catch(() => [{ total_net: 0 }]);
    const totalNet = Number(sumRows?.[0]?.total_net || 0);

    // Look for active workflow
    let chosenWorkflow = null;
    if (workflow_id) {
      const wfRows = await query(
        "SELECT * FROM adm_workflows WHERE id = :id AND company_id = :companyId AND is_active = 1",
        { id: workflow_id, companyId }
      );
      if (wfRows && wfRows.length) chosenWorkflow = wfRows[0];
    }
    if (!chosenWorkflow) {
      const allWfs = await query(
        "SELECT * FROM adm_workflows WHERE company_id = :companyId AND is_active = 1",
        { companyId }
      );
      const synonyms = ["PAYROLL", "SALARY_PROCESSING", "HR_PAYROLL", "Payroll", "Salary Processing"];
      const normalize = (s) => String(s || "").trim().toUpperCase().replace(/\s+/g, "_");
      chosenWorkflow = allWfs.find(
        (w) => String(w.document_route || "") === "/human-resources/payroll/salary-processing" ||
               synonyms.some((syn) => normalize(w.document_type) === normalize(syn))
      ) || null;
    }

    if (chosenWorkflow) {
      const steps = await query(
        "SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1",
        { wf: chosenWorkflow.id }
      );
      if (!steps || !steps.length) {
        throw httpError(400, "BAD_REQUEST", "Workflow has no steps configured");
      }
      const firstStep = steps[0];
      const allowedUsers = await query(
        "SELECT approver_user_id FROM adm_workflow_step_approvers WHERE workflow_id = :wf AND step_order = :ord",
        { wf: chosenWorkflow.id, ord: firstStep.step_order }
      );
      const allowedSet = new Set(allowedUsers.map((r) => Number(r.approver_user_id)));
      let assignedUserId = Number(firstStep.approver_user_id);
      if (target_user_id) {
        assignedUserId = Number(target_user_id);
      } else if (allowedUsers.length > 0) {
        assignedUserId = Number(allowedUsers[0].approver_user_id);
      }

      const uRows = await query("SELECT username FROM adm_users WHERE id = :id", { id: assignedUserId });
      const approverName = uRows.length ? uRows[0].username : "Approver";

      const dwRes = await query(
        `INSERT INTO adm_document_workflows 
           (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :wfId, :docId, 'PAYROLL', :amount, :step, 'PENDING', :assignedTo)`,
        {
          companyId,
          wfId: chosenWorkflow.id,
          docId: payroll.id,
          amount: totalNet,
          step: firstStep.step_order,
          assignedTo: assignedUserId
        }
      );

      await query(
        `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES (:dwId, :step, 'SUBMIT', :userId, :comments)`,
        {
          dwId: dwRes.insertId,
          step: firstStep.step_order,
          userId,
          comments: comments || "Salary processing forwarded for approval"
        }
      );

      await query(
        `UPDATE hr_payroll SET status = 'PENDING_APPROVAL', forwarded_to_username = :approverName WHERE id = :id`,
        { approverName, id: payroll.id }
      );

      return res.json({
        success: true,
        status: "PENDING_APPROVAL",
        forwarded_to_username: approverName,
        message: `Processed salary forwarded to ${approverName} for approval`
      });
    } else {
      // Auto-approve if no workflow configured
      const uRows = await query("SELECT username FROM adm_users WHERE id = :id", { id: userId });
      const approverName = uRows.length ? uRows[0].username : "Authorized User";

      await query(
        `UPDATE hr_payroll SET status = 'APPROVED', approved_by_username = :approverName, approved_at = NOW(), forwarded_to_username = NULL WHERE id = :id`,
        { approverName, id: payroll.id }
      );

      return res.json({
        success: true,
        status: "APPROVED",
        forwarded_to_username: null,
        message: "Payroll approved (auto-approved)"
      });
    }
  } catch (err) { next(err); }
}

export async function approvePayroll(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.sub || req.user?.id || 1;
    const { period_id, payroll_id } = req.body || {};

    let pid = payroll_id ? Number(payroll_id) : null;
    if (!pid && period_id) {
      const p = await query(
        `SELECT id FROM hr_payroll WHERE period_id = :period_id AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
        { period_id, companyId }
      );
      if (p.length) pid = Number(p[0].id);
    }
    if (!pid) throw httpError(404, "NOT_FOUND", "Payroll not found");

    const uRows = await query("SELECT username FROM adm_users WHERE id = :id", { id: userId });
    const approverName = uRows.length ? uRows[0].username : "Authorized User";

    await query(
      `UPDATE hr_payroll SET status = 'APPROVED', approved_by_username = :approverName, approved_at = NOW(), forwarded_to_username = NULL WHERE id = :id AND company_id = :companyId`,
      { approverName, id: pid, companyId }
    );

    await query(
      `UPDATE adm_document_workflows SET status = 'APPROVED', assigned_to_user_id = NULL WHERE document_id = :id AND company_id = :companyId AND document_type IN ('PAYROLL', 'SALARY_PROCESSING', 'HR_PAYROLL') AND status = 'PENDING'`,
      { id: pid, companyId }
    ).catch(() => {});

    res.json({ success: true, status: "APPROVED", message: "Payroll approved successfully" });
  } catch (err) { next(err); }
}

export async function reversePayrollApproval(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { period_id, payroll_id } = req.body || {};

    let pid = payroll_id ? Number(payroll_id) : null;
    if (!pid && period_id) {
      const p = await query(
        `SELECT id FROM hr_payroll WHERE period_id = :period_id AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
        { period_id, companyId }
      );
      if (p.length) pid = Number(p[0].id);
    }
    if (!pid) throw httpError(404, "NOT_FOUND", "Payroll not found");

    await query(
      `UPDATE hr_payroll SET status = 'RETURNED', forwarded_to_username = NULL, approved_by_username = NULL, approved_at = NULL WHERE id = :id AND company_id = :companyId`,
      { id: pid, companyId }
    );

    await query(
      `UPDATE adm_document_workflows SET status = 'RETURNED', assigned_to_user_id = NULL WHERE document_id = :id AND company_id = :companyId AND document_type IN ('PAYROLL', 'SALARY_PROCESSING', 'HR_PAYROLL')`,
      { id: pid, companyId }
    ).catch(() => {});

    res.json({ success: true, status: "RETURNED", message: "Payroll approval reversed and returned" });
  } catch (err) { next(err); }
}

export async function getPayrollApprovalStatus(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { period_id } = req.query;
    if (!period_id) throw httpError(400, "BAD_REQUEST", "period_id required");

    const rows = await query(
      `SELECT id, status, forwarded_to_username, approved_by_username, approved_at, generated_at FROM hr_payroll WHERE period_id = :period_id AND company_id = :companyId ORDER BY id DESC LIMIT 1`,
      { period_id, companyId }
    );

    if (!rows.length) {
      return res.json({
        payroll_id: null,
        period_id: Number(period_id),
        status: "NOT_GENERATED",
        is_approved: false
      });
    }

    const pr = rows[0];
    const isApproved = ['APPROVED', 'CLOSED'].includes(String(pr.status || '').toUpperCase());

    res.json({
      payroll_id: pr.id,
      period_id: Number(period_id),
      status: pr.status,
      forwarded_to_username: pr.forwarded_to_username || null,
      approved_by_username: pr.approved_by_username || null,
      approved_at: pr.approved_at || null,
      generated_at: pr.generated_at || null,
      is_approved: isApproved
    });
  } catch (err) { next(err); }
}
