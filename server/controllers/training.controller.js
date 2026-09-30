/**
 * @file training.controller.js
 * @description Controller for HR training programs, assignments, attendance, and certifications.
 */
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { toNumber } from "../utils/dbUtils.js";

/**
 * Retrieves a paginated list of training programs filtered by company, category, type, and active status.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTrainingPrograms(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { category, training_type, is_active, q } = req.query;
    const clauses = ["t.company_id = :companyId"];
    const params = { companyId };
    if (category && category !== "ALL") { clauses.push("t.category = :category"); params.category = category; }
    if (training_type && training_type !== "ALL") { clauses.push("t.training_type = :training_type"); params.training_type = training_type; }
    if (is_active !== undefined && is_active !== "") { clauses.push("t.is_active = :is_active"); params.is_active = is_active; }
    if (q) { clauses.push("(t.name LIKE :q OR t.code LIKE :q OR t.description LIKE :q)"); params.q = `%${q}%`; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT t.*, d.dept_name, (SELECT COUNT(*) FROM hr_training_assignments WHERE program_id = t.id) AS enrolled_count FROM hr_training_programs t LEFT JOIN hr_departments d ON d.id = t.dept_id ${where} ORDER BY t.start_date DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

/**
 * Fetches the details of a single training program by its ID.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getTrainingProgram(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    const rows = await query(`SELECT t.*, d.dept_name FROM hr_training_programs t LEFT JOIN hr_departments d ON d.id = t.dept_id WHERE t.id = :id AND t.company_id = :companyId`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Training program not found");
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
}

/**
 * Creates or updates a training program depending on whether an ID is provided.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveTrainingProgram(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, code, name, category, description, training_type, trainer, vendor, venue, training_mode, start_date, end_date, cost, capacity, dept_id, required_skills, attachment_url, is_active } = req.body;
    if (id) {
      await query(`UPDATE hr_training_programs SET code = :code, name = :name, category = :category, description = :description, training_type = :training_type, trainer = :trainer, vendor = :vendor, venue = :venue, training_mode = :training_mode, start_date = :start_date, end_date = :end_date, cost = :cost, capacity = :capacity, dept_id = :dept_id, required_skills = :required_skills, attachment_url = :attachment_url, is_active = :is_active, updated_by = :userId WHERE id = :id AND company_id = :companyId`, { id, code, name, category, description, training_type: training_type || 'INTERNAL', trainer, vendor, venue, training_mode, start_date: start_date || null, end_date: end_date || null, cost: toNumber(cost, 0), capacity: toNumber(capacity, 0), dept_id: dept_id || null, required_skills, attachment_url, is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1, userId, companyId });
      res.json({ message: "Program updated" });
    } else {
      const r = await query(`INSERT INTO hr_training_programs (company_id, code, name, category, description, training_type, trainer, vendor, venue, training_mode, start_date, end_date, cost, capacity, dept_id, required_skills, attachment_url, is_active, created_by) VALUES (:companyId, :code, :name, :category, :description, :training_type, :trainer, :vendor, :venue, :training_mode, :start_date, :end_date, :cost, :capacity, :dept_id, :required_skills, :attachment_url, 1, :userId)`, { companyId, code, name, category, description, training_type: training_type || 'INTERNAL', trainer, vendor, venue, training_mode, start_date: start_date || null, end_date: end_date || null, cost: toNumber(cost, 0), capacity: toNumber(capacity, 0), dept_id: dept_id || null, required_skills, attachment_url, userId });
      res.status(201).json({ id: r.insertId, message: "Program created" });
    }
  } catch (err) { next(err); }
}

/**
 * Deactivates a training program (soft delete).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteTrainingProgram(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    await query(`UPDATE hr_training_programs SET is_active = 0 WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "Program deactivated" });
  } catch (err) { next(err); }
}

/**
 * Lists assignments of employees to training programs with filtering.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTrainingAssignments(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { program_id, employee_id, status } = req.query;
    const clauses = ["a.company_id = :companyId"];
    const params = { companyId };
    if (program_id) { clauses.push("a.program_id = :program_id"); params.program_id = program_id; }
    if (employee_id) { clauses.push("a.employee_id = :employee_id"); params.employee_id = employee_id; }
    if (status && status !== "ALL") { clauses.push("a.status = :status"); params.status = status; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT a.*, p.name AS program_name, p.code AS program_code, p.start_date, p.end_date, p.category, e.first_name, e.last_name, e.emp_code, CONCAT(e.first_name, ' ', e.last_name) AS employee_name FROM hr_training_assignments a LEFT JOIN hr_training_programs p ON p.id = a.program_id LEFT JOIN hr_employees e ON e.id = a.employee_id ${where} ORDER BY a.assigned_at DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

/**
 * Creates or updates an employee's training assignment, handling status progression.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveTrainingAssignment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, program_id, employee_id, status, score, feedback } = req.body;
    if (!program_id || !employee_id) throw httpError(400, "VALIDATION_ERROR", "Program and employee are required");
    if (id) {
      await query(`UPDATE hr_training_assignments SET status = :status, score = :score, feedback = :feedback WHERE id = :id AND company_id = :companyId`, { id, status: status || 'ASSIGNED', score: toNumber(score, null), feedback, companyId });
      if (status === 'COMPLETED') await query(`UPDATE hr_training_assignments SET completed_at = NOW() WHERE id = :id`, { id });
      if (status === 'CONFIRMED') await query(`UPDATE hr_training_assignments SET confirmed_at = NOW() WHERE id = :id`, { id });
      res.json({ message: "Assignment updated" });
    } else {
      const r = await query(`INSERT INTO hr_training_assignments (company_id, program_id, employee_id, assigned_by) VALUES (:companyId, :program_id, :employee_id, :userId)`, { companyId, program_id, employee_id, userId });
      res.status(201).json({ id: r.insertId, message: "Employee assigned" });
    }
  } catch (err) { next(err); }
}

/**
 * Hard deletes a training assignment.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteTrainingAssignment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    await query(`DELETE FROM hr_training_assignments WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "Assignment removed" });
  } catch (err) { next(err); }
}

/**
 * Retrieves attendance records for a specific training assignment.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTrainingAttendance(req, res, next) {
  try {
    const { assignment_id } = req.query;
    const params = {};
    const clauses = [];
    if (assignment_id) { clauses.push("a.assignment_id = :assignment_id"); params.assignment_id = assignment_id; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT a.*, p.name AS program_name, e.first_name, e.last_name FROM hr_training_attendance a LEFT JOIN hr_training_assignments ta ON ta.id = a.assignment_id LEFT JOIN hr_training_programs p ON p.id = ta.program_id LEFT JOIN hr_employees e ON e.id = ta.employee_id ${where} ORDER BY a.session_date DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

/**
 * Creates or updates attendance records for a training session.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveTrainingAttendance(req, res, next) {
  try {
    const { id, assignment_id, session_date, present, hours_attended, remarks } = req.body;
    if (!assignment_id || !session_date) throw httpError(400, "VALIDATION_ERROR", "Assignment and session date are required");
    if (id) {
      await query(`UPDATE hr_training_attendance SET present = :present, hours_attended = :hours_attended, remarks = :remarks WHERE id = :id`, { id, present: present ? 1 : 0, hours_attended: toNumber(hours_attended, null), remarks });
    } else {
      const r = await query(`INSERT INTO hr_training_attendance (assignment_id, session_date, present, hours_attended, remarks) VALUES (:assignment_id, :session_date, :present, :hours_attended, :remarks)`, { assignment_id, session_date, present: present ? 1 : 0, hours_attended: toNumber(hours_attended, null), remarks });
      res.status(201).json({ id: r.insertId, message: "Attendance recorded" });
    }
  } catch (err) { next(err); }
}

/**
 * Lists history of completed or confirmed training assignments.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listTrainingHistory(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { employee_id, program_id } = req.query;
    const clauses = ["ta.company_id = :companyId", "ta.status IN ('COMPLETED','CONFIRMED')"];
    const params = { companyId };
    if (employee_id) { clauses.push("ta.employee_id = :employee_id"); params.employee_id = employee_id; }
    if (program_id) { clauses.push("ta.program_id = :program_id"); params.program_id = program_id; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT ta.*, p.name AS program_name, p.code AS program_code, p.category, p.training_type, p.start_date, p.end_date, p.trainer, e.first_name, e.last_name, e.emp_code, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, d.dept_name FROM hr_training_assignments ta LEFT JOIN hr_training_programs p ON p.id = ta.program_id LEFT JOIN hr_employees e ON e.id = ta.employee_id LEFT JOIN hr_departments d ON d.id = e.dept_id ${where} ORDER BY ta.completed_at DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

/**
 * Lists certifications awarded to employees.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function listCertifications(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { employee_id } = req.query;
    const clauses = ["c.company_id = :companyId"];
    const params = { companyId };
    if (employee_id) { clauses.push("c.employee_id = :employee_id"); params.employee_id = employee_id; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT c.*, p.name AS program_name, e.first_name, e.last_name, e.emp_code FROM hr_certifications c LEFT JOIN hr_training_programs p ON p.id = c.training_program_id LEFT JOIN hr_employees e ON e.id = c.employee_id ${where} ORDER BY c.issue_date DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

/**
 * Creates or updates an employee certification record.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function saveCertification(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, employee_id, training_program_id, cert_name, issued_by, issue_date, expiry_date, cert_url, cert_number } = req.body;
    if (id) {
      await query(`UPDATE hr_certifications SET cert_name = :cert_name, issued_by = :issued_by, issue_date = :issue_date, expiry_date = :expiry_date, cert_url = :cert_url, cert_number = :cert_number WHERE id = :id AND company_id = :companyId`, { id, cert_name, issued_by, issue_date, expiry_date, cert_url, cert_number, companyId });
      res.json({ message: "Certification updated" });
    } else {
      const r = await query(`INSERT INTO hr_certifications (company_id, employee_id, training_program_id, cert_name, issued_by, issue_date, expiry_date, cert_url, cert_number) VALUES (:companyId, :employee_id, :training_program_id, :cert_name, :issued_by, :issue_date, :expiry_date, :cert_url, :cert_number)`, { companyId, employee_id, training_program_id: training_program_id || null, cert_name, issued_by, issue_date: issue_date || null, expiry_date: expiry_date || null, cert_url, cert_number });
      res.status(201).json({ id: r.insertId, message: "Certification created" });
    }
  } catch (err) { next(err); }
}

/**
 * Deletes a certification record.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function deleteCertification(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    await query(`DELETE FROM hr_certifications WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "Certification deleted" });
  } catch (err) { next(err); }
}

/**
 * Retrieves aggregate statistics for the training dashboard.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export async function getTrainingDashboard(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const total = await query(`SELECT COUNT(*) AS c FROM hr_training_programs WHERE company_id = :companyId`, { companyId });
    const active = await query(`SELECT COUNT(*) AS c FROM hr_training_programs WHERE company_id = :companyId AND is_active = 1 AND start_date <= CURDATE() AND (end_date >= CURDATE() OR end_date IS NULL)`, { companyId });
    const enrolled = await query(`SELECT COUNT(*) AS c FROM hr_training_assignments WHERE company_id = :companyId AND status IN ('ASSIGNED','CONFIRMED')`, { companyId });
    const completed = await query(`SELECT COUNT(*) AS c FROM hr_training_assignments WHERE company_id = :companyId AND status = 'COMPLETED'`, { companyId });
    const completionRate = await query(`SELECT ROUND((SELECT COUNT(*) FROM hr_training_assignments WHERE company_id = :companyId AND status = 'COMPLETED') / GREATEST((SELECT COUNT(*) FROM hr_training_assignments WHERE company_id = :companyId), 1) * 100, 1) AS rate`, { companyId });
    const upcoming = await query(`SELECT t.id, t.name, t.code, t.start_date, t.end_date, t.capacity, (SELECT COUNT(*) FROM hr_training_assignments WHERE program_id = t.id) AS enrolled FROM hr_training_programs t WHERE t.company_id = :companyId AND t.is_active = 1 AND t.start_date >= CURDATE() ORDER BY t.start_date ASC LIMIT 5`, { companyId });
    const deptStats = await query(`SELECT d.dept_name, COUNT(ta.id) AS trained FROM hr_training_assignments ta JOIN hr_employees e ON e.id = ta.employee_id JOIN hr_departments d ON d.id = e.dept_id WHERE ta.company_id = :companyId AND ta.status = 'COMPLETED' GROUP BY d.dept_name`, { companyId });
    res.json({ total: Number(total[0]?.c || 0), active: Number(active[0]?.c || 0), enrolled: Number(enrolled[0]?.c || 0), completed: Number(completed[0]?.c || 0), completionRate: Number(completionRate[0]?.rate || 0), upcoming, deptStats });
  } catch (err) { next(err); }
}
