import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = express.Router();

// Get outstanding bills for a supplier (for payment voucher linking)
// Returns all posted, unpaid or partially paid bills for a given supplier.
router.get(
  "/outstanding",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.scope?.companyId || req.user?.companyId || 0);
      const branchId = Number(req.scope?.branchId || req.user?.branchId || 0);
      const supplierId = Number(req.query.supplier_id || 0);
      const statusFilter = req.query.status || "";

      if (!supplierId) {
        return res.json({ items: [] });
      }

      const statuses = statusFilter
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      let sql = `
        SELECT 
          b.id,
          b.bill_no,
          b.bill_date,
          b.supplier_id,
          b.net_amount,
          b.amount_paid,
          COALESCE(b.amount_paid, 0) as amount_paid,
          (b.net_amount - COALESCE(b.amount_paid, 0)) as balance_amount,
          b.payment_status,
          b.status,
          s.supplier_code,
          s.supplier_name
        FROM pur_bills b
        LEFT JOIN pur_suppliers s ON s.id = b.supplier_id 
          AND s.company_id = b.company_id 
        WHERE b.company_id = ?
          AND (b.branch_id = ? OR b.branch_id IS NULL)
          AND b.supplier_id = ?
          AND b.status = 'POSTED'
      `;

      const params = [companyId, branchId, supplierId];

      if (statuses.length > 0) {
        const placeholders = statuses.map(() => "?").join(",");
        sql += ` AND b.payment_status IN (${placeholders})`;
        params.push(...statuses);
      }

      sql += ` ORDER BY b.bill_date ASC, b.bill_no ASC`;
      const rows = await query(sql, params);

      // Fetch bill details for each bill
      const billIds = rows.map((r) => r.id);
      let detailsMap = {};
      if (billIds.length > 0) {
        const placeholders = billIds.map(() => "?").join(",");
        const detailsSql = `
          SELECT 
            bd.bill_id,
            bd.item_id,
            bd.qty,
            bd.unit_price,
            bd.line_total,
            bd.tax_amount,
            bd.tax_code_id,
            i.item_code,
            i.item_name
          FROM pur_bill_details bd
          LEFT JOIN inv_items i ON i.id = bd.item_id
          WHERE bd.bill_id IN (${placeholders})
        `;
        const detailsRows = await query(detailsSql, billIds);
        detailsMap = (detailsRows || []).reduce((acc, d) => {
          if (!acc[d.bill_id]) acc[d.bill_id] = [];
          acc[d.bill_id].push({
            item_id: d.item_id,
            item_code: d.item_code,
            item_name: d.item_name,
            qty: Number(d.qty || 0),
            unit_price: Number(d.unit_price || 0),
            line_total: Number(d.line_total || 0),
            tax_amount: Number(d.tax_amount || 0),
            tax_code_id: d.tax_code_id ? String(d.tax_code_id) : "",
          });
          return acc;
        }, {});
      }

      // Format response
      const items = (rows || []).map((row) => ({
        id: row.id,
        bill_no: row.bill_no,
        bill_date: row.bill_date,
        supplier_id: row.supplier_id,
        supplier_code: row.supplier_code,
        supplier_name: row.supplier_name,
        net_amount: Number(row.net_amount || 0),
        amount_paid: Number(row.amount_paid || 0),
        balance_amount: Number(row.balance_amount || row.net_amount || 0),
        payment_status: row.payment_status || "UNPAID",
        status: row.status,
        details: detailsMap[row.id] || [],
      }));

      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Get outstanding bills for a supplier based on account code
// 1) Uses account_code directly (or resolves from account_id for backwards compat),
// 2) Finds supplier where supplier_code = account_code,
// 3) Returns their outstanding UNPAID / PARTIAL PAYMENT bills
// Useful for ledger reconciliation and account-based payment flows.
router.get(
  "/outstanding-by-account",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.scope.companyId);
      const branchId = Number(req.scope.branchId);
      const { account_code, account_id } = req.query;

      let accountCode = String(account_code || "").trim();
      let accountName = "";

      if (account_id) {
        // Resolve account_id → code AND name from fin_accounts
        const accountRows = await query(
          `SELECT code, name FROM fin_accounts 
           WHERE id = ? AND company_id = ?`,
          [account_id, companyId],
        );
        if (accountRows?.[0]) {
          if (!accountCode) accountCode = String(accountRows[0].code || "").trim();
          accountName = String(accountRows[0].name || "").trim();
        }
      }

      // Also resolve name from code if only code was provided
      if (accountCode && !accountName) {
        const nameRows = await query(
          `SELECT name FROM fin_accounts WHERE code = ? AND company_id = ?`,
          [accountCode, companyId],
        );
        if (nameRows?.[0]) {
          accountName = String(nameRows[0].name || "").trim();
        }
      }

      if (!accountCode && !accountName) {
        return res.status(400).json({ error: "account_code is required" });
      }

      // Step 2: Find supplier — first by supplier_code = account_code, then by name match
      let supplierRows = [];
      if (accountCode) {
        supplierRows = await query(
          `SELECT id, supplier_code, supplier_name 
           FROM pur_suppliers 
           WHERE company_id = ? AND supplier_code = ?
           LIMIT 1`,
          [companyId, accountCode],
        );
      }
      // Fallback: match by supplier name = account name
      if ((!supplierRows || supplierRows.length === 0) && accountName) {
        supplierRows = await query(
          `SELECT id, supplier_code, supplier_name 
           FROM pur_suppliers 
           WHERE company_id = ? AND supplier_name = ?
           LIMIT 1`,
          [companyId, accountName],
        );
      }

      if (!supplierRows || supplierRows.length === 0) {
        return res.json({ items: [] });
      }

      const supplierId = supplierRows[0].id;

      // Step 3: Get outstanding UNPAID / PARTIAL PAYMENT bills for this supplier
      // from pur_bills (purchase bills), pur_service_bills, and maint_bills
      const sql = `
        SELECT id, bill_no, bill_date, net_amount, amount_paid, balance_amount,
               payment_status, due_date, supplier_name, source, items
        FROM (
          SELECT b.id, b.bill_no, b.bill_date, b.net_amount, b.amount_paid,
                 (b.net_amount - COALESCE(b.amount_paid, 0)) as balance_amount,
                 b.payment_status, b.due_date, s.supplier_name,
                 'Purchase' as source,
                 NULL as items
          FROM pur_bills b
          LEFT JOIN pur_suppliers s ON b.supplier_id = s.id
          WHERE b.supplier_id = ?
            AND b.company_id = ?
            AND (b.branch_id = ? OR b.branch_id IS NULL)
            AND (b.payment_status = 'UNPAID' OR b.payment_status = 'PARTIAL PAYMENT')
            AND b.status = 'POSTED'

          UNION ALL

          SELECT sb.id, sb.bill_no, sb.bill_date,
                 sb.total_amount as net_amount,
                 COALESCE(sb.amount_paid, 0) as amount_paid,
                 (sb.total_amount - COALESCE(sb.amount_paid, 0)) as balance_amount,
                 sb.payment_status, sb.due_date, s.supplier_name,
                 'Service' as source,
                 NULL as items
          FROM pur_service_bills sb
          LEFT JOIN pur_suppliers s ON sb.supplier_id = s.id
          WHERE sb.supplier_id = ?
            AND sb.company_id = ?
            AND (sb.branch_id = ? OR sb.branch_id IS NULL)
            AND (sb.payment_status = 'UNPAID' OR sb.payment_status = 'PARTIAL' OR sb.payment_status = 'PARTIAL PAYMENT')
            AND (sb.status IN ('PENDING', 'COMPLETED', 'POSTED') OR sb.status IS NULL OR sb.status = '')

          UNION ALL

          SELECT mb.id, mb.bill_no, mb.bill_date,
                 mb.total_amount as net_amount,
                 COALESCE(mb.amount_paid, 0) as amount_paid,
                 (mb.total_amount - COALESCE(mb.amount_paid, 0)) as balance_amount,
                 mb.payment_status, mb.due_date, mb.supplier_name,
                 'Maintenance' as source,
                 NULL as items
          FROM maint_bills mb
          WHERE mb.supplier_id = ?
            AND mb.company_id = ?
            AND (mb.branch_id = ? OR mb.branch_id IS NULL)
            AND (mb.payment_status = 'UNPAID' OR mb.payment_status = 'PARTIAL' OR mb.payment_status = 'PARTIAL PAYMENT')
            AND mb.status NOT IN ('CANCELLED', 'DRAFT')

          UNION ALL

          SELECT tb.id, tb.bill_no, tb.bill_date,
                 tb.total_amount as net_amount,
                 COALESCE(tb.amount_paid, 0) as amount_paid,
                 (tb.total_amount - COALESCE(tb.amount_paid, 0)) as balance_amount,
                 COALESCE(tb.payment_status, 'UNPAID') as payment_status,
                 COALESCE(tb.due_date, tb.bill_date) as due_date,
                 s.supplier_name,
                 'Transportation' as source,
                 NULL as items
          FROM trans_transportation_bills tb
          LEFT JOIN pur_suppliers s ON tb.supplier_id = s.id
          WHERE tb.supplier_id = ?
            AND tb.company_id = ?
            AND (tb.branch_id = ? OR tb.branch_id IS NULL)
            AND (tb.payment_status IS NULL OR tb.payment_status IN ('UNPAID', 'PARTIAL', 'PARTIAL PAYMENT'))
            AND (tb.status IS NULL OR tb.status IN ('DRAFT', 'POSTED', 'COMPLETED'))
        ) combined
        ORDER BY bill_date DESC`;
      const billParams = [
        supplierId, companyId, branchId,
        supplierId, companyId, branchId,
        supplierId, companyId, branchId,
        supplierId, companyId, branchId
      ];
      const billRows = await query(sql, billParams);

      // Group bill details by bill
      const billsMap = new Map();
      (billRows || []).forEach((row) => {
        if (!billsMap.has(`${row.source}_${row.id}`)) {
          billsMap.set(`${row.source}_${row.id}`, {
            id: row.id,
            bill_no: row.bill_no,
            bill_date: row.bill_date,
            net_amount: Number(row.net_amount || 0),
            amount_paid: Number(row.amount_paid || 0),
            balance_amount: Number(row.balance_amount || row.net_amount || 0),
            payment_status: row.payment_status,
            due_date: row.due_date,
            supplier_name: row.supplier_name,
            source: row.source,
            items: [],
          });
        }
      });

      const bills = Array.from(billsMap.values());

      res.json({
        items: bills,
        supplier: supplierRows[0],
        account_code: accountCode,
      });
    } catch (err) {
      console.error("[outstanding-by-account] Error:", err?.message || err);
      console.error("[outstanding-by-account] Stack:", err?.stack);
      next(err);
    }
  },
);

// Update bill payment status when payment is made
// Recalculates total paid vs net amount to determine if bill is FULLY PAID, PARTIAL, or UNPAID.
router.post(
  "/update-payment-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const companyId = Number(req.scope?.companyId || req.user?.companyId || 0);
      const branchId = Number(req.scope?.branchId || req.user?.branchId || 0);
      const { billId, paymentAmount } = req.body;

      if (!billId || !(paymentAmount > 0)) {
        return res.status(400).json({
          error: "billId and paymentAmount are required",
        });
      }

      // Get current bill details
      const billRows = await query(
        `SELECT net_amount, amount_paid, payment_status 
         FROM pur_bills 
         WHERE id = ? AND company_id = ? AND (branch_id = ? OR branch_id IS NULL)`,
        [billId, companyId, branchId],
      );

      if (!billRows || billRows.length === 0) {
        return res.status(404).json({ error: "Bill not found" });
      }

      const bill = billRows[0];
      const netAmount = Number(bill.net_amount || 0);
      const currentPaid = Number(bill.amount_paid || 0);
      const newPaid = currentPaid + Number(paymentAmount);

      // Determine new payment status
      let newStatus;
      if (newPaid >= netAmount) {
        newStatus = "FULLY PAID";
      } else if (newPaid > 0) {
        newStatus = "PARTIAL PAYMENT";
      } else {
        newStatus = "UNPAID";
      }

      // Update bill
      await query(
        `UPDATE pur_bills 
         SET amount_paid = ?, 
             payment_status = ?,
             updated_at = NOW()
         WHERE id = ? AND company_id = ? AND (branch_id = ? OR branch_id IS NULL)`,
        [newPaid, newStatus, billId, companyId, branchId],
      );

      res.json({
        success: true,
        billId,
        previousStatus: bill.payment_status,
        newStatus,
        amountPaid: newPaid,
        balanceAmount: Math.max(0, netAmount - newPaid),
      });
    } catch (err) {
      next(err);
    }
  },
);

// Simple test route to verify router is working
router.get("/test", (req, res) => {
  res.json({ message: "Purchase bills router is working!" });
});

export default router;
