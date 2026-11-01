import test from "node:test";
import assert from "node:assert/strict";
import { query } from "../db/pool.js";
import * as hrController from "../controllers/hr.controller.js";

function createMockRes() {
  return {
    statusCode: 200,
    data: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.data = payload;
      return this;
    },
  };
}

test("Staff Loan Request Approval Workflow and PV Disbursement", async (t) => {
  const companyId = 1;
  const mockUser = { id: 1, full_name: "Test Administrator", username: "admin", company_id: 1 };
  const mockScope = { companyId: 1 };

  // 1. Ensure loan type exists with finance account
  const [loanType] = await query(
    `SELECT lt.id, lt.name, lt.account_id, a.code as acc_code 
     FROM hr_setup_loan_types lt
     LEFT JOIN fin_accounts a ON a.id = lt.account_id
     WHERE lt.name = 'Personal Loan' LIMIT 1`
  );
  assert.ok(loanType, "Personal Loan type must exist");

  // 2. Ensure test employee exists
  let [emp] = await query(`SELECT id, first_name, last_name FROM hr_employees LIMIT 1`);
  if (!emp) {
    const res = await query(
      `INSERT INTO hr_employees (company_id, first_name, last_name, status) VALUES (1, 'Test', 'Borrower', 'ACTIVE')`
    );
    emp = { id: res.insertId, first_name: "Test", last_name: "Borrower" };
  }

  // 3. Ensure a cash/bank account exists for disbursement
  let [payAcc] = await query(
    `SELECT id, code, name FROM fin_accounts 
     WHERE (code LIKE '1005%' OR code LIKE '1006%' OR name LIKE '%Bank%' OR name LIKE '%Cash%')
       AND is_postable = 1 LIMIT 1`
  );
  if (!payAcc) {
    [payAcc] = await query(`SELECT id, code, name FROM fin_accounts WHERE is_postable = 1 LIMIT 1`);
  }
  assert.ok(payAcc, "Payment bank/cash account must exist");

  let createdLoanId = null;

  await t.test("Create Loan Request in DRAFT status", async () => {
    const req = {
      body: {
        employee_id: emp.id,
        loan_type: "Personal Loan",
        amount: 3600,
        interest_rate: 0,
        repayment_period_months: 12,
        monthly_installment: 300,
        start_date: "2026-11-01",
        purpose: "Medical checkup advance",
        status: "DRAFT",
        affect_payslip: 1,
      },
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.createLoanRequest(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 201);
    assert.ok(res.data?.id);
    createdLoanId = res.data.id;

    const [row] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(row.status, "DRAFT");
    assert.equal(row.purpose, "Medical checkup advance");
    assert.equal(Number(row.amount), 3600);
  });

  await t.test("Forward Loan Request for Approval", async () => {
    const req = {
      params: { id: createdLoanId },
      body: {
        target_approver_id: 1,
        notes: "Please approve this urgent medical loan",
      },
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.forwardLoanRequest(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    const [row] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(row.status, "PENDING_APPROVAL");
    assert.equal(Number(row.forwarded_to_user_id), 1);
  });

  await t.test("Reject Loan Request with reason", async () => {
    const req = {
      params: { id: createdLoanId },
      body: {
        rejection_reason: "Incomplete documentation provided",
      },
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.rejectLoanRequest(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    const [row] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(row.status, "REJECTED");
    assert.equal(row.rejection_reason, "Incomplete documentation provided");
  });

  await t.test("Re-forward and Approve Loan Request", async () => {
    // Re-forward
    await hrController.forwardLoanRequest(
      { params: { id: createdLoanId }, body: {}, user: mockUser, scope: mockScope },
      createMockRes(),
      (err) => { if (err) throw err; }
    );

    // Approve
    const req = {
      params: { id: createdLoanId },
      body: {},
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.approveLoanRequest(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    const [row] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(row.status, "APPROVED");
    assert.equal(Number(row.approved_by), mockUser.id);
    assert.ok(row.approved_at);
  });

  await t.test("Reverse Approval back to PENDING_APPROVAL", async () => {
    const req = {
      params: { id: createdLoanId },
      body: {},
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.reverseLoanApproval(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    const [row] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(row.status, "PENDING_APPROVAL");
    assert.equal(row.approved_by, null);

    // Re-approve for disbursement step
    await hrController.approveLoanRequest(
      { params: { id: createdLoanId }, body: {}, user: mockUser, scope: mockScope },
      createMockRes(),
      (err) => { if (err) throw err; }
    );
  });

  await t.test("Disburse Loan with Payment Voucher (PV) generation", async () => {
    const req = {
      params: { id: createdLoanId },
      body: {
        payment_account_id: payAcc.id,
        disbursement_date: "2026-10-29",
        disbursement_method: "Bank Transfer",
        disbursement_notes: "Disbursed via corporate wire transfer",
      },
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.disburseLoan(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    assert.ok(res.data?.disbursement_voucher_no, "Must return disbursement PV voucher number");

    // Verify loan is now ACTIVE
    const [loanRow] = await query(`SELECT * FROM hr_loans WHERE id = :id`, { id: createdLoanId });
    assert.equal(loanRow.status, "ACTIVE");
    assert.equal(Number(loanRow.amount_due), 3600);
    assert.ok(loanRow.disbursement_voucher_id);
    assert.ok(loanRow.disbursement_voucher_no);
    assert.equal(Number(loanRow.disbursed_by), mockUser.id);

    // Verify Payment Voucher in Finance (fin_vouchers and fin_voucher_lines)
    const [voucher] = await query(
      `SELECT v.*, vt.code AS voucher_type_code 
       FROM fin_vouchers v 
       JOIN fin_voucher_types vt ON vt.id = v.voucher_type_id
       WHERE v.id = :vid`,
      { vid: loanRow.disbursement_voucher_id }
    );
    assert.ok(voucher, "Payment voucher record must exist in fin_vouchers");
    assert.equal(voucher.voucher_no, loanRow.disbursement_voucher_no);
    assert.equal(voucher.voucher_type_code, "PAYV");

    const lines = await query(
      `SELECT * FROM fin_voucher_lines WHERE voucher_id = :vid ORDER BY id ASC`,
      { vid: loanRow.disbursement_voucher_id }
    );
    assert.equal(lines.length, 2, "Must have exactly 2 balanced lines: Debit and Credit");

    const debitLine = lines.find((l) => Number(l.debit) > 0);
    const creditLine = lines.find((l) => Number(l.credit) > 0);

    assert.ok(debitLine, "Must have Debit line for staff loan receivable");
    assert.equal(Number(debitLine.debit), 3600);
    assert.equal(debitLine.account_id, loanType.account_id, "Debit must hit loan receivable asset account");

    assert.ok(creditLine, "Must have Credit line for bank/cash");
    assert.equal(Number(creditLine.credit), 3600);
    assert.equal(creditLine.account_id, payAcc.id, "Credit must hit payment bank/cash account");
  });

  await t.test("List Loans includes disbursement voucher info and approver name", async () => {
    const req = {
      query: { tab: "active" },
      user: mockUser,
      scope: mockScope,
    };
    const res = createMockRes();
    await hrController.listLoans(req, res, (err) => {
      if (err) throw err;
    });

    assert.equal(res.statusCode, 200);
    const items = res.data?.items || [];
    const item = items.find((i) => i.id === createdLoanId);
    assert.ok(item, "Disbursed loan must be listed in active loans");
    assert.ok(item.disbursement_voucher_no);
    assert.equal(item.status, "ACTIVE");
  });

  // Cleanup test record
  await query(`DELETE FROM fin_voucher_lines WHERE voucher_id IN (SELECT disbursement_voucher_id FROM hr_loans WHERE id = :id)`, { id: createdLoanId });
  await query(`DELETE FROM fin_vouchers WHERE id IN (SELECT disbursement_voucher_id FROM hr_loans WHERE id = :id)`, { id: createdLoanId });
  await query(`DELETE FROM hr_loans WHERE id = :id`, { id: createdLoanId });
});
