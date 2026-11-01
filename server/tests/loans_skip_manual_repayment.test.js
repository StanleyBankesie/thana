import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/pool.js";
import { ensureHRTables } from "../utils/dbUtils.js";
import {
  addLoanSkip,
  removeLoanSkip,
  listLoanSkips,
  recordManualRepayment,
  getLoanRepayments,
  revertManualRepayment,
} from "../controllers/hr.controller.js";

test("Loan monthly skip and manual repayment workflow", async () => {
  await ensureHRTables();

  const companyId = 1;
  const userId = 1;

  // 1. Ensure a dummy employee exists for testing
  let [emp] = await query(
    `SELECT id FROM hr_employees WHERE company_id = :companyId LIMIT 1`,
    { companyId }
  );
  if (!emp) {
    const res = await query(
      `INSERT INTO hr_employees (company_id, branch_id, first_name, last_name, emp_code)
       VALUES (:companyId, 1, 'Test', 'Employee', 'EMP-TEST-99')`,
      { companyId }
    );
    emp = { id: res.insertId };
  }

  // 2. Create a test loan
  const loanRes = await query(
    `INSERT INTO hr_loans (
      company_id, branch_id, employee_id, loan_type, amount, amount_due,
      interest_rate, repayment_period_months, monthly_installment,
      affect_payslip, start_date, status, created_by
    ) VALUES (
      :companyId, 1, :empId, 'Equipment Loan', 1200.00, 1200.00,
      0, 12, 100.00,
      1, '2026-10-01', 'ACTIVE', :userId
    )`,
    { companyId, empId: emp.id, userId }
  );
  const loanId = loanRes.insertId;
  assert.ok(loanId > 0, "Test loan created");

  try {
    // 3. Test adding a skip for '2026-10'
    const reqSkip = {
      scope: { companyId },
      user: { id: userId },
      params: { id: loanId },
      body: { skip_month: "2026-10", reason: "Employee requested skip due to emergency" },
    };
    let skipResData = null;
    const resSkip = {
      json: (d) => { skipResData = d; },
    };
    await addLoanSkip(reqSkip, resSkip, (err) => { if (err) throw err; });
    assert.ok(skipResData?.success, "Skip added successfully");

    // 4. Test listing skips
    let listSkipsData = null;
    await listLoanSkips(
      { scope: { companyId }, params: { id: loanId } },
      { json: (d) => { listSkipsData = d; } },
      (err) => { if (err) throw err; }
    );
    assert.equal(listSkipsData?.items?.length, 1);
    assert.equal(listSkipsData?.items[0]?.skip_month, "2026-10");
    const skipId = listSkipsData?.items[0]?.id;

    // 5. Test manual repayment: Pay 250.00
    const reqRepay = {
      scope: { companyId },
      user: { id: userId },
      params: { id: loanId },
      body: {
        amount_paid: 250.00,
        payment_date: "2026-10-29",
        payment_method: "BANK_TRANSFER",
        reference: "TXN-98765",
        notes: "Manual bank payment received",
      },
    };
    let repayResData = null;
    await recordManualRepayment(
      reqRepay,
      { json: (d) => { repayResData = d; } },
      (err) => { if (err) throw err; }
    );
    assert.ok(repayResData?.success);
    assert.equal(repayResData?.new_amount_due, 950.00);
    assert.equal(repayResData?.status, "ACTIVE");
    const repaymentId = repayResData?.repayment_id;

    // 6. Test getting loan repayments history
    let repHistoryData = null;
    await getLoanRepayments(
      { scope: { companyId }, params: { id: loanId } },
      { json: (d) => { repHistoryData = d; } },
      (err) => { if (err) throw err; }
    );
    assert.equal(repHistoryData?.items?.length, 1);
    assert.equal(repHistoryData?.items[0]?.payment_type, "MANUAL");
    assert.equal(repHistoryData?.items[0]?.amount_paid, 250.00);
    assert.equal(repHistoryData?.items[0]?.remaining_balance, 950.00);
    assert.equal(repHistoryData?.total_repaid, 250.00);

    // 7. Test removing skip
    let removeSkipData = null;
    await removeLoanSkip(
      { scope: { companyId }, params: { id: loanId, skipId } },
      { json: (d) => { removeSkipData = d; } },
      (err) => { if (err) throw err; }
    );
    assert.ok(removeSkipData?.success);

    // 8. Test reverting manual repayment
    let revertData = null;
    await revertManualRepayment(
      { scope: { companyId }, user: { id: userId }, params: { id: loanId, repaymentId } },
      { json: (d) => { revertData = d; } },
      (err) => { if (err) throw err; }
    );
    assert.ok(revertData?.success);
    assert.equal(revertData?.new_amount_due, 1200.00);

    // Verify database state
    const [finalLoan] = await query(
      `SELECT amount_due, status FROM hr_loans WHERE id = :loanId`,
      { loanId }
    );
    assert.equal(Number(finalLoan.amount_due), 1200.00);
    assert.equal(finalLoan.status, "ACTIVE");

  } finally {
    // Cleanup test data
    await query(`DELETE FROM hr_loan_skips WHERE loan_id = :loanId`, { loanId }).catch(() => {});
    await query(`DELETE FROM hr_loan_repayments WHERE loan_id = :loanId`, { loanId }).catch(() => {});
    await query(`DELETE FROM hr_loans WHERE id = :loanId`, { loanId }).catch(() => {});
  }
});
