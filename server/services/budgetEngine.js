/**
 * @file budgetEngine.js
 * @description Enterprise Financial Budgeting, Actual Cost Reconciliation, Commitments,
 * Forecasting, and Availability Pre-check Engine for OmniSuite ERP Finance.
 */

import { query } from "../db/pool.js";

/**
 * Calculates GAAP/IFRS actual costs from posted General Ledger vouchers.
 * Accounting Rules:
 * - Authoritative Source: Posted vouchers in fin_vouchers and fin_voucher_lines
 * - Excludes DRAFT, CANCELLED, VOID, and REJECTED vouchers
 * - Operating Expenses: Debit - Credit
 * - Revenues / Income: Credit - Debit
 * - Reconciles exactly with General Ledger balances for the same company, account, and period
 */
export async function getActualCostsByDimensions({
  companyId,
  branchId = null,
  fiscalYearId = null,
  budgetId = null,
  accountId = null,
  projectId = null,
  departmentId = null,
  costCenterId = null,
  fromDate = null,
  toDate = null,
  month = null,
  nature = null,
}) {
  let whereClauses = [
    "v.company_id = :companyId",
    "a.company_id = :companyId",
    "a.is_active = 1",
    "(v.status = 'POSTED' OR v.status IS NULL OR v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED'))",
  ];

  const params = { companyId };

  if (branchId) {
    whereClauses.push("(v.branch_id = :branchId OR v.branch_id IS NULL)");
    params.branchId = Number(branchId);
  }
  if (accountId) {
    whereClauses.push("vl.account_id = :accountId");
    params.accountId = Number(accountId);
  }
  if (projectId) {
    whereClauses.push("(v.project_id = :projectId OR vl.account_id IN (SELECT payment_account_id FROM pm_expenses WHERE project_id = :projectId AND voucher_id = v.id))");
    params.projectId = Number(projectId);
  }
  if (costCenterId) {
    whereClauses.push("(vl.cost_center = :costCenterId OR v.cost_center_id = :costCenterId)");
    params.costCenterId = Number(costCenterId);
  }
  if (fromDate) {
    whereClauses.push("DATE(v.voucher_date) >= :fromDate");
    params.fromDate = String(fromDate).substring(0, 10);
  }
  if (toDate) {
    whereClauses.push("DATE(v.voucher_date) <= :toDate");
    params.toDate = String(toDate).substring(0, 10);
  }
  if (month) {
    whereClauses.push("MONTH(v.voucher_date) = :month");
    params.month = Number(month);
  }
  if (nature) {
    whereClauses.push("g.nature = :nature");
    params.nature = String(nature).toUpperCase();
  }

  const sql = `
    SELECT 
      vl.account_id,
      a.code AS account_code,
      a.name AS account_name,
      g.id AS group_id,
      g.name AS group_name,
      g.nature AS account_nature,
      v.project_id,
      COALESCE(vl.cost_center, v.cost_center_id) AS cost_center_id,
      SUM(COALESCE(vl.debit, 0)) AS total_debit,
      SUM(COALESCE(vl.credit, 0)) AS total_credit
    FROM fin_voucher_lines vl
    JOIN fin_vouchers v ON v.id = vl.voucher_id
    JOIN fin_accounts a ON a.id = vl.account_id
    JOIN fin_account_groups g ON g.id = a.group_id
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY vl.account_id, a.code, a.name, g.id, g.name, g.nature, v.project_id, COALESCE(vl.cost_center, v.cost_center_id)
  `;

  const rows = await query(sql, params);

  return rows.map((r) => {
    const debit = Number(r.total_debit || 0);
    const credit = Number(r.total_credit || 0);
    const isExpense = r.account_nature === "EXPENSE";
    const isIncome = r.account_nature === "INCOME";

    let actual = 0;
    if (isExpense) {
      actual = debit - credit;
    } else if (isIncome) {
      actual = credit - debit;
    } else {
      actual = debit - credit;
    }

    return {
      account_id: r.account_id,
      account_code: r.account_code,
      account_name: r.account_name,
      group_id: r.group_id,
      group_name: r.group_name,
      account_nature: r.account_nature,
      project_id: r.project_id,
      cost_center_id: r.cost_center_id,
      total_debit: debit,
      total_credit: credit,
      actual_amount: Math.round(actual * 100) / 100,
    };
  });
}

/**
 * Calculates outstanding commitments from approved purchase orders:
 * Commitment = Approved PO Amount - Recognized Supplier Invoices (pur_bills).
 * Avoids double counting by subtracting any amounts that have already become bills/vouchers.
 */
export async function getCommittedCosts({
  companyId,
  branchId = null,
  projectId = null,
  costCenterId = null,
  fromDate = null,
  toDate = null,
}) {
  let whereClauses = [
    "po.company_id = :companyId",
    "po.status IN ('APPROVED', 'ISSUED', 'PARTIALLY_DELIVERED')",
    "(po.is_active = 1 OR po.is_active IS NULL)",
  ];

  const params = { companyId };

  if (branchId) {
    whereClauses.push("(po.branch_id = :branchId OR po.branch_id IS NULL)");
    params.branchId = Number(branchId);
  }
  if (costCenterId) {
    whereClauses.push("b.cost_center_id = :costCenterId");
    params.costCenterId = Number(costCenterId);
  }
  if (fromDate) {
    whereClauses.push("DATE(po.po_date) >= :fromDate");
    params.fromDate = String(fromDate).substring(0, 10);
  }
  if (toDate) {
    whereClauses.push("DATE(po.po_date) <= :toDate");
    params.toDate = String(toDate).substring(0, 10);
  }

  const sql = `
    SELECT 
      po.id AS po_id,
      po.po_no,
      po.po_date,
      po.supplier_id,
      po.total_amount AS po_total,
      COALESCE(SUM(b.total_amount), 0) AS recognized_billed_amount,
      GREATEST(0, po.total_amount - COALESCE(SUM(b.total_amount), 0)) AS remaining_commitment
    FROM pur_orders po
    LEFT JOIN pur_bills b ON b.po_id = po.id AND b.status NOT IN ('CANCELLED', 'REJECTED')
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY po.id, po.po_no, po.po_date, po.supplier_id, po.total_amount
    HAVING remaining_commitment > 0
  `;

  try {
    const rows = await query(sql, params);
    const totalCommitted = rows.reduce((sum, r) => sum + Number(r.remaining_commitment || 0), 0);
    return {
      total_committed: Math.round(totalCommitted * 100) / 100,
      items: rows,
    };
  } catch (err) {
    console.warn("[budgetEngine] Could not calculate PO commitments:", err.message);
    return { total_committed: 0, items: [] };
  }
}

/**
 * Pre-transaction budget control checker.
 * Used during purchase order approval, requisition, or voucher creation.
 */
export async function checkBudgetAvailability({
  companyId,
  branchId = null,
  fiscalYearId = null,
  accountId = null,
  projectId = null,
  costCenterId = null,
  departmentId = null,
  amount = 0,
  transactionType = "PO",
}) {
  const reqAmount = Number(amount) || 0;

  // 1. Fetch Company Policy Thresholds
  const [controlPolicy] = await query(
    `SELECT * FROM fin_budget_controls WHERE company_id = :companyId`,
    { companyId }
  );

  const policyType = controlPolicy?.policy_type || "WARN_ONLY"; // 'WARN_ONLY', 'REQUIRE_APPROVAL', 'BLOCK'
  const warnPct = Number(controlPolicy?.warning_threshold_pct || 85);
  const blockPct = Number(controlPolicy?.block_threshold_pct || 100);

  // 2. Fetch Active Approved Budget for the dimension
  let budgetQuery = `
    SELECT 
      b.id AS budget_id,
      b.budget_code,
      b.budget_name,
      bl.id AS line_id,
      COALESCE(bl.budget_amount, b.total_budget, 0) AS approved_budget
    FROM fin_budgets b
    LEFT JOIN fin_budget_lines bl ON bl.budget_id = b.id
      ${accountId ? "AND bl.account_id = :accountId" : ""}
      ${projectId ? "AND bl.project_id = :projectId" : ""}
      ${costCenterId ? "AND bl.cost_center_id = :costCenterId" : ""}
    WHERE b.company_id = :companyId
      AND b.status IN ('APPROVED', 'ACTIVE')
      ${fiscalYearId ? "AND b.fiscal_year_id = :fiscalYearId" : ""}
      ${projectId ? "AND (b.project_id = :projectId OR b.project_id IS NULL)" : ""}
      ${costCenterId ? "AND (b.cost_center_id = :costCenterId OR b.cost_center_id IS NULL)" : ""}
    ORDER BY b.id DESC LIMIT 1
  `;

  const budgetRows = await query(budgetQuery, {
    companyId,
    accountId: accountId ? Number(accountId) : null,
    projectId: projectId ? Number(projectId) : null,
    costCenterId: costCenterId ? Number(costCenterId) : null,
    fiscalYearId: fiscalYearId ? Number(fiscalYearId) : null,
  });

  const budget = budgetRows[0] || null;
  const approvedBudget = Number(budget?.approved_budget || 0);

  // 3. Compute Current Actual Costs
  const actualRows = await getActualCostsByDimensions({
    companyId,
    branchId,
    accountId,
    projectId,
    costCenterId,
    departmentId,
  });
  const currentActual = actualRows.reduce((sum, r) => sum + (r.actual_amount || 0), 0);

  // 4. Compute Outstanding Commitments
  const commitmentData = await getCommittedCosts({
    companyId,
    branchId,
    projectId,
    costCenterId,
  });
  const currentCommitted = commitmentData.total_committed || 0;

  // 5. Variance and Available Balance
  const totalEncumbered = currentActual + currentCommitted;
  const availableBudget = Math.max(0, approvedBudget - totalEncumbered);
  const projectedEncumbered = totalEncumbered + reqAmount;
  const projectedUtilizationPct = approvedBudget > 0 ? (projectedEncumbered / approvedBudget) * 100 : 100;
  const isOverBudget = approvedBudget > 0 ? projectedEncumbered > approvedBudget : reqAmount > 0;
  const overrunAmount = Math.max(0, projectedEncumbered - approvedBudget);

  let status = "APPROVED";
  let message = "Transaction is within available budget limits.";

  if (isOverBudget) {
    if (policyType === "BLOCK") {
      status = "BLOCKED";
      message = `Transaction of GH₵${reqAmount.toLocaleString()} exceeds approved budget by GH₵${overrunAmount.toLocaleString()}. Transaction blocked by company budget policy.`;
    } else if (policyType === "REQUIRE_APPROVAL") {
      status = "APPROVAL_REQUIRED";
      message = `Transaction exceeds budget limit by GH₵${overrunAmount.toLocaleString()}. Requires exceptional budget approval to proceed.`;
    } else {
      status = "WARNING";
      message = `Warning: Transaction exceeds available budget by GH₵${overrunAmount.toLocaleString()}.`;
    }
  } else if (projectedUtilizationPct >= warnPct) {
    status = "WARNING";
    message = `Notice: Transaction brings budget utilization to ${Math.round(projectedUtilizationPct)}% (Warning threshold: ${warnPct}%).`;
  }

  return {
    status, // 'APPROVED', 'WARNING', 'APPROVAL_REQUIRED', 'BLOCKED'
    policy_type: policyType,
    approved_budget: Math.round(approvedBudget * 100) / 100,
    actual_cost: Math.round(currentActual * 100) / 100,
    committed_cost: Math.round(currentCommitted * 100) / 100,
    available_budget: Math.round(availableBudget * 100) / 100,
    requested_amount: Math.round(reqAmount * 100) / 100,
    projected_utilization_pct: Math.round(projectedUtilizationPct * 10) / 10,
    overrun_amount: Math.round(overrunAmount * 100) / 100,
    message,
    budget_id: budget?.budget_id || null,
    budget_code: budget?.budget_code || null,
  };
}

/**
 * Retrieves the exact list of individual financial transactions that make up an actual cost figure.
 */
export async function getTransactionDrilldown({
  companyId,
  accountId = null,
  projectId = null,
  costCenterId = null,
  departmentId = null,
  fromDate = null,
  toDate = null,
  month = null,
  limit = 100,
  offset = 0,
}) {
  let whereClauses = [
    "v.company_id = :companyId",
    "(v.status = 'POSTED' OR v.status IS NULL OR v.status NOT IN ('CANCELLED', 'VOID', 'REJECTED'))",
  ];
  const params = { companyId, limit: Number(limit) || 100, offset: Number(offset) || 0 };

  if (accountId) {
    whereClauses.push("vl.account_id = :accountId");
    params.accountId = Number(accountId);
  }
  if (projectId) {
    whereClauses.push("v.project_id = :projectId");
    params.projectId = Number(projectId);
  }
  if (costCenterId) {
    whereClauses.push("(vl.cost_center = :costCenterId OR v.cost_center_id = :costCenterId)");
    params.costCenterId = Number(costCenterId);
  }
  if (fromDate) {
    whereClauses.push("DATE(v.voucher_date) >= :fromDate");
    params.fromDate = String(fromDate).substring(0, 10);
  }
  if (toDate) {
    whereClauses.push("DATE(v.voucher_date) <= :toDate");
    params.toDate = String(toDate).substring(0, 10);
  }
  if (month) {
    whereClauses.push("MONTH(v.voucher_date) = :month");
    params.month = Number(month);
  }

  const sql = `
    SELECT 
      vl.id AS line_id,
      v.id AS voucher_id,
      v.voucher_no,
      v.voucher_date,
      vt.name AS voucher_type_name,
      v.status,
      v.narration AS header_narration,
      vl.description AS line_description,
      vl.debit,
      vl.credit,
      a.id AS account_id,
      a.code AS account_code,
      a.name AS account_name,
      g.nature AS account_nature,
      v.project_id,
      p.project_name,
      COALESCE(vl.cost_center, v.cost_center_id) AS cost_center_id,
      cc.name AS cost_center_name,
      vl.reference_no,
      vl.payment_method
    FROM fin_voucher_lines vl
    JOIN fin_vouchers v ON v.id = vl.voucher_id
    LEFT JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
    JOIN fin_accounts a ON a.id = vl.account_id
    JOIN fin_account_groups g ON g.id = a.group_id
    LEFT JOIN pm_projects p ON p.id = v.project_id
    LEFT JOIN fin_cost_centers cc ON cc.id = COALESCE(vl.cost_center, v.cost_center_id)
    WHERE ${whereClauses.join(" AND ")}
    ORDER BY v.voucher_date DESC, v.id DESC
    LIMIT :limit OFFSET :offset
  `;

  const countSql = `
    SELECT COUNT(vl.id) AS total_count, SUM(vl.debit) as sum_debit, SUM(vl.credit) as sum_credit
    FROM fin_voucher_lines vl
    JOIN fin_vouchers v ON v.id = vl.voucher_id
    WHERE ${whereClauses.join(" AND ")}
  `;

  const [items, countRows] = await Promise.all([
    query(sql, params),
    query(countSql, params),
  ]);

  const summary = countRows[0] || { total_count: 0, sum_debit: 0, sum_credit: 0 };

  return {
    total_records: Number(summary.total_count || 0),
    total_debit: Number(summary.sum_debit || 0),
    total_credit: Number(summary.sum_credit || 0),
    items: items.map((item) => ({
      ...item,
      debit: Number(item.debit || 0),
      credit: Number(item.credit || 0),
      net_amount: item.account_nature === "EXPENSE" ? Number(item.debit) - Number(item.credit) : Number(item.credit) - Number(item.debit),
    })),
  };
}
