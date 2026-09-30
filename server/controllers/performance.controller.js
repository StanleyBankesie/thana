/**
 * @file performance.controller.js
 * @description Controller for HR performance management, including KPIs and Appraisals.
 */
// Database and Utility Dependencies
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { toNumber } from "../utils/dbUtils.js";

// ==========================================
// KPI Categories Management
// ==========================================

// Endpoint to list all active KPI categories for the company
export async function listKpiCategories(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const items = await query(`SELECT * FROM hr_kpi_categories WHERE company_id = :companyId AND is_active = 1 ORDER BY name ASC`, { companyId });
    res.json({ items });
  } catch (err) { next(err); }
}

// Endpoint to create or update a KPI category
export async function saveKpiCategory(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id, name, description } = req.body;
    
    if (id) {
      // Update existing KPI category
      await query(`UPDATE hr_kpi_categories SET name = :name, description = :description WHERE id = :id AND company_id = :companyId`, { id, name, description, companyId });
      res.json({ message: "Category updated" });
    } else {
      // Insert new KPI category
      const r = await query(`INSERT INTO hr_kpi_categories (company_id, name, description) VALUES (:companyId, :name, :description)`, { companyId, name, description });
      res.status(201).json({ id: r.insertId, message: "Category created" });
    }
  } catch (err) { next(err); }
}

// Endpoint to deactivate (soft delete) a KPI category
export async function deleteKpiCategory(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    // Set is_active to 0 instead of hard deleting
    await query(`UPDATE hr_kpi_categories SET is_active = 0 WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "Category deleted" });
  } catch (err) { next(err); }
}

// ==========================================
// KPIs Management
// ==========================================

// Endpoint to list KPIs with optional filtering by category, status, and search query
export async function listKpis(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { category_id, is_active, q } = req.query;
    
    // Build dynamic WHERE clause based on provided filters
    const clauses = ["k.company_id = :companyId"];
    const params = { companyId };
    
    if (category_id && category_id !== "ALL") { clauses.push("k.category_id = :category_id"); params.category_id = category_id; }
    if (is_active !== undefined && is_active !== "") { clauses.push("k.is_active = :is_active"); params.is_active = is_active; }
    if (q) { clauses.push("(k.name LIKE :q OR k.code LIKE :q OR k.description LIKE :q)"); params.q = `%${q}%`; }
    
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    
    // Fetch KPIs with assignment counts
    const items = await query(`SELECT k.*, kc.name AS category_name, (SELECT COUNT(*) FROM hr_kpi_assignments WHERE kpi_id = k.id) AS assignment_count FROM hr_kpis k LEFT JOIN hr_kpi_categories kc ON kc.id = k.category_id ${where} ORDER BY k.name ASC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

// Endpoint to get details of a specific KPI
export async function getKpi(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    
    // Fetch KPI and its category name
    const rows = await query(`SELECT k.*, kc.name AS category_name FROM hr_kpis k LEFT JOIN hr_kpi_categories kc ON kc.id = k.category_id WHERE k.id = :id AND k.company_id = :companyId`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "KPI not found");
    
    res.json({ item: rows[0] });
  } catch (err) { next(err); }
}

// Endpoint to create or update a KPI
export async function saveKpi(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, code, name, category_id, description, kpi_type, department, job_role, evaluation_period, weight, target_value, measurement_unit, min_score, max_score, scoring_method, calculation_formula, effective_date, expiry_date, is_active } = req.body;
    
    if (id) {
      // Update existing KPI
      await query(`UPDATE hr_kpis SET code = :code, name = :name, category_id = :category_id, description = :description, kpi_type = :kpi_type, department = :department, job_role = :job_role, evaluation_period = :evaluation_period, weight = :weight, target_value = :target_value, measurement_unit = :measurement_unit, min_score = :min_score, max_score = :max_score, scoring_method = :scoring_method, calculation_formula = :calculation_formula, effective_date = :effective_date, expiry_date = :expiry_date, is_active = :is_active, updated_by = :userId WHERE id = :id AND company_id = :companyId`, { id, code, name, category_id: category_id || null, description, kpi_type: kpi_type || 'QUANTITATIVE', department, job_role, evaluation_period, weight: toNumber(weight, 0), target_value: toNumber(target_value, null), measurement_unit, min_score: toNumber(min_score, 0), max_score: toNumber(max_score, 100), scoring_method: scoring_method || 'MANUAL', calculation_formula, effective_date: effective_date || null, expiry_date: expiry_date || null, is_active: is_active !== undefined ? (is_active ? 1 : 0) : 1, userId, companyId });
      res.json({ message: "KPI updated" });
    } else {
      // Insert new KPI
      const r = await query(`INSERT INTO hr_kpis (company_id, code, name, category_id, description, kpi_type, department, job_role, evaluation_period, weight, target_value, measurement_unit, min_score, max_score, scoring_method, calculation_formula, effective_date, expiry_date, is_active, created_by) VALUES (:companyId, :code, :name, :category_id, :description, :kpi_type, :department, :job_role, :evaluation_period, :weight, :target_value, :measurement_unit, :min_score, :max_score, :scoring_method, :calculation_formula, :effective_date, :expiry_date, :is_active, :userId)`, { companyId, code, name, category_id: category_id || null, description, kpi_type: kpi_type || 'QUANTITATIVE', department, job_role, evaluation_period, weight: toNumber(weight, 0), target_value: toNumber(target_value, null), measurement_unit, min_score: toNumber(min_score, 0), max_score: toNumber(max_score, 100), scoring_method: scoring_method || 'MANUAL', calculation_formula, effective_date: effective_date || null, expiry_date: expiry_date || null, is_active: 1, userId });
      res.status(201).json({ id: r.insertId, message: "KPI created" });
    }
  } catch (err) { next(err); }
}

// Endpoint to deactivate a KPI
export async function deleteKpi(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    
    // Prevent deletion if KPI is linked to existing appraisals
    const linked = await query(`SELECT COUNT(*) AS c FROM hr_appraisal_details WHERE kpi_id = :id`, { id });
    if (Number(linked[0]?.c || 0) > 0) throw httpError(400, "VALIDATION_ERROR", "Cannot delete KPI linked to appraisals");
    
    // Soft delete the KPI
    await query(`UPDATE hr_kpis SET is_active = 0 WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "KPI deactivated" });
  } catch (err) { next(err); }
}

// Endpoint to clone an existing KPI to a new one
export async function cloneKpi(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, new_code } = req.body;
    
    // Fetch source KPI
    const rows = await query(`SELECT * FROM hr_kpis WHERE id = :id AND company_id = :companyId`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "KPI not found");
    const src = rows[0];
    
    // Generate new code if not provided
    const code = new_code || (src.code + "-COPY");
    
    // Insert new cloned KPI
    const r = await query(`INSERT INTO hr_kpis (company_id, code, name, category_id, description, kpi_type, department, job_role, evaluation_period, weight, target_value, measurement_unit, min_score, max_score, scoring_method, calculation_formula, effective_date, expiry_date, is_active, created_by) VALUES (:companyId, :code, :name, :category_id, :description, :kpi_type, :department, :job_role, :evaluation_period, :weight, :target_value, :measurement_unit, :min_score, :max_score, :scoring_method, :calculation_formula, :effective_date, :expiry_date, 1, :userId)`, { companyId, code, name: src.name, category_id: src.category_id, description: src.description, kpi_type: src.kpi_type, department: src.department, job_role: src.job_role, evaluation_period: src.evaluation_period, weight: src.weight, target_value: src.target_value, measurement_unit: src.measurement_unit, min_score: src.min_score, max_score: src.max_score, scoring_method: src.scoring_method, calculation_formula: src.calculation_formula, effective_date: src.effective_date, expiry_date: src.expiry_date, userId });
    res.status(201).json({ id: r.insertId, message: "KPI cloned" });
  } catch (err) { next(err); }
}

// ==========================================
// KPI Assignments
// ==========================================

// Endpoint to list KPI assignments
export async function listKpiAssignments(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { kpi_id, employee_id } = req.query;
    
    // Build dynamic WHERE clause based on optional filters
    const clauses = ["a.company_id = :companyId"];
    const params = { companyId };
    
    if (kpi_id) { clauses.push("a.kpi_id = :kpi_id"); params.kpi_id = kpi_id; }
    if (employee_id) { clauses.push("a.employee_id = :employee_id"); params.employee_id = employee_id; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    
    // Fetch KPI assignments joining KPIs and employee details
    const items = await query(`SELECT a.*, k.name AS kpi_name, k.code AS kpi_code, k.target_value AS kpi_target, k.measurement_unit, e.first_name, e.last_name, e.emp_code, d.dept_name FROM hr_kpi_assignments a LEFT JOIN hr_kpis k ON k.id = a.kpi_id LEFT JOIN hr_employees e ON e.id = a.employee_id LEFT JOIN hr_departments d ON d.id = a.dept_id ${where} ORDER BY a.created_at DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

// Endpoint to assign a KPI to an employee or department
export async function saveKpiAssignment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, kpi_id, employee_id, dept_id, pos_id, assignment_type, weight, target_value, scoring_method, effective_date, expiry_date } = req.body;
    
    if (!kpi_id) throw httpError(400, "VALIDATION_ERROR", "KPI is required");
    
    // Check for duplicate active assignments
    const exist = await query(`SELECT COUNT(*) AS c FROM hr_kpi_assignments WHERE kpi_id = :kpi_id AND employee_id = :employee_id AND company_id = :companyId AND is_active = 1 AND id != :id`, { kpi_id, employee_id: employee_id || 0, companyId, id: id || 0 });
    if (Number(exist[0]?.c || 0) > 0) throw httpError(400, "VALIDATION_ERROR", "Duplicate KPI assignment");
    
    if (id) {
      // Update existing assignment
      await query(`UPDATE hr_kpi_assignments SET kpi_id = :kpi_id, employee_id = :employee_id, dept_id = :dept_id, pos_id = :pos_id, assignment_type = :assignment_type, weight = :weight, target_value = :target_value, scoring_method = :scoring_method, effective_date = :effective_date, expiry_date = :expiry_date WHERE id = :id AND company_id = :companyId`, { id, kpi_id, employee_id: employee_id || null, dept_id: dept_id || null, pos_id: pos_id || null, assignment_type: assignment_type || 'EMPLOYEE', weight: toNumber(weight, 0), target_value: toNumber(target_value, null), scoring_method: scoring_method || 'MANUAL', effective_date: effective_date || null, expiry_date: expiry_date || null, companyId });
      res.json({ message: "Assignment updated" });
    } else {
      // Create new assignment
      const r = await query(`INSERT INTO hr_kpi_assignments (company_id, kpi_id, employee_id, dept_id, pos_id, assignment_type, weight, target_value, scoring_method, effective_date, expiry_date, created_by) VALUES (:companyId, :kpi_id, :employee_id, :dept_id, :pos_id, :assignment_type, :weight, :target_value, :scoring_method, :effective_date, :expiry_date, :userId)`, { companyId, kpi_id, employee_id: employee_id || null, dept_id: dept_id || null, pos_id: pos_id || null, assignment_type: assignment_type || 'EMPLOYEE', weight: toNumber(weight, 0), target_value: toNumber(target_value, null), scoring_method: scoring_method || 'MANUAL', effective_date: effective_date || null, expiry_date: expiry_date || null, userId });
      res.status(201).json({ id: r.insertId, message: "Assignment created" });
    }
  } catch (err) { next(err); }
}

// Endpoint to remove a KPI assignment (soft delete)
export async function deleteKpiAssignment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    // Set is_active to 0 to preserve history
    await query(`UPDATE hr_kpi_assignments SET is_active = 0 WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ message: "Assignment removed" });
  } catch (err) { next(err); }
}

// ==========================================
// Appraisals Management
// ==========================================

// Endpoint to list appraisals with optional filters
export async function listAppraisals(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { employee_id, status, q } = req.query;
    const clauses = ["a.company_id = :companyId"];
    const params = { companyId };
    if (employee_id) { clauses.push("a.employee_id = :employee_id"); params.employee_id = employee_id; }
    if (status && status !== "ALL") { clauses.push("a.status = :status"); params.status = status; }
    if (q) { clauses.push("(e.first_name LIKE :q OR e.last_name LIKE :q OR e.emp_code LIKE :q)"); params.q = `%${q}%`; }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const items = await query(`SELECT a.*, e.first_name, e.last_name, e.emp_code, d.dept_name, p.pos_name, CONCAT(e.first_name, ' ', e.last_name) AS employee_name FROM hr_appraisals a LEFT JOIN hr_employees e ON e.id = a.employee_id LEFT JOIN hr_departments d ON d.id = e.dept_id LEFT JOIN hr_positions p ON p.id = e.pos_id ${where} ORDER BY a.created_at DESC`, params);
    res.json({ items });
  } catch (err) { next(err); }
}

// Endpoint to get full details of an appraisal
export async function getAppraisal(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { id } = req.params;
    
    // Fetch appraisal header
    const rows = await query(`SELECT a.*, e.first_name, e.last_name, e.emp_code, d.dept_name, p.pos_name, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, m.first_name AS mgr_first_name, m.last_name AS mgr_last_name FROM hr_appraisals a LEFT JOIN hr_employees e ON e.id = a.employee_id LEFT JOIN hr_departments d ON d.id = e.dept_id LEFT JOIN hr_positions p ON p.id = e.pos_id LEFT JOIN hr_employees m ON m.id = e.manager_id WHERE a.id = :id AND a.company_id = :companyId`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Appraisal not found");
    
    // Fetch associated appraisal details, competencies, goals and workflow logs
    const details = await query(`SELECT ad.*, k.name AS kpi_name, k.code AS kpi_code, k.measurement_unit FROM hr_appraisal_details ad LEFT JOIN hr_kpis k ON k.id = ad.kpi_id WHERE ad.appraisal_id = :id ORDER BY ad.id ASC`, { id });
    const competencies = await query(`SELECT * FROM hr_competency_scores WHERE appraisal_id = :id ORDER BY id ASC`, { id });
    const goals = await query(`SELECT * FROM hr_goal_tracking WHERE appraisal_id = :id ORDER BY id ASC`, { id });
    const workflowLog = await query(`SELECT w.*, u.username AS actor_name FROM hr_appraisal_workflow_log w LEFT JOIN adm_users u ON u.id = w.actor_user_id WHERE w.appraisal_id = :id ORDER BY w.created_at ASC`, { id });
    
    res.json({ item: rows[0], details, competencies, goals, workflowLog });
  } catch (err) { next(err); }
}

// Endpoint to create or update an appraisal along with its details
export async function saveAppraisal(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id, employee_id, reviewer_user_id, review_period, start_date, end_date, status, employee_remarks, details, competencies, goals } = req.body;
    
    if (!employee_id) throw httpError(400, "VALIDATION_ERROR", "Employee is required");
    let appraisalId = id;
    
    if (id) {
      // Update appraisal header
      await query(`UPDATE hr_appraisals SET employee_id = :employee_id, reviewer_user_id = :reviewer_user_id, review_period = :review_period, start_date = :start_date, end_date = :end_date, status = :status, employee_remarks = :employee_remarks, updated_by = :userId WHERE id = :id AND company_id = :companyId`, { id, employee_id, reviewer_user_id: reviewer_user_id || null, review_period, start_date: start_date || null, end_date: end_date || null, status: status || 'DRAFT', employee_remarks, userId, companyId });
    } else {
      // Create new appraisal header
      const r = await query(`INSERT INTO hr_appraisals (company_id, employee_id, reviewer_user_id, review_period, start_date, end_date, status, employee_remarks, created_by) VALUES (:companyId, :employee_id, :reviewer_user_id, :review_period, :start_date, :end_date, :status, :employee_remarks, :userId)`, { companyId, employee_id, reviewer_user_id: reviewer_user_id || null, review_period, start_date: start_date || null, end_date: end_date || null, status: status || 'DRAFT', employee_remarks, userId });
      appraisalId = r.insertId;
    }
    
    // Replace appraisal details (KPIs)
    if (Array.isArray(details)) {
      await query(`DELETE FROM hr_appraisal_details WHERE appraisal_id = :appraisalId`, { appraisalId });
      for (const d of details) {
        await query(`INSERT INTO hr_appraisal_details (appraisal_id, kpi_id, target_value, actual_value, weight, rating, score, achievement_pct, manager_remarks) VALUES (:appraisalId, :kpi_id, :target_value, :actual_value, :weight, :rating, :score, :achievement_pct, :manager_remarks)`, { appraisalId, kpi_id: d.kpi_id, target_value: toNumber(d.target_value, null), actual_value: toNumber(d.actual_value, null), weight: toNumber(d.weight, 0), rating: toNumber(d.rating, null), score: toNumber(d.score, null), achievement_pct: toNumber(d.achievement_pct, null), manager_remarks: d.manager_remarks || null });
      }
    }
    
    // Replace competency scores
    if (Array.isArray(competencies)) {
      await query(`DELETE FROM hr_competency_scores WHERE appraisal_id = :appraisalId`, { appraisalId });
      for (const c of competencies) {
        await query(`INSERT INTO hr_competency_scores (appraisal_id, competency_name, rating, remarks) VALUES (:appraisalId, :competency_name, :rating, :remarks)`, { appraisalId, competency_name: c.competency_name, rating: toNumber(c.rating, 0), remarks: c.remarks || null });
      }
    }
    
    // Replace goal tracking
    if (Array.isArray(goals)) {
      await query(`DELETE FROM hr_goal_tracking WHERE appraisal_id = :appraisalId`, { appraisalId });
      for (const g of goals) {
        await query(`INSERT INTO hr_goal_tracking (appraisal_id, goal_name, completion_pct, remarks) VALUES (:appraisalId, :goal_name, :completion_pct, :remarks)`, { appraisalId, goal_name: g.goal_name, completion_pct: toNumber(g.completion_pct, 0), remarks: g.remarks || null });
      }
    }
    
    // Calculate aggregate scores
    const kpiScore = Array.isArray(details) && details.length ? calcKpiScore(details) : null;
    const compScore = Array.isArray(competencies) && competencies.length ? calcCompScore(competencies) : null;
    const overall = kpiScore !== null && compScore !== null ? (kpiScore * 0.7 + compScore * 0.3) : (kpiScore || compScore || null);
    
    // Update calculated scores in header
    if (overall !== null) {
      await query(`UPDATE hr_appraisals SET kpi_score = :kpiScore, competency_score = :compScore, overall_score = :overall WHERE id = :appraisalId`, { kpiScore, compScore, overall: Math.round(overall * 100) / 100, appraisalId });
    }
    
    res.json({ id: appraisalId, message: "Appraisal saved" });
  } catch (err) { next(err); }
}

// Utility function to calculate weighted KPI score
function calcKpiScore(details) {
  let totalWeighted = 0, totalWeight = 0;
  // Iterate through all KPI details and calculate sum of weighted scores
  for (const d of details) {
    const w = Number(d.weight) || 0;
    const s = Number(d.score) || 0;
    totalWeighted += s * w;
    totalWeight += w;
  }
  // Return the weighted average rounded to 2 decimal places
  return totalWeight > 0 ? Math.round((totalWeighted / totalWeight) * 100) / 100 : 0;
}

// Utility function to calculate aggregate competency score
function calcCompScore(competencies) {
  // Sum up all competency ratings
  const total = competencies.reduce((sum, c) => sum + (Number(c.rating) || 0), 0);
  const max = competencies.length * 5; // Assuming max rating is 5
  // Calculate percentage score
  return max > 0 ? Math.round((total / max) * 100 * 100) / 100 : 0;
}

// Endpoint to process an appraisal through its workflow stages
export async function submitAppraisal(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const userId = req.user?.id || req.user?.sub;
    const { id } = req.params;
    const { action, comments } = req.body;
    
    // Fetch appraisal to check current status
    const rows = await query(`SELECT * FROM hr_appraisals WHERE id = :id AND company_id = :companyId`, { id, companyId });
    if (!rows.length) throw httpError(404, "NOT_FOUND", "Appraisal not found");
    const appraisal = rows[0];
    
    let newStatus = appraisal.status;
    
    // Determine new status based on action
    if (action === "SUBMIT") newStatus = "PENDING_SUPERVISOR";
    else if (action === "APPROVE") {
      // Transition from Supervisor -> HR -> Approved
      newStatus = appraisal.status === "PENDING_SUPERVISOR" ? "PENDING_HR" : "APPROVED";
      if (newStatus === "APPROVED") await query(`UPDATE hr_appraisals SET hr_approved_at = NOW() WHERE id = :id`, { id });
      if (newStatus === "PENDING_HR") await query(`UPDATE hr_appraisals SET supervisor_approved_at = NOW() WHERE id = :id`, { id });
    } else if (action === "REJECT") newStatus = "REJECTED";
    else if (action === "SEND_BACK") newStatus = "DRAFT";
    else throw httpError(400, "BAD_REQUEST", "Invalid action");
    
    // Update status and log workflow history
    await query(`UPDATE hr_appraisals SET status = :newStatus WHERE id = :id`, { newStatus, id });
    await query(`INSERT INTO hr_appraisal_workflow_log (appraisal_id, action, actor_user_id, comments) VALUES (:id, :action, :userId, :comments)`, { id, action, userId, comments: comments || null });
    
    res.json({ message: `Appraisal ${action.toLowerCase()}d successfully` });
  } catch (err) { next(err); }
}

// Endpoint to aggregate appraisal metrics for the dashboard
export async function getAppraisalDashboard(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    
    // Execute multiple queries to collect summary statistics
    const total = await query(`SELECT COUNT(*) AS c FROM hr_appraisals WHERE company_id = :companyId`, { companyId });
    const pending = await query(`SELECT COUNT(*) AS c FROM hr_appraisals WHERE company_id = :companyId AND status IN ('PENDING_SUPERVISOR','PENDING_HR','PENDING_EMPLOYEE')`, { companyId });
    const completed = await query(`SELECT COUNT(*) AS c FROM hr_appraisals WHERE company_id = :companyId AND status IN ('APPROVED','CLOSED')`, { companyId });
    const avgScore = await query(`SELECT ROUND(AVG(overall_score), 2) AS avg_score FROM hr_appraisals WHERE company_id = :companyId AND overall_score IS NOT NULL`, { companyId });
    
    // Aggregate scores grouped by department
    const deptScores = await query(`SELECT d.dept_name, ROUND(AVG(a.overall_score), 2) AS avg_score FROM hr_appraisals a JOIN hr_employees e ON e.id = a.employee_id JOIN hr_departments d ON d.id = e.dept_id WHERE a.company_id = :companyId AND a.overall_score IS NOT NULL GROUP BY d.dept_name ORDER BY avg_score DESC`, { companyId });
    
    // Retrieve top and bottom 10 performers
    const topPerformers = await query(`SELECT a.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.emp_code, a.overall_score FROM hr_appraisals a JOIN hr_employees e ON e.id = a.employee_id WHERE a.company_id = :companyId AND a.status = 'APPROVED' AND a.overall_score IS NOT NULL ORDER BY a.overall_score DESC LIMIT 10`, { companyId });
    const lowPerformers = await query(`SELECT a.employee_id, CONCAT(e.first_name, ' ', e.last_name) AS employee_name, e.emp_code, a.overall_score FROM hr_appraisals a JOIN hr_employees e ON e.id = a.employee_id WHERE a.company_id = :companyId AND a.status = 'APPROVED' AND a.overall_score IS NOT NULL ORDER BY a.overall_score ASC LIMIT 10`, { companyId });
    
    res.json({ total: Number(total[0]?.c || 0), pending: Number(pending[0]?.c || 0), completed: Number(completed[0]?.c || 0), avgScore: Number(avgScore[0]?.avg_score || 0), deptScores, topPerformers, lowPerformers });
  } catch (err) { next(err); }
}

// Endpoint to upload a supporting document for an appraisal
export async function uploadAttachment(req, res, next) {
  try {
    const { companyId = null } = req.scope || {};
    const { appraisal_id, section, file_url, file_name } = req.body;
    if (!appraisal_id || !file_url) throw httpError(400, "VALIDATION_ERROR", "appraisal_id and file_url are required");
    
    // Save reference to the uploaded file in employee_documents table
    const r = await query(`INSERT INTO hr_employee_documents (company_id, employee_id, doc_type, doc_name, file_url) VALUES (:companyId, (SELECT employee_id FROM hr_appraisals WHERE id = :appraisal_id), :doc_type, :doc_name, :file_url)`, { companyId: companyId || null, appraisal_id, doc_type: `APPRAISAL_${String(section || 'GENERAL').toUpperCase()}`, doc_name: file_name || 'Attachment', file_url });
    res.status(201).json({ id: r.insertId, message: "Attachment uploaded" });
  } catch (err) { next(err); }
}
