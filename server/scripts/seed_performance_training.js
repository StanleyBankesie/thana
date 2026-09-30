/**
 * @file seed_performance_training.js
 * @description Script to seed sample data for the HR Performance and Training modules.
 * Populates KPI categories, KPIs, training programs, performance appraisals,
 * training assignments, and employee certifications.
 */

import { query } from "../db/pool.js";
import { ensureHRTables } from "../utils/dbUtils.js";

/**
 * Main execution function to seed HR performance and training data.
 * Ensures the necessary HR tables exist, inserts various HR entities,
 * simulates sample appraisal workflows (draft, pending, approved),
 * and assigns sample training and certifications to employees.
 * 
 * @returns {Promise<void>} Resolves when all sample HR data is seeded.
 */
async function seed() {
  console.log("Ensuring HR performance & training tables...");
  await ensureHRTables();

  const companyId = 1;
  const userId = 1;

  console.log("Seeding KPI categories...");
  const catNames = ["Revenue Growth", "Customer Satisfaction", "Operational Efficiency", "Quality Assurance", "Employee Development", "Compliance"];
  for (const name of catNames) {
    await query(`INSERT IGNORE INTO hr_kpi_categories (company_id, name, description) VALUES (:companyId, :name, :desc)`, { companyId, name, desc: `${name} KPIs` });
  }

  console.log("Seeding KPIs...");
  const kpis = [
    { code: "KPI-001", name: "Monthly Sales Revenue", category: "Revenue Growth", type: "QUANTITATIVE", target: 500000, unit: "USD", weight: 20, formula: "SUM(invoices)" },
    { code: "KPI-002", name: "Customer Satisfaction Score", category: "Customer Satisfaction", type: "QUALITATIVE", target: 90, unit: "%", weight: 15, formula: "AVG(survey)" },
    { code: "KPI-003", name: "On-Time Delivery Rate", category: "Operational Efficiency", type: "PRODUCTIVITY", target: 95, unit: "%", weight: 15, formula: "COUNT(on_time)/COUNT(total)" },
    { code: "KPI-004", name: "Product Quality Index", category: "Quality Assurance", type: "QUALITATIVE", target: 98, unit: "%", weight: 10, formula: "AVG(quality_score)" },
    { code: "KPI-005", name: "Employee Attendance Rate", category: "Employee Development", type: "ATTENDANCE", target: 96, unit: "%", weight: 10, formula: "days_present/total_days" },
    { code: "KPI-006", name: "Task Completion Rate", category: "Operational Efficiency", type: "PRODUCTIVITY", target: 90, unit: "%", weight: 10, formula: "completed/total" },
    { code: "KPI-007", name: "Team Collaboration Score", category: "Employee Development", type: "BEHAVIORAL", target: 85, unit: "%", weight: 5, formula: "AVG(peer_review)" },
    { code: "KPI-008", name: "Compliance Audit Score", category: "Compliance", type: "QUANTITATIVE", target: 100, unit: "%", weight: 10, formula: "audit_score" },
    { code: "KPI-009", name: "Innovation Index", category: "Revenue Growth", type: "QUALITATIVE", target: 80, unit: "%", weight: 5, formula: "AVG(innovation_score)" },
  ];

  for (const k of kpis) {
    const catRows = await query(`SELECT id FROM hr_kpi_categories WHERE company_id = :companyId AND name = :name`, { companyId, name: k.category });
    const catId = catRows.length ? catRows[0].id : null;
    await query(`INSERT IGNORE INTO hr_kpis (company_id, code, name, category_id, kpi_type, target_value, measurement_unit, weight, calculation_formula, scoring_method, min_score, max_score, is_active, created_by) VALUES (:companyId, :code, :name, :catId, :type, :target, :unit, :weight, :formula, 'MANUAL', 0, 100, 1, :userId)`, { companyId, code: k.code, name: k.name, catId, type: k.type, target: k.target, unit: k.unit, weight: k.weight, formula: k.formula, userId });
  }

  console.log("Seeding training programs...");
  const programs = [
    { code: "TRN-001", name: "Advanced Sales Techniques", cat: "Sales", type: "WORKSHOP", trainer: "John Smith", vendor: "SalesForce Training", venue: "Conference Room A", mode: "In-Person", cost: 5000, capacity: 20 },
    { code: "TRN-002", name: "Leadership Excellence Program", cat: "Management", type: "SEMINAR", trainer: "Dr. Sarah Johnson", vendor: "Harvard Business Review", venue: "Auditorium", mode: "In-Person", cost: 15000, capacity: 15 },
    { code: "TRN-003", name: "Data Analytics for Managers", cat: "Analytics", type: "ONLINE", trainer: "Prof. Michael Chen", vendor: "Coursera", venue: "Online", mode: "Virtual", cost: 3000, capacity: 30 },
    { code: "TRN-004", name: "Cybersecurity Awareness", cat: "IT", type: "CERTIFICATION", trainer: "Security Team", vendor: "CompTIA", venue: "Training Lab", mode: "Blended", cost: 8000, capacity: 25 },
    { code: "TRN-005", name: "Customer Service Excellence", cat: "Customer Support", type: "INTERNAL", trainer: "HR Department", vendor: "Internal", venue: "Training Room B", mode: "In-Person", cost: 2000, capacity: 20 },
    { code: "TRN-006", name: "Project Management Professional", cat: "Management", type: "CERTIFICATION", trainer: "PMI Certified Trainer", vendor: "PMI", venue: "Conference Center", mode: "In-Person", cost: 12000, capacity: 10 },
  ];

  for (const p of programs) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + Math.floor(Math.random() * 60));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + Math.floor(Math.random() * 5) + 1);
    await query(`INSERT IGNORE INTO hr_training_programs (company_id, code, name, category, training_type, trainer, vendor, venue, training_mode, start_date, end_date, cost, capacity, is_active, created_by) VALUES (:companyId, :code, :name, :cat, :type, :trainer, :vendor, :venue, :mode, :startDate, :endDate, :cost, :capacity, 1, :userId)`, { companyId, code: p.code, name: p.name, cat: p.cat, type: p.type, trainer: p.trainer, vendor: p.vendor, venue: p.venue, mode: p.mode, startDate: startDate.toISOString().slice(0, 10), endDate: endDate.toISOString().slice(0, 10), cost: p.cost, capacity: p.capacity, userId });
  }

  console.log("Seeding KPI assignments...");
  const empRows = await query(`SELECT id FROM hr_employees WHERE company_id = :companyId LIMIT 5`, { companyId });
  const kpiRows = await query(`SELECT id FROM hr_kpis WHERE company_id = :companyId LIMIT 5`, { companyId });
  for (let i = 0; i < Math.min(empRows.length, 3); i++) {
    for (let j = 0; j < Math.min(kpiRows.length, 3); j++) {
      await query(`INSERT IGNORE INTO hr_kpi_assignments (company_id, kpi_id, employee_id, assignment_type, weight, target_value, scoring_method, is_active, created_by) VALUES (:companyId, :kpiId, :empId, 'EMPLOYEE', :weight, :target, 'MANUAL', 1, :userId)`, { companyId, kpiId: kpiRows[j].id, empId: empRows[i].id, weight: Math.round(100 / 3), target: (j + 1) * 100, userId });
    }
  }

  console.log("Seeding sample appraisals...");
  for (let i = 0; i < Math.min(empRows.length, 3); i++) {
    const statuses = ["APPROVED", "PENDING_HR", "PENDING_SUPERVISOR", "DRAFT"];
    const status = statuses[i];
    const kpiScore = Math.round((75 + Math.random() * 20) * 100) / 100;
    const compScore = Math.round((70 + Math.random() * 25) * 100) / 100;
    const overall = Math.round((kpiScore * 0.7 + compScore * 0.3) * 100) / 100;
    const r = await query(`INSERT INTO hr_appraisals (company_id, employee_id, reviewer_user_id, review_period, start_date, end_date, kpi_score, competency_score, overall_score, status, employee_remarks, manager_remarks, created_by) VALUES (:companyId, :empId, :userId, :period, :start, :end, :kpiScore, :compScore, :overall, :status, :empRemarks, :mgrRemarks, :userId)`, { companyId, empId: empRows[i].id, userId, period: "Q1 2026", start: "2026-01-01", end: "2026-03-31", kpiScore, compScore, overall, status, empRemarks: "I have worked hard this quarter and achieved all my targets.", mgrRemarks: "Good performance overall. Room for improvement in cross-team collaboration.", userId });
    const appraisalId = r.insertId;
    for (let j = 0; j < Math.min(kpiRows.length, 3); j++) {
      const actual = Math.round((70 + Math.random() * 30) * 100) / 100;
      const target = (j + 1) * 100;
      const rating = Math.round(2 + Math.random() * 3);
      const score = Math.round((actual / target) * rating * 100) / 100;
      await query(`INSERT INTO hr_appraisal_details (appraisal_id, kpi_id, target_value, actual_value, weight, rating, score, achievement_pct, manager_remarks) VALUES (:appraisalId, :kpiId, :target, :actual, :weight, :rating, :score, :ach, :remarks)`, { appraisalId, kpiId: kpiRows[j].id, target, actual, weight: Math.round(100 / 3), rating, score, ach: Math.round((actual / target) * 10000) / 100, remarks: "Meets expectations" });
    }
    const comps = ["Communication", "Leadership", "Teamwork", "Discipline", "Problem Solving", "Innovation", "Time Management"];
    for (const comp of comps) {
      await query(`INSERT INTO hr_competency_scores (appraisal_id, competency_name, rating) VALUES (:appraisalId, :comp, :rating)`, { appraisalId, comp, rating: Math.round(3 + Math.random() * 2) });
    }
    await query(`INSERT INTO hr_goal_tracking (appraisal_id, goal_name, completion_pct) VALUES (:appraisalId, :goal, :pct)`, { appraisalId, goal: "Complete Q1 projects", pct: Math.round(70 + Math.random() * 30) });
    await query(`INSERT INTO hr_goal_tracking (appraisal_id, goal_name, completion_pct) VALUES (:appraisalId, :goal, :pct)`, { appraisalId, goal: "Improve team collaboration", pct: Math.round(60 + Math.random() * 35) });
    if (status !== "DRAFT") {
      await query(`INSERT INTO hr_appraisal_workflow_log (appraisal_id, action, actor_user_id, comments) VALUES (:appraisalId, 'SUBMIT', :userId, 'Appraisal submitted for review')`, { appraisalId, userId });
    }
    if (status === "APPROVED") {
      await query(`INSERT INTO hr_appraisal_workflow_log (appraisal_id, action, actor_user_id, comments) VALUES (:appraisalId, 'APPROVE', :userId, 'Approved by supervisor')`, { appraisalId, userId });
      await query(`INSERT INTO hr_appraisal_workflow_log (appraisal_id, action, actor_user_id, comments) VALUES (:appraisalId, 'APPROVE', :userId, 'Approved by HR')`, { appraisalId, userId });
      await query(`UPDATE hr_appraisals SET supervisor_approved_at = NOW(), hr_approved_at = NOW() WHERE id = :appraisalId`, { appraisalId });
    }
    if (status === "PENDING_HR") {
      await query(`INSERT INTO hr_appraisal_workflow_log (appraisal_id, action, actor_user_id, comments) VALUES (:appraisalId, 'APPROVE', :userId, 'Approved by supervisor, pending HR review')`, { appraisalId, userId });
      await query(`UPDATE hr_appraisals SET supervisor_approved_at = NOW() WHERE id = :appraisalId`, { appraisalId });
    }
  }

  console.log("Seeding training assignments...");
  const progRows = await query(`SELECT id FROM hr_training_programs WHERE company_id = :companyId LIMIT 4`, { companyId });
  for (let i = 0; i < Math.min(progRows.length, 3); i++) {
    for (let j = 0; j < Math.min(empRows.length, 3); j++) {
      const statuses = ["COMPLETED", "CONFIRMED", "ASSIGNED"];
      const status = statuses[j];
      const score = status === "COMPLETED" ? Math.round((70 + Math.random() * 30) * 100) / 100 : null;
      await query(`INSERT INTO hr_training_assignments (company_id, program_id, employee_id, assigned_by, status, score) VALUES (:companyId, :progId, :empId, :userId, :status, :score)`, { companyId, progId: progRows[i].id, empId: empRows[j].id, userId, status, score });
      if (status === "COMPLETED") {
        await query(`UPDATE hr_training_assignments SET completed_at = NOW() WHERE program_id = :progId AND employee_id = :empId`, { progId: progRows[i].id, empId: empRows[j].id });
      }
    }
  }

  console.log("Seeding certifications...");
  const completedAssignments = await query(`SELECT ta.id, ta.employee_id, ta.program_id FROM hr_training_assignments ta WHERE ta.status = 'COMPLETED' AND ta.company_id = :companyId LIMIT 3`, { companyId });
  for (const ca of completedAssignments) {
    const progName = await query(`SELECT name FROM hr_training_programs WHERE id = :id`, { id: ca.program_id });
    const expiry = new Date();
    expiry.setFullYear(expiry.getFullYear() + 2);
    await query(`INSERT INTO hr_certifications (company_id, employee_id, training_program_id, cert_name, issued_by, issue_date, expiry_date, cert_number) VALUES (:companyId, :empId, :progId, :certName, :issuedBy, :issueDate, :expiryDate, :certNum)`, { companyId, empId: ca.employee_id, progId: ca.program_id, certName: `${progName[0]?.name || 'Training'} Certificate`, issuedBy: "OmniSuite ERP", issueDate: new Date().toISOString().slice(0, 10), expiryDate: expiry.toISOString().slice(0, 10), certNum: `CERT-${String(ca.employee_id).padStart(4, '0')}-${String(ca.program_id).padStart(4, '0')}` });
  }

  console.log("Seed completed successfully!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
