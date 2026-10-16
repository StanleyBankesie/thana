/**
 * @file finance.budget.controller.js
 * @description Enterprise Controller for Finance Budget Management, Approval Workflows,
 * Revisions, Budget vs. Actual Reporting, Transaction Drilldown, and Pre-check Controls.
 */

import { query } from "../db/pool.js";
import {
  getActualCostsByDimensions,
  getCommittedCosts,
  checkBudgetAvailability as engineCheckAvailability,
  getTransactionDrilldown as engineGetDrilldown,
} from "../services/budgetEngine.js";

/**
 * 1. List Budgets with multi-dimensional filters
 */
export const listBudgets = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const { fiscal_year_id, project_id, department_id, cost_center_id, budget_type, status } = req.query;

    if (!companyId) {
      return res.status(400).json({ error: "Company scope required" });
    }

    let whereClauses = ["b.company_id = :companyId"];
    const params = { companyId };

    if (fiscal_year_id) {
      whereClauses.push("b.fiscal_year_id = :fiscal_year_id");
      params.fiscal_year_id = Number(fiscal_year_id);
    }
    if (project_id) {
      whereClauses.push("b.project_id = :project_id");
      params.project_id = Number(project_id);
    }
    if (department_id) {
      whereClauses.push("b.department_id = :department_id");
      params.department_id = Number(department_id);
    }
    if (cost_center_id) {
      whereClauses.push("b.cost_center_id = :cost_center_id");
      params.cost_center_id = Number(cost_center_id);
    }
    if (budget_type) {
      whereClauses.push("b.budget_type = :budget_type");
      params.budget_type = budget_type;
    }
    if (status) {
      whereClauses.push("b.status = :status");
      params.status = status;
    }

    const sql = `
      SELECT 
        b.*,
        fy.code AS fiscal_year_code,
        cc.name AS cost_center_name,
        p.project_name,
        p.project_code,
        d.name AS department_name,
        cur.code AS currency_code,
        u_creator.name AS creator_name,
        u_approver.name AS approver_name,
        COUNT(bl.id) AS line_count,
        COALESCE(SUM(bl.budget_amount), b.total_budget, 0) AS calculated_total
      FROM fin_budgets b
      LEFT JOIN fin_fiscal_years fy ON fy.id = b.fiscal_year_id
      LEFT JOIN fin_cost_centers cc ON cc.id = b.cost_center_id
      LEFT JOIN pm_projects p ON p.id = b.project_id
      LEFT JOIN adm_departments d ON d.id = b.department_id
      LEFT JOIN fin_currencies cur ON cur.id = b.currency_id
      LEFT JOIN adm_users u_creator ON u_creator.id = b.created_by
      LEFT JOIN adm_users u_approver ON u_approver.id = b.approved_by
      LEFT JOIN fin_budget_lines bl ON bl.budget_id = b.id
      WHERE ${whereClauses.join(" AND ")}
      GROUP BY b.id
      ORDER BY b.id DESC
    `;

    const budgets = await query(sql, params);

    res.json({ status: "success", data: budgets });
  } catch (err) {
    next(err);
  }
};

/**
 * 2. Get Single Budget Details with lines and revision history
 */
export const getBudgetById = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);

    const [budget] = await query(
      `SELECT 
        b.*, 
        fy.code AS fiscal_year_code,
        cc.name AS cost_center_name,
        p.project_name,
        p.project_code,
        d.name AS department_name,
        cur.code AS currency_code,
        u_creator.name AS creator_name,
        u_approver.name AS approver_name
       FROM fin_budgets b
       LEFT JOIN fin_fiscal_years fy ON fy.id = b.fiscal_year_id
       LEFT JOIN fin_cost_centers cc ON cc.id = b.cost_center_id
       LEFT JOIN pm_projects p ON p.id = b.project_id
       LEFT JOIN adm_departments d ON d.id = b.department_id
       LEFT JOIN fin_currencies cur ON cur.id = b.currency_id
       LEFT JOIN adm_users u_creator ON u_creator.id = b.created_by
       LEFT JOIN adm_users u_approver ON u_approver.id = b.approved_by
       WHERE b.id = :id AND b.company_id = :companyId`,
      { id, companyId }
    );

    if (!budget) {
      return res.status(404).json({ error: "Budget not found" });
    }

    const lines = await query(
      `SELECT 
        bl.*, 
        a.code AS account_code, 
        a.name AS account_name, 
        g.name AS group_name,
        g.nature AS account_nature, 
        cc.name AS cost_center_name,
        p.project_name,
        d.name AS department_name
       FROM fin_budget_lines bl
       JOIN fin_accounts a ON a.id = bl.account_id
       LEFT JOIN fin_account_groups g ON g.id = a.group_id
       LEFT JOIN fin_cost_centers cc ON cc.id = bl.cost_center_id
       LEFT JOIN pm_projects p ON p.id = bl.project_id
       LEFT JOIN adm_departments d ON d.id = bl.department_id
       WHERE bl.budget_id = :id
       ORDER BY a.code ASC, bl.period_month ASC`,
      { id }
    );

    const revisions = await query(
      `SELECT r.*, u.name as revised_by_name 
       FROM fin_budget_revisions r
       LEFT JOIN adm_users u ON u.id = r.revised_by
       WHERE r.budget_id = :id 
       ORDER BY r.revision_no DESC`,
      { id }
    );

    res.json({
      status: "success",
      data: {
        ...budget,
        lines,
        revisions,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 3. Create Draft Budget
 */
export const createBudget = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const userId = Number(req.user?.sub || req.user?.id);
    const {
      fiscal_year_id,
      budget_code,
      budget_name,
      cost_center_id,
      department_id,
      project_id,
      currency_id,
      budget_type,
      start_date,
      end_date,
      description,
      notes,
      lines,
    } = req.body;

    if (!fiscal_year_id || !budget_name) {
      return res.status(400).json({ error: "Fiscal year and budget name are required" });
    }

    const code =
      budget_code?.trim() ||
      `BUD-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    let totalBudget = 0;
    if (Array.isArray(lines)) {
      totalBudget = lines.reduce((acc, l) => acc + (Number(l.budget_amount) || 0), 0);
    }

    const result = await query(
      `INSERT INTO fin_budgets 
       (company_id, branch_id, fiscal_year_id, budget_code, budget_name, cost_center_id, department_id, project_id, currency_id, budget_type, start_date, end_date, description, notes, total_budget, status, created_by)
       VALUES (:companyId, :branchId, :fiscal_year_id, :code, :budget_name, :cost_center_id, :department_id, :project_id, :currency_id, :budget_type, :start_date, :end_date, :description, :notes, :totalBudget, 'DRAFT', :userId)`,
      {
        companyId,
        branchId: branchId || null,
        fiscal_year_id: Number(fiscal_year_id),
        code,
        budget_name,
        cost_center_id: cost_center_id ? Number(cost_center_id) : null,
        department_id: department_id ? Number(department_id) : null,
        project_id: project_id ? Number(project_id) : null,
        currency_id: currency_id ? Number(currency_id) : null,
        budget_type: budget_type || "OPEX",
        start_date: start_date || null,
        end_date: end_date || null,
        description: description || null,
        notes: notes || null,
        totalBudget,
        userId: userId || null,
      }
    );

    const budgetId = result.insertId;

    if (Array.isArray(lines) && lines.length > 0) {
      for (const line of lines) {
        if (!line.account_id) continue;
        await query(
          `INSERT INTO fin_budget_lines 
           (budget_id, account_id, cost_center_id, project_id, department_id, period_month, description, planned_quantity, unit_cost, budget_amount, notes)
           VALUES (:budgetId, :accountId, :costCenterId, :projectId, :departmentId, :periodMonth, :description, :plannedQty, :unitCost, :amount, :notes)`,
          {
            budgetId,
            accountId: Number(line.account_id),
            costCenterId: line.cost_center_id ? Number(line.cost_center_id) : (cost_center_id ? Number(cost_center_id) : null),
            projectId: line.project_id ? Number(line.project_id) : (project_id ? Number(project_id) : null),
            departmentId: line.department_id ? Number(line.department_id) : (department_id ? Number(department_id) : null),
            periodMonth: line.period_month ? Number(line.period_month) : null,
            description: line.description || null,
            plannedQty: Number(line.planned_quantity) || 0,
            unitCost: Number(line.unit_cost) || 0,
            amount: Number(line.budget_amount) || 0,
            notes: line.notes || null,
          }
        );
      }
    }

    res.status(201).json({ status: "success", data: { id: budgetId, budget_code: code } });
  } catch (err) {
    next(err);
  }
};

/**
 * 4. Update Draft Budget
 */
export const updateBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    const {
      fiscal_year_id,
      budget_name,
      cost_center_id,
      department_id,
      project_id,
      currency_id,
      budget_type,
      start_date,
      end_date,
      description,
      notes,
      lines,
    } = req.body;

    const [existing] = await query(
      `SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    if (!existing) {
      return res.status(404).json({ error: "Budget not found" });
    }

    if (existing.status === "APPROVED" || existing.status === "ACTIVE") {
      return res.status(400).json({
        error: "Approved budgets cannot be modified directly. Please use the revision / amendment process.",
      });
    }

    let totalBudget = 0;
    if (Array.isArray(lines)) {
      totalBudget = lines.reduce((acc, l) => acc + (Number(l.budget_amount) || 0), 0);
    }

    await query(
      `UPDATE fin_budgets 
       SET fiscal_year_id = COALESCE(:fiscal_year_id, fiscal_year_id),
           budget_name = COALESCE(:budget_name, budget_name),
           cost_center_id = :cost_center_id,
           department_id = :department_id,
           project_id = :project_id,
           currency_id = :currency_id,
           budget_type = COALESCE(:budget_type, budget_type),
           start_date = :start_date,
           end_date = :end_date,
           description = :description,
           notes = :notes,
           total_budget = :totalBudget
       WHERE id = :id AND company_id = :companyId`,
      {
        id,
        companyId,
        fiscal_year_id: fiscal_year_id ? Number(fiscal_year_id) : null,
        budget_name: budget_name || null,
        cost_center_id: cost_center_id ? Number(cost_center_id) : null,
        department_id: department_id ? Number(department_id) : null,
        project_id: project_id ? Number(project_id) : null,
        currency_id: currency_id ? Number(currency_id) : null,
        budget_type: budget_type || null,
        start_date: start_date || null,
        end_date: end_date || null,
        description: description || null,
        notes: notes || null,
        totalBudget,
      }
    );

    if (Array.isArray(lines)) {
      await query(`DELETE FROM fin_budget_lines WHERE budget_id = :id`, { id });
      for (const line of lines) {
        if (!line.account_id) continue;
        await query(
          `INSERT INTO fin_budget_lines 
           (budget_id, account_id, cost_center_id, project_id, department_id, period_month, description, planned_quantity, unit_cost, budget_amount, notes)
           VALUES (:budgetId, :accountId, :costCenterId, :projectId, :departmentId, :periodMonth, :description, :plannedQty, :unitCost, :amount, :notes)`,
          {
            budgetId: id,
            accountId: Number(line.account_id),
            costCenterId: line.cost_center_id ? Number(line.cost_center_id) : (cost_center_id ? Number(cost_center_id) : null),
            projectId: line.project_id ? Number(line.project_id) : (project_id ? Number(project_id) : null),
            departmentId: line.department_id ? Number(line.department_id) : (department_id ? Number(department_id) : null),
            periodMonth: line.period_month ? Number(line.period_month) : null,
            description: line.description || null,
            plannedQty: Number(line.planned_quantity) || 0,
            unitCost: Number(line.unit_cost) || 0,
            amount: Number(line.budget_amount) || 0,
            notes: line.notes || null,
          }
        );
      }
    }

    res.json({ status: "success", message: "Budget updated successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * 5. Submit Budget for Approval
 */
export const submitBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    const userId = Number(req.user?.sub || req.user?.id);

    const [budget] = await query(
      `SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    if (budget.status !== "DRAFT" && budget.status !== "REJECTED") {
      return res.status(400).json({ error: `Cannot submit budget with status ${budget.status}` });
    }

    await query(
      `UPDATE fin_budgets 
       SET status = 'PENDING_APPROVAL', submitted_by = :userId, submitted_at = NOW()
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, userId }
    );

    res.json({ status: "success", message: "Budget submitted for approval" });
  } catch (err) {
    next(err);
  }
};

/**
 * 6. Approve Budget (Becomes official baseline)
 */
export const approveBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    const userId = Number(req.user?.sub || req.user?.id);

    const [budget] = await query(
      `SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    // Segregation of duties: Creator cannot approve own budget unless super admin
    const isSuper = req.user?.is_super_admin || req.user?.role === "SUPER_ADMIN";
    if (!isSuper && budget.created_by && Number(budget.created_by) === Number(userId)) {
      return res.status(403).json({
        error: "Segregation of duties violation: You cannot approve a budget you created.",
      });
    }

    await query(
      `UPDATE fin_budgets 
       SET status = 'APPROVED', approved_by = :userId, approved_at = NOW(), rejection_reason = NULL
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, userId }
    );

    // Record baseline revision 0 snapshot
    const lines = await query(`SELECT * FROM fin_budget_lines WHERE budget_id = :id`, { id });
    await query(
      `INSERT INTO fin_budget_revisions (budget_id, revision_no, revised_by, previous_total, new_total, reason, snapshot_data)
       VALUES (:id, 0, :userId, :total, :total, 'Initial Approved Baseline', :snapshot)`,
      {
        id,
        userId,
        total: budget.total_budget,
        snapshot: JSON.stringify({ budget, lines }),
      }
    );

    res.json({ status: "success", message: "Budget approved successfully and locked as baseline." });
  } catch (err) {
    next(err);
  }
};

/**
 * 7. Reject Budget
 */
export const rejectBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    const userId = Number(req.user?.sub || req.user?.id);
    const { reason } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    await query(
      `UPDATE fin_budgets 
       SET status = 'REJECTED', rejected_by = :userId, rejected_at = NOW(), rejection_reason = :reason
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, userId, reason: reason.trim() }
    );

    res.json({ status: "success", message: "Budget rejected with reason recorded" });
  } catch (err) {
    next(err);
  }
};

/**
 * 8. Create Controlled Revision / Amendment for Approved Budget
 */
export const reviseBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);
    const userId = Number(req.user?.sub || req.user?.id);
    const { reason, lines } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Revision justification reason is required" });
    }

    const [budget] = await query(
      `SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    const previousLines = await query(`SELECT * FROM fin_budget_lines WHERE budget_id = :id`, { id });
    const nextRevisionNo = Number(budget.revision_no || 0) + 1;
    const newVersion = `1.${nextRevisionNo}`;

    let newTotal = budget.total_budget;
    if (Array.isArray(lines)) {
      newTotal = lines.reduce((acc, l) => acc + (Number(l.budget_amount) || 0), 0);
    }

    // Snapshot old version into fin_budget_revisions
    await query(
      `INSERT INTO fin_budget_revisions (budget_id, revision_no, revised_by, previous_total, new_total, reason, snapshot_data)
       VALUES (:id, :nextRevisionNo, :userId, :prevTotal, :newTotal, :reason, :snapshot)`,
      {
        id,
        nextRevisionNo,
        userId,
        prevTotal: budget.total_budget,
        newTotal,
        reason: reason.trim(),
        snapshot: JSON.stringify({ budget, lines: previousLines }),
      }
    );

    // Update lines
    if (Array.isArray(lines)) {
      await query(`DELETE FROM fin_budget_lines WHERE budget_id = :id`, { id });
      for (const line of lines) {
        if (!line.account_id) continue;
        await query(
          `INSERT INTO fin_budget_lines 
           (budget_id, account_id, cost_center_id, project_id, department_id, period_month, description, planned_quantity, unit_cost, budget_amount, notes)
           VALUES (:budgetId, :accountId, :costCenterId, :projectId, :departmentId, :periodMonth, :description, :plannedQty, :unitCost, :amount, :notes)`,
          {
            budgetId: id,
            accountId: Number(line.account_id),
            costCenterId: line.cost_center_id ? Number(line.cost_center_id) : null,
            projectId: line.project_id ? Number(line.project_id) : null,
            departmentId: line.department_id ? Number(line.department_id) : null,
            periodMonth: line.period_month ? Number(line.period_month) : null,
            description: line.description || null,
            plannedQty: Number(line.planned_quantity) || 0,
            unitCost: Number(line.unit_cost) || 0,
            amount: Number(line.budget_amount) || 0,
            notes: line.notes || null,
          }
        );
      }
    }

    // Update budget header
    await query(
      `UPDATE fin_budgets 
       SET revision_no = :nextRevisionNo, version = :newVersion, total_budget = :newTotal, status = 'APPROVED'
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, nextRevisionNo, newVersion, newTotal }
    );

    res.json({
      status: "success",
      message: `Budget successfully revised to version ${newVersion} (Revision #${nextRevisionNo})`,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 9. Delete Budget (Protected: Only DRAFT/REJECTED budgets without posted dependencies)
 */
export const deleteBudget = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = Number(req.params.id);

    const [budget] = await query(
      `SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`,
      { id, companyId }
    );
    if (!budget) return res.status(404).json({ error: "Budget not found" });

    if (budget.status === "APPROVED" || budget.status === "ACTIVE") {
      return res.status(400).json({
        error: "Cannot delete an approved active budget. Use Close or Cancel instead to preserve financial audit trail.",
      });
    }

    await query(`DELETE FROM fin_budget_lines WHERE budget_id = :id`, { id });
    await query(`DELETE FROM fin_budget_revisions WHERE budget_id = :id`, { id });
    await query(`DELETE FROM fin_budget_variances WHERE budget_id = :id`, { id });
    await query(`DELETE FROM fin_budgets WHERE id = :id AND company_id = :companyId`, { id, companyId });

    res.json({ status: "success", message: "Budget deleted successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * 10. Executive Budget vs. Actual Dashboard Summary
 */
export const getBudgetVsActualDashboard = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const { fiscal_year_id, budget_id, project_id, department_id, cost_center_id } = req.query;

    if (!companyId) return res.status(400).json({ error: "Company scope required" });

    // 1. Identify Target Fiscal Year
    let targetFiscalYearId = fiscal_year_id ? Number(fiscal_year_id) : null;
    let fy = null;
    if (targetFiscalYearId) {
      const fyRows = await query(`SELECT * FROM fin_fiscal_years WHERE id = :id AND company_id = :companyId`, { id: targetFiscalYearId, companyId });
      fy = fyRows[0] || null;
    } else {
      const fyRows = await query(`SELECT * FROM fin_fiscal_years WHERE company_id = :companyId ORDER BY is_open DESC, start_date DESC LIMIT 1`, { companyId });
      fy = fyRows[0] || null;
      targetFiscalYearId = fy?.id || null;
    }

    // 2. Fetch Budget Header
    let budgetQuery = `
      SELECT b.* 
      FROM fin_budgets b
      WHERE b.company_id = :companyId
        ${budget_id ? "AND b.id = :budgetId" : ""}
        ${targetFiscalYearId ? "AND b.fiscal_year_id = :targetFiscalYearId" : ""}
        ${project_id ? "AND b.project_id = :projectId" : ""}
        AND b.status IN ('APPROVED', 'ACTIVE')
      ORDER BY b.id DESC LIMIT 1
    `;
    const bRows = await query(budgetQuery, {
      companyId,
      budgetId: budget_id ? Number(budget_id) : null,
      targetFiscalYearId,
      projectId: project_id ? Number(project_id) : null,
    });
    const selectedBudget = bRows[0] || null;

    // 3. Fetch Approved Budget Lines Total
    let totalApprovedBudget = Number(selectedBudget?.total_budget || 0);

    // 4. Fetch Actual Costs via Engine
    const actualList = await getActualCostsByDimensions({
      companyId,
      branchId,
      fiscalYearId: targetFiscalYearId,
      budgetId: selectedBudget?.id,
      projectId: project_id ? Number(project_id) : null,
      departmentId: department_id ? Number(department_id) : null,
      costCenterId: cost_center_id ? Number(cost_center_id) : null,
      fromDate: fy?.start_date,
      toDate: fy?.end_date,
    });

    const actualExpense = actualList
      .filter((r) => r.account_nature === "EXPENSE")
      .reduce((sum, r) => sum + r.actual_amount, 0);

    const actualIncome = actualList
      .filter((r) => r.account_nature === "INCOME")
      .reduce((sum, r) => sum + r.actual_amount, 0);

    // 5. Fetch Committed Costs
    const commitmentData = await getCommittedCosts({
      companyId,
      branchId,
      projectId: project_id ? Number(project_id) : null,
      costCenterId: cost_center_id ? Number(cost_center_id) : null,
    });
    const totalCommitted = commitmentData.total_committed || 0;

    // 6. Forecast & Indicators
    const totalActualCost = actualExpense;
    const budgetRemaining = totalApprovedBudget - totalActualCost;
    const utilizationPct = totalApprovedBudget > 0 ? (totalActualCost / totalApprovedBudget) * 100 : 0;
    const forecastFinalCost = totalActualCost + totalCommitted;
    const forecastVariance = totalApprovedBudget - forecastFinalCost;
    const overBudgetAmount = Math.max(0, totalActualCost - totalApprovedBudget);
    const forecastOverrun = Math.max(0, forecastFinalCost - totalApprovedBudget);

    // 7. Monthly Expenditure Trend (12 Months)
    const monthlyActuals = await query(
      `SELECT 
        MONTH(v.voucher_date) as month_num,
        SUM(CASE WHEN g.nature = 'EXPENSE' THEN vl.debit - vl.credit ELSE 0 END) as monthly_expense,
        SUM(CASE WHEN g.nature = 'INCOME' THEN vl.credit - vl.debit ELSE 0 END) as monthly_income
       FROM fin_voucher_lines vl
       JOIN fin_vouchers v ON v.id = vl.voucher_id
       JOIN fin_accounts a ON a.id = vl.account_id
       JOIN fin_account_groups g ON g.id = a.group_id
       WHERE v.company_id = :companyId
         AND (v.status = 'POSTED' OR v.status IS NULL)
         ${targetFiscalYearId && fy?.start_date ? "AND DATE(v.voucher_date) >= :start" : ""}
         ${targetFiscalYearId && fy?.end_date ? "AND DATE(v.voucher_date) <= :end" : ""}
       GROUP BY MONTH(v.voucher_date)
       ORDER BY month_num ASC`,
      {
        companyId,
        start: fy?.start_date ? String(fy.start_date).substring(0, 10) : null,
        end: fy?.end_date ? String(fy.end_date).substring(0, 10) : null,
      }
    );

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const monthlyTrends = monthNames.map((name, idx) => {
      const found = monthlyActuals.find((m) => Number(m.month_num) === idx + 1);
      const monthlyBudget = totalApprovedBudget > 0 ? totalApprovedBudget / 12 : 0;
      return {
        month: name,
        month_num: idx + 1,
        budget: Math.round(monthlyBudget * 100) / 100,
        actual_expense: Math.round(Number(found?.monthly_expense || 0) * 100) / 100,
        actual_income: Math.round(Number(found?.monthly_income || 0) * 100) / 100,
      };
    });

    // 8. Top Overruns
    const overruns = actualList
      .filter((r) => r.account_nature === "EXPENSE" && r.actual_amount > 0)
      .sort((a, b) => b.actual_amount - a.actual_amount)
      .slice(0, 5);

    res.json({
      status: "success",
      data: {
        fiscal_year: fy,
        budget: selectedBudget,
        kpis: {
          approved_budget: Math.round(totalApprovedBudget * 100) / 100,
          actual_cost: Math.round(totalActualCost * 100) / 100,
          budget_remaining: Math.round(budgetRemaining * 100) / 100,
          utilization_pct: Math.round(utilizationPct * 10) / 10,
          committed_cost: Math.round(totalCommitted * 100) / 100,
          forecast_final_cost: Math.round(forecastFinalCost * 100) / 100,
          forecast_variance: Math.round(forecastVariance * 100) / 100,
          over_budget_amount: Math.round(overBudgetAmount * 100) / 100,
          forecast_overrun: Math.round(forecastOverrun * 100) / 100,
          actual_income: Math.round(actualIncome * 100) / 100,
          net_operating_profit: Math.round((actualIncome - totalActualCost) * 100) / 100,
        },
        monthly_trends: monthlyTrends,
        top_overruns: overruns,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 11. Tabular Budget vs. Actual Report
 */
export const getBudgetVsActualReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const { fiscal_year_id, budget_id, project_id, department_id, cost_center_id, period_month, nature, group_id } = req.query;

    if (!companyId) return res.status(400).json({ error: "Company scope required" });

    // 1. Fiscal Year
    let targetFiscalYearId = fiscal_year_id ? Number(fiscal_year_id) : null;
    let fy = null;
    if (targetFiscalYearId) {
      const fyRows = await query(`SELECT * FROM fin_fiscal_years WHERE id = :id AND company_id = :companyId`, { id: targetFiscalYearId, companyId });
      fy = fyRows[0] || null;
    } else {
      const fyRows = await query(`SELECT * FROM fin_fiscal_years WHERE company_id = :companyId ORDER BY is_open DESC, start_date DESC LIMIT 1`, { companyId });
      fy = fyRows[0] || null;
      targetFiscalYearId = fy?.id || null;
    }

    // 2. Budget
    let selectedBudgetId = budget_id ? Number(budget_id) : null;
    let budgetInfo = null;
    if (selectedBudgetId) {
      const bRows = await query(`SELECT * FROM fin_budgets WHERE id = :id AND company_id = :companyId`, { id: selectedBudgetId, companyId });
      budgetInfo = bRows[0] || null;
    } else if (targetFiscalYearId) {
      const bRows = await query(
        `SELECT * FROM fin_budgets WHERE company_id = :companyId AND fiscal_year_id = :fyId AND status IN ('ACTIVE', 'APPROVED') ORDER BY id DESC LIMIT 1`,
        { companyId, fyId: targetFiscalYearId }
      );
      budgetInfo = bRows[0] || null;
      selectedBudgetId = budgetInfo?.id || null;
    }

    const fromDate = req.query.from || fy?.start_date || null;
    const toDate = req.query.to || fy?.end_date || null;

    const params = {
      companyId,
      budgetId: selectedBudgetId || 0,
      fromDate: fromDate ? String(fromDate).substring(0, 10) : null,
      toDate: toDate ? String(toDate).substring(0, 10) : null,
      costCenterId: cost_center_id ? Number(cost_center_id) : null,
      projectId: project_id ? Number(project_id) : null,
      departmentId: department_id ? Number(department_id) : null,
      month: period_month ? Number(period_month) : null,
    };

    let natureFilter = "";
    if (nature && ["INCOME", "EXPENSE", "ASSET", "LIABILITY", "EQUITY"].includes(String(nature).toUpperCase())) {
      natureFilter = `AND g.nature = '${String(nature).toUpperCase()}'`;
    }

    let groupFilter = "";
    if (group_id) {
      groupFilter = `AND a.group_id = ${Number(group_id)}`;
    }

    const reportQuery = `
      SELECT 
        a.id AS account_id,
        a.code AS account_code,
        a.name AS account_name,
        g.id AS group_id,
        g.name AS group_name,
        g.nature AS account_nature,
        COALESCE(b_agg.budget_amount, 0) AS budget_amount,
        COALESCE(act_agg.total_debit, 0) AS total_debit,
        COALESCE(act_agg.total_credit, 0) AS total_credit,
        COALESCE(fc_agg.forecast_cost, 0) AS manual_forecast
      FROM fin_accounts a
      JOIN fin_account_groups g ON g.id = a.group_id
      LEFT JOIN (
        SELECT 
          bl.account_id,
          SUM(bl.budget_amount) AS budget_amount
        FROM fin_budget_lines bl
        JOIN fin_budgets b ON b.id = bl.budget_id
        WHERE b.company_id = :companyId
          AND (:budgetId = 0 OR bl.budget_id = :budgetId)
          AND (:costCenterId IS NULL OR bl.cost_center_id = :costCenterId)
          AND (:projectId IS NULL OR bl.project_id = :projectId)
          AND (:departmentId IS NULL OR bl.department_id = :departmentId)
          AND (:month IS NULL OR bl.period_month = :month)
        GROUP BY bl.account_id
      ) b_agg ON b_agg.account_id = a.id
      LEFT JOIN (
        SELECT 
          vl.account_id,
          SUM(COALESCE(vl.debit, 0)) AS total_debit,
          SUM(COALESCE(vl.credit, 0)) AS total_credit
        FROM fin_voucher_lines vl
        JOIN fin_vouchers v ON v.id = vl.voucher_id
        WHERE v.company_id = :companyId
          AND (v.status = 'POSTED' OR v.status IS NULL OR v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED'))
          AND (:costCenterId IS NULL OR vl.cost_center = :costCenterId OR v.cost_center_id = :costCenterId)
          AND (:projectId IS NULL OR v.project_id = :projectId)
          AND (:fromDate IS NULL OR DATE(v.voucher_date) >= :fromDate)
          AND (:toDate IS NULL OR DATE(v.voucher_date) <= :toDate)
          AND (:month IS NULL OR MONTH(v.voucher_date) = :month)
        GROUP BY vl.account_id
      ) act_agg ON act_agg.account_id = a.id
      LEFT JOIN (
        SELECT 
          account_id,
          SUM(forecast_cost) AS forecast_cost
        FROM fin_budget_forecasts
        WHERE company_id = :companyId
          AND (:budgetId = 0 OR budget_id = :budgetId)
        GROUP BY account_id
      ) fc_agg ON fc_agg.account_id = a.id
      WHERE a.company_id = :companyId
        AND a.is_active = 1
        ${natureFilter}
        ${groupFilter}
        AND (COALESCE(b_agg.budget_amount, 0) > 0 OR COALESCE(act_agg.total_debit, 0) > 0 OR COALESCE(act_agg.total_credit, 0) > 0)
      ORDER BY g.nature, a.code ASC
    `;

    const rows = await query(reportQuery, params);

    let totalBudgetExpense = 0;
    let totalActualExpense = 0;
    let totalBudgetIncome = 0;
    let totalActualIncome = 0;

    const items = rows.map((r) => {
      const budget = Number(r.budget_amount || 0);
      const debit = Number(r.total_debit || 0);
      const credit = Number(r.total_credit || 0);
      const nature = r.account_nature || "EXPENSE";
      const manualForecast = Number(r.manual_forecast || 0);

      let actual = 0;
      let variance = 0;
      let status = "ON_TRACK";

      if (nature === "EXPENSE") {
        actual = debit - credit;
        variance = budget - actual;
        totalBudgetExpense += budget;
        totalActualExpense += actual;
        if (budget > 0) {
          const util = (actual / budget) * 100;
          if (util > 100) status = "OVER_BUDGET";
          else if (util >= 85) status = "NEARING_LIMIT";
          else status = "WITHIN_BUDGET";
        } else if (actual > 0) {
          status = "OVER_BUDGET";
        }
      } else if (nature === "INCOME") {
        actual = credit - debit;
        variance = actual - budget;
        totalBudgetIncome += budget;
        totalActualIncome += actual;
        if (budget > 0) {
          const util = (actual / budget) * 100;
          if (util >= 100) status = "TARGET_EXCEEDED";
          else if (util >= 75) status = "ON_TRACK";
          else status = "BEHIND_TARGET";
        } else if (actual > 0) {
          status = "TARGET_EXCEEDED";
        }
      } else {
        actual = debit - credit;
        variance = budget - actual;
        status = actual <= budget ? "WITHIN_BUDGET" : "OVER_BUDGET";
      }

      const utilizationPct = budget > 0 ? (actual / budget) * 100 : (actual > 0 ? 100 : 0);
      const forecastFinalCost = manualForecast > 0 ? actual + manualForecast : actual;
      const forecastVariance = budget - forecastFinalCost;

      return {
        account_id: r.account_id,
        account_code: r.account_code,
        account_name: r.account_name,
        group_id: r.group_id,
        group_name: r.group_name,
        account_nature: nature,
        budget_amount: Math.round(budget * 100) / 100,
        actual_amount: Math.round(actual * 100) / 100,
        variance_amount: Math.round(variance * 100) / 100,
        utilization_pct: Math.round(utilizationPct * 10) / 10,
        forecast_final_cost: Math.round(forecastFinalCost * 100) / 100,
        forecast_variance: Math.round(forecastVariance * 100) / 100,
        overrun_amount: Math.max(0, actual - budget),
        status,
      };
    });

    res.json({
      status: "success",
      data: {
        fiscal_year: fy,
        budget: budgetInfo,
        date_range: { from: fromDate, to: toDate },
        summary: {
          total_budget_expense: Math.round(totalBudgetExpense * 100) / 100,
          total_actual_expense: Math.round(totalActualExpense * 100) / 100,
          expense_variance: Math.round((totalBudgetExpense - totalActualExpense) * 100) / 100,
          expense_utilization_pct: totalBudgetExpense > 0 ? Math.round((totalActualExpense / totalBudgetExpense) * 1000) / 10 : 0,
          total_budget_income: Math.round(totalBudgetIncome * 100) / 100,
          total_actual_income: Math.round(totalActualIncome * 100) / 100,
          income_variance: Math.round((totalActualIncome - totalBudgetIncome) * 100) / 100,
          net_budget_profit: Math.round((totalBudgetIncome - totalBudgetExpense) * 100) / 100,
          net_actual_profit: Math.round((totalActualIncome - totalActualExpense) * 100) / 100,
        },
        items,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * 12. Transaction Drilldown Endpoint
 */
export const getTransactionDrilldown = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const { account_id, project_id, cost_center_id, from, to, month, limit, offset } = req.query;

    if (!companyId) return res.status(400).json({ error: "Company scope required" });

    const result = await engineGetDrilldown({
      companyId,
      accountId: account_id ? Number(account_id) : null,
      projectId: project_id ? Number(project_id) : null,
      costCenterId: cost_center_id ? Number(cost_center_id) : null,
      fromDate: from,
      toDate: to,
      month: month ? Number(month) : null,
      limit: limit ? Number(limit) : 100,
      offset: offset ? Number(offset) : 0,
    });

    res.json({ status: "success", data: result });
  } catch (err) {
    next(err);
  }
};

/**
 * 13. Pre-flight Budget Availability Check
 */
export const checkBudgetAvailability = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope || {};
    const { fiscal_year_id, account_id, project_id, cost_center_id, department_id, amount, transaction_type } = req.body;

    if (!companyId) return res.status(400).json({ error: "Company scope required" });

    const checkResult = await engineCheckAvailability({
      companyId,
      branchId,
      fiscalYearId: fiscal_year_id ? Number(fiscal_year_id) : null,
      accountId: account_id ? Number(account_id) : null,
      projectId: project_id ? Number(project_id) : null,
      costCenterId: cost_center_id ? Number(cost_center_id) : null,
      departmentId: department_id ? Number(department_id) : null,
      amount: Number(amount) || 0,
      transactionType: transaction_type || "PO",
    });

    res.json({ status: "success", data: checkResult });
  } catch (err) {
    next(err);
  }
};

/**
 * 14. Budget Control Settings Management
 */
export const getBudgetControlSettings = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const [policy] = await query(
      `SELECT * FROM fin_budget_controls WHERE company_id = :companyId`,
      { companyId }
    );
    res.json({
      status: "success",
      data: policy || {
        company_id: companyId,
        policy_type: "WARN_ONLY",
        warning_threshold_pct: 85.0,
        block_threshold_pct: 100.0,
        applies_to_po: true,
        applies_to_expense: true,
        applies_to_vouchers: true,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const updateBudgetControlSettings = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = Number(req.user?.sub || req.user?.id);
    const { policy_type, warning_threshold_pct, block_threshold_pct, applies_to_po, applies_to_expense, applies_to_vouchers } = req.body;

    await query(
      `INSERT INTO fin_budget_controls (company_id, policy_type, warning_threshold_pct, block_threshold_pct, applies_to_po, applies_to_expense, applies_to_vouchers, updated_by)
       VALUES (:companyId, :policyType, :warnPct, :blockPct, :po, :exp, :vouch, :userId)
       ON DUPLICATE KEY UPDATE 
         policy_type = VALUES(policy_type),
         warning_threshold_pct = VALUES(warning_threshold_pct),
         block_threshold_pct = VALUES(block_threshold_pct),
         applies_to_po = VALUES(applies_to_po),
         applies_to_expense = VALUES(applies_to_expense),
         applies_to_vouchers = VALUES(applies_to_vouchers),
         updated_by = VALUES(updated_by)`,
      {
        companyId,
        policyType: policy_type || "WARN_ONLY",
        warnPct: Number(warning_threshold_pct) || 85.0,
        blockPct: Number(block_threshold_pct) || 100.0,
        po: applies_to_po !== false ? 1 : 0,
        exp: applies_to_expense !== false ? 1 : 0,
        vouch: applies_to_vouchers !== false ? 1 : 0,
        userId,
      }
    );

    res.json({ status: "success", message: "Budget control policies updated successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * 15. Variance Explanations & Corrective Actions
 */
export const saveVarianceExplanation = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const userId = Number(req.user?.sub || req.user?.id);
    const { budget_id, account_id, project_id, period_month, variance_amount, explanation, corrective_action, action_owner_id, status } = req.body;

    if (!budget_id || !explanation?.trim()) {
      return res.status(400).json({ error: "Budget ID and explanation are required" });
    }

    const result = await query(
      `INSERT INTO fin_budget_variances 
       (company_id, budget_id, account_id, project_id, period_month, variance_amount, explanation, corrective_action, action_owner_id, status, created_by)
       VALUES (:companyId, :budgetId, :accountId, :projectId, :periodMonth, :varianceAmount, :explanation, :correctiveAction, :actionOwnerId, :status, :userId)`,
      {
        companyId,
        budgetId: Number(budget_id),
        accountId: account_id ? Number(account_id) : null,
        projectId: project_id ? Number(project_id) : null,
        periodMonth: period_month ? Number(period_month) : null,
        varianceAmount: Number(variance_amount) || 0,
        explanation: explanation.trim(),
        correctiveAction: corrective_action || null,
        actionOwnerId: action_owner_id ? Number(action_owner_id) : null,
        status: status || "PENDING",
        userId,
      }
    );

    res.status(201).json({ status: "success", data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

export const getVarianceExplanations = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const { budget_id, account_id, project_id } = req.query;

    let whereClauses = ["v.company_id = :companyId"];
    const params = { companyId };

    if (budget_id) {
      whereClauses.push("v.budget_id = :budgetId");
      params.budgetId = Number(budget_id);
    }
    if (account_id) {
      whereClauses.push("v.account_id = :accountId");
      params.accountId = Number(account_id);
    }
    if (project_id) {
      whereClauses.push("v.project_id = :projectId");
      params.projectId = Number(project_id);
    }

    const rows = await query(
      `SELECT v.*, u.name as creator_name, owner.name as action_owner_name, a.name as account_name, a.code as account_code
       FROM fin_budget_variances v
       LEFT JOIN adm_users u ON u.id = v.created_by
       LEFT JOIN adm_users owner ON owner.id = v.action_owner_id
       LEFT JOIN fin_accounts a ON a.id = v.account_id
       WHERE ${whereClauses.join(" AND ")}
       ORDER BY v.id DESC`,
      params
    );

    res.json({ status: "success", data: rows });
  } catch (err) {
    next(err);
  }
};
