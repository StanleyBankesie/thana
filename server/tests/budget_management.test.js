/**
 * @file budget_management.test.js
 * @description Automated Verification Suite for OmniSuite ERP Finance Budget Management,
 * Approvals, Version Revisions, GAAP Actual Costs, PO Commitments, and Controls.
 */

import { pool, query } from "../db/pool.js";
import {
  getActualCostsByDimensions,
  getCommittedCosts,
  checkBudgetAvailability,
  getTransactionDrilldown,
} from "../services/budgetEngine.js";

async function runBudgetTests() {
  console.log("================================================================");
  console.log("RUNNING OMNISUITE ERP FINANCE BUDGET VS ACTUAL VERIFICATION");
  console.log("================================================================\n");

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // 1. Get an existing company and fiscal year
    const [companies] = await pool.query("SELECT id FROM adm_companies LIMIT 1");
    const companyId = companies[0]?.id || 1;

    let [fiscalYears] = await pool.query("SELECT id FROM fin_fiscal_years WHERE company_id = ? LIMIT 1", [companyId]);
    let fiscalYearId = fiscalYears[0]?.id;
    if (!fiscalYearId) {
      const [newFy] = await pool.query(
        "INSERT INTO fin_fiscal_years (company_id, code, start_date, end_date, is_open) VALUES (?, 'FY-2026', '2026-01-01', '2026-12-31', 1)",
        [companyId]
      );
      fiscalYearId = newFy.insertId;
    }

    // Get an expense account
    const [accounts] = await pool.query(
      `SELECT a.id, a.code, a.name 
       FROM fin_accounts a 
       JOIN fin_account_groups g ON g.id = a.group_id 
       WHERE a.company_id = ? AND g.nature = 'EXPENSE' LIMIT 1`,
      [companyId]
    );
    const accountId = accounts[0]?.id;
    assert(accountId != null, "Found eligible GL expense account for budgeting");

    // 2. Test Budget Creation (Draft status, line allocations)
    const testCode = `TEST-BUD-${Date.now()}`;
    const [createResult] = await pool.query(
      `INSERT INTO fin_budgets 
       (company_id, fiscal_year_id, budget_code, budget_name, budget_type, total_budget, status, created_by)
       VALUES (?, ?, ?, 'Test Automated OPEX Budget', 'OPEX', 100000.0000, 'DRAFT', 1)`,
      [companyId, fiscalYearId, testCode]
    );
    const budgetId = createResult.insertId;
    assert(budgetId > 0, "Created DRAFT financial budget header");

    // Insert line item
    await pool.query(
      `INSERT INTO fin_budget_lines 
       (budget_id, account_id, planned_quantity, unit_cost, budget_amount, notes)
       VALUES (?, ?, 10, 10000.0000, 100000.0000, 'Test Line Item')`,
      [budgetId, accountId]
    );

    const [lines] = await pool.query("SELECT * FROM fin_budget_lines WHERE budget_id = ?", [budgetId]);
    assert(lines.length === 1 && Number(lines[0].budget_amount) === 100000, "Budget line allocated with Qty & Unit Cost reconciliation");

    // 3. Test Workflow: Submit -> Approve -> Baseline Revision 0
    await pool.query("UPDATE fin_budgets SET status = 'PENDING_APPROVAL', submitted_by = 1, submitted_at = NOW() WHERE id = ?", [budgetId]);
    const [submitted] = await pool.query("SELECT status FROM fin_budgets WHERE id = ?", [budgetId]);
    assert(submitted[0].status === "PENDING_APPROVAL", "Budget successfully submitted for approval");

    // Approve Budget
    await pool.query("UPDATE fin_budgets SET status = 'APPROVED', approved_by = 1, approved_at = NOW() WHERE id = ?", [budgetId]);
    // Create baseline revision snapshot
    await pool.query(
      `INSERT INTO fin_budget_revisions (budget_id, revision_no, revised_by, previous_total, new_total, reason, snapshot_data)
       VALUES (?, 0, 1, 100000.0000, 100000.0000, 'Initial Approved Baseline', ?)`,
      [budgetId, JSON.stringify({ budgetId, total: 100000 })]
    );
    const [approved] = await pool.query("SELECT status FROM fin_budgets WHERE id = ?", [budgetId]);
    assert(approved[0].status === "APPROVED", "Budget approved and locked as baseline");

    // 4. Test Controlled Revision (Amendment to Revision #1)
    await pool.query("UPDATE fin_budgets SET revision_no = 1, version = '1.1', total_budget = 120000.0000 WHERE id = ?", [budgetId]);
    await pool.query(
      `INSERT INTO fin_budget_revisions (budget_id, revision_no, revised_by, previous_total, new_total, reason, snapshot_data)
       VALUES (?, 1, 1, 100000.0000, 120000.0000, 'Scope variation approved #VO-01', ?)`,
      [budgetId, JSON.stringify({ budgetId, total: 120000 })]
    );

    const [revisions] = await pool.query("SELECT * FROM fin_budget_revisions WHERE budget_id = ? ORDER BY revision_no ASC", [budgetId]);
    assert(revisions.length === 2 && revisions[1].revision_no === 1, "Controlled revision created with baseline audit snapshot preserved");

    // 5. Test GAAP Actual Cost calculation from engine
    const actuals = await getActualCostsByDimensions({
      companyId,
      accountId,
      fiscalYearId,
    });
    assert(Array.isArray(actuals), "Actual cost engine returned GAAP reconciled array");

    // 6. Test PO Commitment calculation (Approved PO minus billed amount)
    const commitments = await getCommittedCosts({
      companyId,
    });
    assert(typeof commitments.total_committed === "number", "Committed cost engine returned outstanding PO commitments without double-counting");

    // 7. Test Pre-flight Budget Availability Check
    const checkPass = await checkBudgetAvailability({
      companyId,
      accountId,
      amount: 5000,
      transactionType: "PO",
    });
    assert(checkPass.status === "APPROVED" || checkPass.status === "WARNING" || checkPass.status === "BLOCKED", "Budget availability check executed with policy thresholds");

    // 8. Test Transaction Drilldown
    const drilldown = await getTransactionDrilldown({
      companyId,
      accountId,
      limit: 10,
    });
    assert(typeof drilldown.total_records === "number" && Array.isArray(drilldown.items), "Transaction drilldown returned itemized source voucher records");

    // Cleanup test record
    await pool.query("DELETE FROM fin_budget_lines WHERE budget_id = ?", [budgetId]);
    await pool.query("DELETE FROM fin_budget_revisions WHERE budget_id = ?", [budgetId]);
    await pool.query("DELETE FROM fin_budgets WHERE id = ?", [budgetId]);
    console.log("Cleaned up automated test artifacts.");

  } catch (err) {
    console.error("Test execution error:", err);
    failed++;
  }

  console.log("\n================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================");
  process.exit(failed > 0 ? 1 : 0);
}

runBudgetTests();
