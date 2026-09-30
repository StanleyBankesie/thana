import express from "express";
import { requireAuth, requireCompanyScope } from "../middleware/auth.js";
import { query } from "../db/pool.js";

const router = express.Router();

router.get(
  "/workflows",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId } = req.scope || {};
      if (!companyId) {
        return res.status(400).json({ message: "Company scope required" });
      }

      // We want transactions that are pending some action (Draft, Submitted, Pending Approval, etc.)
      // It's safer to exclude terminal statuses than to whitelist all intermediate ones.
      const excludedStatuses = "'APPROVED', 'POSTED', 'CANCELLED', 'CONFIRMED'";

      const queries = [
        `SELECT 'Sales Quotation' as type, 'Sales' as module, quotation_no as doc_no, quotation_date as doc_date, status, id, company_id FROM sal_quotations WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Sales Order' as type, 'Sales' as module, order_no as doc_no, order_date as doc_date, status, id, company_id FROM sal_orders WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Sales Invoice' as type, 'Sales' as module, invoice_no as doc_no, invoice_date as doc_date, status, id, company_id FROM sal_invoices WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Sales Return' as type, 'Sales' as module, return_no as doc_no, return_date as doc_date, status, id, company_id FROM sal_returns WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Purchase Order' as type, 'Purchase' as module, po_no as doc_no, po_date as doc_date, status, id, company_id FROM pur_orders WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Purchase Return' as type, 'Purchase' as module, return_no as doc_no, return_date as doc_date, status, id, company_id FROM pur_returns WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'General Requisition' as type, 'Purchase' as module, requisition_no as doc_no, requisition_date as doc_date, status, id, company_id FROM pur_general_requisitions WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Material Requisition' as type, 'Inventory' as module, requisition_no as doc_no, requisition_date as doc_date, status, id, company_id FROM inv_material_requisitions WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Stock Adjustment' as type, 'Inventory' as module, adjustment_no as doc_no, adjustment_date as doc_date, status, id, company_id FROM inv_stock_adjustments WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT 'Goods Receipt Note' as type, 'Inventory' as module, grn_no as doc_no, grn_date as doc_date, status, id, company_id FROM inv_goods_receipt_notes WHERE company_id = :companyId AND UPPER(status) NOT IN (${excludedStatuses}) AND IFNULL(status, '') != ''`,
        `SELECT CONCAT(IFNULL(vt.name, 'Finance'), ' Voucher') as type, 'Finance' as module, v.voucher_no as doc_no, v.voucher_date as doc_date, v.status, v.id, v.company_id FROM fin_vouchers v LEFT JOIN fin_voucher_types vt ON v.voucher_type_id = vt.id WHERE v.company_id = :companyId AND UPPER(v.status) NOT IN (${excludedStatuses}) AND IFNULL(v.status, '') != ''`
      ];

      const unionQuery = queries.join(" UNION ALL ");
      
      const wrappedQuery = `
        SELECT t.*, u.username as assigned_to
        FROM (${unionQuery}) as t
        LEFT JOIN adm_workflow_tasks w 
          ON w.document_type = REPLACE(UPPER(t.type), ' ', '_') 
          AND w.document_id = t.id 
          AND w.company_id = t.company_id
          AND w.action = 'PENDING'
        LEFT JOIN adm_workflows wf 
          ON wf.id = w.workflow_id
        LEFT JOIN adm_workflow_steps ws 
          ON ws.workflow_id = w.workflow_id AND ws.step_order = w.step_order
        LEFT JOIN adm_workflow_step_approvers wsa 
          ON wsa.workflow_id = w.workflow_id AND wsa.step_order = w.step_order
        LEFT JOIN adm_workflow_logs wl 
          ON wl.document_workflow_id = w.document_workflow_id AND wl.step_order = w.step_order
        LEFT JOIN adm_users u 
          ON u.id = w.assigned_to_user_id
        GROUP BY t.id, t.type, t.module, t.doc_no, t.doc_date, t.status, t.company_id, u.username
        ORDER BY t.doc_date DESC, t.doc_no DESC
      `;

      const results = await query(wrappedQuery, { companyId });

      res.json({
        data: results,
        total: results.length
      });
    } catch (err) {
      console.error("[Workflow Overview Error]", err);
      next(err);
    }
  }
);

export default router;
