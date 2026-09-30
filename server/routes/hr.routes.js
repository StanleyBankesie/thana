/**
 * @file hr.routes.js
 * @description Express routes for HR management including employees, attendance, and leave.
 */
import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import * as hrController from "../controllers/hr.controller.js";
import * as perfController from "../controllers/performance.controller.js";
import * as trainController from "../controllers/training.controller.js";

const router = express.Router();

// Employees
/**
 * Retrieves all employees with optional filters.
 * @route GET /employees
 */
router.get(
  "/employees",
  requireAuth,
  requireCompanyScope,
  hrController.listEmployees,
);
router.get(
  "/employees/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getEmployeeById,
);
router.post(
  "/employees",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveEmployee,
);
router.post(
  "/employees/bulk",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveEmployeesBulk,
);

// Departments & Positions
router.get(
  "/departments",
  requireAuth,
  requireCompanyScope,
  hrController.listDepartments,
);
router.post(
  "/departments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveDepartment,
);
router.get(
  "/positions",
  requireAuth,
  requireCompanyScope,
  hrController.listPositions,
);
router.post(
  "/positions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.savePosition,
);

// Locations
router.get(
  "/setup/locations",
  requireAuth,
  requireCompanyScope,
  hrController.listLocations,
);
router.post(
  "/setup/locations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLocation,
);

router.get(
  "/setup/employment-types",
  requireAuth,
  requireCompanyScope,
  hrController.listEmploymentTypes,
);
router.post(
  "/setup/employment-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveEmploymentType,
);
router.get(
  "/setup/employee-categories",
  requireAuth,
  requireCompanyScope,
  hrController.listEmployeeCategories,
);
router.post(
  "/setup/employee-categories",
  requireAuth,
  requireCompanyScope,
  hrController.saveEmployeeCategory,
);
router.get(
  "/setup/allowance-types",
  requireAuth,
  requireCompanyScope,
  hrController.listAllowanceTypes,
);
router.post(
  "/setup/allowance-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveAllowanceType,
);
router.get(
  "/setup/parameters",
  requireAuth,
  requireCompanyScope,
  hrController.listParameters,
);
router.post(
  "/setup/parameters",
  requireAuth,
  requireCompanyScope,
  hrController.saveParameters,
);

// Recruitment
router.get(
  "/requisitions/next-req-no",
  requireAuth,
  requireCompanyScope,
  hrController.getNextRequisitionNo,
);
router.get(
  "/requisitions",
  requireAuth,
  requireCompanyScope,
  hrController.listRequisitions,
);
router.post(
  "/requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveRequisition,
);
router.get(
  "/requisitions/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getRequisitionById,
);
router.post(
  "/requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  hrController.submitRequisition,
);
router.get(
  "/candidates",
  requireAuth,
  requireCompanyScope,
  hrController.listCandidates,
);
router.post(
  "/candidates",
  requireAuth,
  requireCompanyScope,
  hrController.saveCandidate,
);
router.get(
  "/candidates/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getCandidate,
);

// Promotions
router.get(
  "/promotions",
  requireAuth,
  requireCompanyScope,
  hrController.listPromotions,
);
router.get(
  "/promotions/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getPromotion,
);
router.post(
  "/promotions",
  requireAuth,
  requireCompanyScope,
  hrController.savePromotion,
);

// Interviews
router.get(
  "/interviews",
  requireAuth,
  requireCompanyScope,
  hrController.listInterviews,
);
router.post(
  "/interviews",
  requireAuth,
  requireCompanyScope,
  hrController.saveInterview,
);
router.get(
  "/offers",
  requireAuth,
  requireCompanyScope,
  hrController.listOffers,
);
router.post(
  "/offers",
  requireAuth,
  requireCompanyScope,
  hrController.saveOffer,
);
router.get(
  "/offers/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getOfferById,
);

// Onboarding
router.get(
  "/onboarding/assignments",
  requireAuth,
  requireCompanyScope,
  hrController.listOnboardingAssignments,
);
router.post(
  "/onboarding/assign",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.assignOnboardingChecklist,
);
router.post(
  "/onboarding/task-update",
  requireAuth,
  requireCompanyScope,
  hrController.updateOnboardingTask,
);

// Attendance
router.get(
  "/shifts",
  requireAuth,
  requireCompanyScope,
  hrController.listShifts,
);
router.post(
  "/shifts",
  requireAuth,
  requireCompanyScope,
  hrController.saveShift,
);

// Work Schedules
router.get(
  "/work-schedules",
  requireAuth,
  requireCompanyScope,
  hrController.listWorkSchedules,
);
router.post(
  "/work-schedules",
  requireAuth,
  requireCompanyScope,
  hrController.saveWorkSchedule,
);
router.post(
  "/attendance/clock-in",
  requireAuth,
  requireCompanyScope,
  hrController.clockIn,
);
router.post(
  "/attendance/clock-out",
  requireAuth,
  requireCompanyScope,
  hrController.clockOut,
);
router.get(
  "/attendance",
  requireAuth,
  requireCompanyScope,
  hrController.listAttendance,
);
router.post(
  "/attendance",
  requireAuth,
  requireCompanyScope,
  hrController.saveAttendance,
);
router.get(
  "/attendance/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getAttendance,
);
router.get("/attendance/bulk", requireAuth, requireCompanyScope, (req, res) =>
  res.json({ ok: true }),
);
router.post(
  "/attendance/bulk",
  requireAuth,
  requireCompanyScope,
  hrController.saveBulkAttendance,
);
router.post(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  hrController.saveTimesheet,
);
router.get(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  hrController.listTimesheets,
);
router.post(
  "/attendance/biometric",
  requireAuth,
  requireCompanyScope,
  hrController.biometricWebhook,
);

// Leave Management
router.get(
  "/leave/types",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveTypes,
);
router.get(
  "/leave/types/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getLeaveType,
);
router.post(
  "/leave/types",
  requireAuth,
  requireCompanyScope,
  hrController.saveLeaveType,
);
// --- NEW LEAVE ERP ROUTES ---
router.get(
  "/leave/dashboard",
  requireAuth,
  requireCompanyScope,
  hrController.getLeaveDashboard,
);
router.post(
  "/leave/apply",
  requireAuth,
  requireCompanyScope,
  hrController.applyLeave,
);
router.post(
  "/leave/schedule",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.scheduleLeave,
);
router.post(
  "/leave/roster",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLeaveRoster,
);
router.get(
  "/leave/records",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveRecords,
);
router.delete(
  "/leave/records/:id",
  requireAuth,
  requireCompanyScope,
  hrController.deleteLeaveRecord,
);
router.put(
  "/leave/records/:id",
  requireAuth,
  requireCompanyScope,
  hrController.updateLeave,
);
router.get(
  "/leave/calendar",
  requireAuth,
  requireCompanyScope,
  hrController.leaveCalendar,
);
router.get(
  "/leave/balances",
  requireAuth,
  requireCompanyScope,
  hrController.listLeaveBalances,
);

// Salary Configuration
router.get(
  "/salary-structures",
  requireAuth,
  requireCompanyScope,
  hrController.listSalaryStructures,
);
router.post(
  "/salary-structures",
  requireAuth,
  requireCompanyScope,
  hrController.saveSalaryStructure,
);
router.get(
  "/salary-structure/active",
  requireAuth,
  requireCompanyScope,
  hrController.getActiveSalaryStructure,
);
router.get(
  "/salary/base-salaries",
  requireAuth,
  requireCompanyScope,
  hrController.listBaseSalaries,
);
router.post(
  "/salary/base-salaries",
  requireAuth,
  requireCompanyScope,
  hrController.saveBaseSalary,
);
router.post(
  "/salary/base-salaries/bulk",
  requireAuth,
  requireCompanyScope,
  hrController.saveBaseSalariesBulk,
);

// Tax Configuration
router.get(
  "/tax-configs",
  requireAuth,
  requireCompanyScope,
  hrController.listTaxConfigs,
);
router.post(
  "/tax-configs",
  requireAuth,
  requireCompanyScope,
  hrController.saveTaxConfig,
);

// Allowances
router.get(
  "/allowances",
  requireAuth,
  requireCompanyScope,
  hrController.listAllowances,
);
router.post(
  "/allowances",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveAllowance,
);

// Loans
router.get("/loans", requireAuth, requireCompanyScope, hrController.listLoans);
router.post(
  "/loans",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveLoan,
);

// Payroll
router.get(
  "/payroll/periods",
  requireAuth,
  requireCompanyScope,
  hrController.listPayrollPeriods,
);
router.post(
  "/payroll/periods",
  requireAuth,
  requireCompanyScope,
  hrController.savePayrollPeriod,
);
router.post(
  "/payroll/generate",
  requireAuth,
  requireCompanyScope,
  hrController.generatePayroll,
);
router.post(
  "/payroll/close",
  requireAuth,
  requireCompanyScope,
  hrController.closePayroll,
);
router.get(
  "/payroll/breakdown",
  requireAuth,
  requireCompanyScope,
  hrController.getPayrollBreakdown,
);
router.post(
  "/payroll/backfill-tier3",
  requireAuth,
  requireCompanyScope,
  hrController.backfillTier3,
);

// Loan Types (Setup)
router.get(
  "/loan-types",
  requireAuth,
  requireCompanyScope,
  hrController.listLoanTypes,
);
router.post(
  "/loan-types",
  requireAuth,
  requireCompanyScope,
  hrController.saveLoanType,
);

// Salary Components Registry
router.get(
  "/salary-components",
  requireAuth,
  requireCompanyScope,
  hrController.listSalaryComponents,
);
router.post(
  "/salary-components/map-account",
  requireAuth,
  requireCompanyScope,
  hrController.mapSalaryComponentAccount,
);


// Payslips
router.get(
  "/payslips",
  requireAuth,
  requireCompanyScope,
  hrController.listPayslips,
);
router.post(
  "/payslips/send-email-bulk",
  requireAuth,
  requireCompanyScope,
  hrController.sendEmailBulk,
);
router.post(
  "/payslips/send-email",
  requireAuth,
  requireCompanyScope,
  hrController.sendPayslipEmail,
);

// ============ PERFORMANCE MANAGEMENT ============

// KPI Categories
router.get("/performance/kpi-categories", requireAuth, requireCompanyScope, perfController.listKpiCategories);
router.post("/performance/kpi-categories", requireAuth, requireCompanyScope, perfController.saveKpiCategory);
router.delete("/performance/kpi-categories/:id", requireAuth, requireCompanyScope, perfController.deleteKpiCategory);

// KPI Management
router.get("/performance/kpis", requireAuth, requireCompanyScope, perfController.listKpis);
router.get("/performance/kpis/:id", requireAuth, requireCompanyScope, perfController.getKpi);
router.post("/performance/kpis", requireAuth, requireCompanyScope, perfController.saveKpi);
router.delete("/performance/kpis/:id", requireAuth, requireCompanyScope, perfController.deleteKpi);
router.post("/performance/kpis/clone", requireAuth, requireCompanyScope, perfController.cloneKpi);

// KPI Assignments
router.get("/performance/kpi-assignments", requireAuth, requireCompanyScope, perfController.listKpiAssignments);
router.post("/performance/kpi-assignments", requireAuth, requireCompanyScope, perfController.saveKpiAssignment);
router.delete("/performance/kpi-assignments/:id", requireAuth, requireCompanyScope, perfController.deleteKpiAssignment);

// Appraisals
router.get("/performance/appraisals", requireAuth, requireCompanyScope, perfController.listAppraisals);
router.get("/performance/appraisals/:id", requireAuth, requireCompanyScope, perfController.getAppraisal);
router.post("/performance/appraisals", requireAuth, requireCompanyScope, perfController.saveAppraisal);
router.post("/performance/appraisals/:id/action", requireAuth, requireCompanyScope, perfController.submitAppraisal);
router.get("/performance/dashboard", requireAuth, requireCompanyScope, perfController.getAppraisalDashboard);
router.post("/performance/attachments", requireAuth, requireCompanyScope, perfController.uploadAttachment);

// ============ TRAINING MANAGEMENT ============

// Training Programs
router.get("/training/programs", requireAuth, requireCompanyScope, trainController.listTrainingPrograms);
router.get("/training/programs/:id", requireAuth, requireCompanyScope, trainController.getTrainingProgram);
router.post("/training/programs", requireAuth, requireCompanyScope, trainController.saveTrainingProgram);
router.delete("/training/programs/:id", requireAuth, requireCompanyScope, trainController.deleteTrainingProgram);

// Training Assignments
router.get("/training/assignments", requireAuth, requireCompanyScope, trainController.listTrainingAssignments);
router.post("/training/assignments", requireAuth, requireCompanyScope, trainController.saveTrainingAssignment);
router.delete("/training/assignments/:id", requireAuth, requireCompanyScope, trainController.deleteTrainingAssignment);

// Training Attendance
router.get("/training/attendance", requireAuth, requireCompanyScope, trainController.listTrainingAttendance);
router.post("/training/attendance", requireAuth, requireCompanyScope, trainController.saveTrainingAttendance);

// Training History
router.get("/training/history", requireAuth, requireCompanyScope, trainController.listTrainingHistory);

// Certifications
router.get("/training/certifications", requireAuth, requireCompanyScope, trainController.listCertifications);
router.post("/training/certifications", requireAuth, requireCompanyScope, trainController.saveCertification);
router.delete("/training/certifications/:id", requireAuth, requireCompanyScope, trainController.deleteCertification);

// Training Dashboard
router.get("/training/dashboard", requireAuth, requireCompanyScope, trainController.getTrainingDashboard);

// Compliance
router.get(
  "/policies",
  requireAuth,
  requireCompanyScope,
  hrController.listPolicies,
);
router.post(
  "/policies",
  requireAuth,
  requireCompanyScope,
  hrController.savePolicy,
);
router.get(
  "/medical-policies",
  requireAuth,
  requireCompanyScope,
  hrController.listMedicalPolicies,
);
router.post(
  "/medical-policies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  hrController.saveMedicalPolicy,
);
router.get(
  "/medical-policies/:id",
  requireAuth,
  requireCompanyScope,
  hrController.getMedicalPolicy,
);
router.post(
  "/policies/acknowledge",
  requireAuth,
  requireCompanyScope,
  hrController.acknowledgePolicy,
);

// Exit & Clearance
router.get("/exits", requireAuth, requireCompanyScope, hrController.listExits);
router.post("/exits", requireAuth, requireCompanyScope, hrController.saveExit);
router.get(
  "/clearance",
  requireAuth,
  requireCompanyScope,
  hrController.listClearance,
);
router.post(
  "/clearance/update",
  requireAuth,
  requireCompanyScope,
  hrController.updateClearance,
);

// HR Reports
router.get(
  "/reports/employees",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployees,
);
router.get(
  "/reports/ssf",
  requireAuth,
  requireCompanyScope,
  hrController.reportSSF,
);
router.get(
  "/reports/paye",
  requireAuth,
  requireCompanyScope,
  hrController.reportPAYE,
);
router.get(
  "/reports/loans",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployeeLoans,
);
router.get(
  "/reports/allowances",
  requireAuth,
  requireCompanyScope,
  hrController.reportEmployeeAllowances,
);

// ===== DASHBOARD METRICS (detailed dashboard page) =====
router.get("/dashboard/metrics", requireAuth, requireCompanyScope, async (req, res, next) => {
  try {
    const { companyId = null } = req.scope || {};
    const year = Number(req.query.year) || new Date().getFullYear();
    const whereCompany = { companyId };

    const [totalEmp] = await query("SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND deleted_at IS NULL", whereCompany).catch(() => [{ count: 0 }]);
    const [newEmp] = await query("SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND YEAR(created_at) = :year AND deleted_at IS NULL", { ...whereCompany, year }).catch(() => [{ count: 0 }]);
    const [confirmations] = await query("SELECT COUNT(*) as count FROM hr_performance_reviews WHERE company_id = :companyId AND YEAR(created_at) = :year AND review_type = 'CONFIRMATION'", { ...whereCompany, year }).catch(() => [{ count: 0 }]);
    const [male] = await query("SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND gender = 'MALE' AND deleted_at IS NULL", whereCompany).catch(() => [{ count: 0 }]);
    const [female] = await query("SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND gender = 'FEMALE' AND deleted_at IS NULL", whereCompany).catch(() => [{ count: 0 }]);
    const [tenure] = await query("SELECT ROUND(AVG(DATEDIFF(CURDATE(), joining_date) / 365.25), 1) as avg_tenure FROM hr_employees WHERE company_id = :companyId AND joining_date IS NOT NULL AND deleted_at IS NULL", whereCompany).catch(() => [{ avg_tenure: 0 }]);

    // Attrition: employees who left in the year / total active at start
    const [attrition] = await query(`SELECT ROUND(
      (SELECT COUNT(*) FROM hr_employees WHERE company_id = :companyId AND YEAR(deleted_at) = :year AND deleted_at IS NOT NULL)
      /
      GREATEST((SELECT COUNT(*) FROM hr_employees WHERE company_id = :companyId AND deleted_at IS NULL), 1) * 100, 1
    ) as rate`, { ...whereCompany, year }).catch(() => [{ rate: 0 }]);

    // Category pie
    const categoryPie = await query("SELECT ec.category_name as label, COUNT(*) as value FROM hr_employees e JOIN hr_employee_categories ec ON ec.id = e.category_id WHERE e.company_id = :companyId AND e.deleted_at IS NULL GROUP BY ec.category_name ORDER BY value DESC", whereCompany).catch(() => []);

    // Location pie
    const locationPie = await query("SELECT l.location_name as label, COUNT(*) as value FROM hr_employees e JOIN hr_locations l ON l.id = e.location_id WHERE e.company_id = :companyId AND e.deleted_at IS NULL GROUP BY l.location_name ORDER BY value DESC", whereCompany).catch(() => []);

    // Employee type bar
    const typeBar = await query("SELECT employment_type as label, COUNT(*) as value FROM hr_employees WHERE company_id = :companyId AND deleted_at IS NULL GROUP BY employment_type ORDER BY value DESC", whereCompany).catch(() => []);

    // Department bar
    const departmentBar = await query("SELECT d.dept_name as label, COUNT(*) as value FROM hr_employees e JOIN hr_departments d ON d.id = e.dept_id WHERE e.company_id = :companyId AND e.deleted_at IS NULL GROUP BY d.dept_name ORDER BY value DESC", whereCompany).catch(() => []);

    // Status bar
    const statusBar = await query("SELECT status as label, COUNT(*) as value FROM hr_employees WHERE company_id = :companyId AND deleted_at IS NULL GROUP BY status ORDER BY value DESC", whereCompany).catch(() => []);

    // Confirmations by department
    const confirmationsByDept = await query(`SELECT d.dept_name as label, COUNT(*) as value FROM hr_performance_reviews pr JOIN hr_employees e ON e.id = pr.employee_id JOIN hr_departments d ON d.id = e.dept_id WHERE pr.company_id = :companyId AND YEAR(pr.created_at) = :year AND pr.review_type = 'CONFIRMATION' GROUP BY d.dept_name ORDER BY value DESC`, { ...whereCompany, year }).catch(() => []);

    // Monthly joiners trend
    const monthlyJoiners = await query(`SELECT DATE_FORMAT(created_at, '%b') as label, MONTH(created_at) as m, COUNT(*) as value FROM hr_employees WHERE company_id = :companyId AND YEAR(created_at) = :year AND deleted_at IS NULL GROUP BY MONTH(created_at), label ORDER BY m ASC`, { ...whereCompany, year }).catch(() => []);

    res.json({
      cards: {
        total_employees: totalEmp.count,
        new_employees_year: newEmp.count,
        confirmations_year: confirmations.count,
        male_count: male.count,
        female_count: female.count,
        average_tenure_years: tenure.avg_tenure,
        attrition_rate: attrition.rate,
      },
      category_pie: categoryPie.map(r => ({ label: r.label, value: Number(r.value) })),
      location_pie: locationPie.map(r => ({ label: r.label, value: Number(r.value) })),
      employee_type_bar: typeBar.map(r => ({ label: r.label, value: Number(r.value) })),
      department_bar: departmentBar.map(r => ({ label: r.label, value: Number(r.value) })),
      status_bar: statusBar.map(r => ({ label: r.label, value: Number(r.value) })),
      confirmations_by_department: confirmationsByDept.map(r => ({ label: r.label, value: Number(r.value) })),
      monthly_joiners_trend: monthlyJoiners.map(r => ({ label: r.label, value: Number(r.value) })),
    });
  } catch (err) {
    next(err);
  }
});

// ===== DASHBOARD STATS =====
router.get("/dashboard-stats", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
    const [employees] = await query(
      "SELECT COUNT(*) as count FROM hr_employees WHERE company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) AND status IN ('ACTIVE','PROBATION') AND deleted_at IS NULL",
      { companyId, branchId, branchIdsStr },
    ).catch(() => [{ count: 0 }]);
    const [onLeave] = await query(
      "SELECT COUNT(*) as count FROM hr_attendance WHERE company_id = :companyId AND attendance_date = CURDATE() AND status = 'ON_LEAVE'",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [attendance] = await query(
      "SELECT COUNT(*) as count FROM hr_attendance WHERE company_id = :companyId AND attendance_date = CURDATE() AND status IN ('PRESENT','LATE')",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [pendingLeave] = await query(
      "SELECT COUNT(*) as count FROM hr_leave_requests WHERE company_id = :companyId AND status IN ('PENDING','SUBMITTED')",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    const [depts] = await query(
      "SELECT COUNT(*) as count FROM hr_departments WHERE company_id = :companyId AND is_active = 1",
      { companyId },
    ).catch(() => [{ count: 0 }]);
    let payrollStatus = "None";
    try {
      const [pr] = await query(
        `SELECT pp.status FROM hr_payroll_periods pp
         WHERE pp.company_id = :companyId
         ORDER BY pp.start_date DESC LIMIT 1`,
        { companyId },
      );
      if (pr) payrollStatus = pr.status;
    } catch {}
    res.json({
      success: true,
      data: {
        activeEmployees: employees.count,
        onLeaveToday: onLeave.count,
        presentToday: attendance.count,
        pendingLeaveRequests: pendingLeave.count,
        departmentsCount: depts.count,
        payrollStatus,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
