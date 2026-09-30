import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import {
  recordMovementTx,
  consumeStockFIFOTx,
} from "../services/stock.service.js";
import { applyStockVerificationApprovalTx } from "../services/stock-verification.service.js";
import { isMailerConfigured, sendMail } from "../utils/mailer.js";
import { isSMSConfigured, sendSMS } from "../utils/sms.js";
import { isWhatsAppConfigured, sendWhatsApp } from "../utils/whatsapp.js";
import { sendDocumentForwardNotification } from "../utils/documentNotification.js";
import { checkAndSendAutomaticNotification } from "../utils/externalNotification.js";
import { sendPushToUser } from "../routes/push.routes.js";
import { createCreditNoteForReturnApprovalTx, createPostedSalesVoucherForInvoiceTx } from "../routes/sales.route.js";
import { createDebitNoteForReturnApprovalTx } from "../routes/purchase.routes.js";

const toNumber = (v, fallback = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const hasColumn = async (tableName, columnName) => {
  const rows = await query(
    `
    SELECT COUNT(*) AS c
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND table_name = :tableName
      AND column_name = :columnName
    `,
    { tableName, columnName },
  );
  return Number(rows?.[0]?.c || 0) > 0;
};

async function applyAutoApprovalToLinkedDocument(instance) {
  const docType = String(instance?.document_type || "")
    .trim()
    .toUpperCase();
  const companyId = instance?.company_id;
  const documentId = instance?.document_id;
  if (!companyId || !documentId) return;

  if (docType === "PURCHASE_ORDER") {
    await query(
      `UPDATE pur_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "SALES_ORDER" || docType === "SALES ORDER") {
    await query(
      `UPDATE sal_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "MATERIAL_REQUISITION") {
    await query(
      `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "GENERAL_REQUISITION") {
    await query(
      `UPDATE pur_general_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "RETURN_TO_STORES") {
    await query(
      `UPDATE inv_return_to_stores SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (
    docType === "STOCK_ADJUSTMENT" ||
    docType === "STOCK_UPDATION" ||
    docType === "STOCK_VERIFICATION"
  ) {
    const tableName =
      docType === "STOCK_ADJUSTMENT"
        ? "inv_stock_adjustments"
        : docType === "STOCK_UPDATION"
          ? "inv_stock_updations"
          : "inv_stock_verifications";
    await query(
      `UPDATE ${tableName} SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (
    docType === "GOODS_RECEIPT" ||
    docType === "GOODS RECEIPT" ||
    docType === "GRN" ||
    docType === "GOODS RECEIPT NOTE"
  ) {
    await query(
      `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (
    docType === "PAYMENT_VOUCHER" ||
    docType === "PAYMENT VOUCHER" ||
    docType === "PV" ||
    docType === "RECEIPT_VOUCHER" ||
    docType === "RECEIPT VOUCHER" ||
    docType === "RV" ||
    docType === "JOURNAL_VOUCHER" ||
    docType === "JOURNAL VOUCHER" ||
    docType === "JV" ||
    docType === "CONTRA_VOUCHER" ||
    docType === "CONTRA VOUCHER" ||
    docType === "CV" ||
    docType === "DEBIT_NOTE" ||
    docType === "DEBIT NOTE" ||
    docType === "DN" ||
    docType === "CREDIT_NOTE" ||
    docType === "CREDIT NOTE" ||
    docType === "CN"
  ) {
    await query(
      `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    if (docType === "PAYMENT_VOUCHER" || docType === "PAYMENT VOUCHER" || docType === "PV") {
      try {
        await query(
          `UPDATE trans_expense_logs 
           SET status = 'PAID' 
           WHERE id IN (
             SELECT expense_log_id FROM trn_transport_expenses 
             WHERE voucher_id = :id AND company_id = :companyId AND expense_log_id IS NOT NULL
           ) AND company_id = :companyId`,
          { id: documentId, companyId }
        );
      } catch (e) {}
    }
    return;
  }

  if (docType === "SALES_RETURN") {
    const rows = await query(
      `SELECT id, branch_id, status
       FROM sal_returns
       WHERE id = :id AND company_id = :companyId
       LIMIT 1`,
      { id: documentId, companyId },
    );
    const header = rows[0];
    if (!header) return;
    if (String(header.status || "").toUpperCase() !== "APPROVED") {
      await query(
        `UPDATE sal_returns SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
        { id: documentId, companyId },
      );
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await createCreditNoteForReturnApprovalTx(conn, {
          id: documentId,
          companyId,
          branchId, branchIdsStr: header.branch_id,
        });
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
    return;
  }

  if (docType === "PURCHASE_RETURN" || docType === "PURCHASE RETURN") {
    const rows = await query(
      `SELECT id, branch_id, status
       FROM pur_returns
       WHERE id = :id AND company_id = :companyId
       LIMIT 1`,
      { id: documentId, companyId },
    );
    const header = rows[0];
    if (!header) return;
    if (String(header.status || "").toUpperCase() !== "APPROVED") {
      await query(
        `UPDATE pur_returns SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
        { id: documentId, companyId },
      );
      const conn = await pool.getConnection();
      try {
        await conn.beginTransaction();
        await createDebitNoteForReturnApprovalTx(conn, {
          id: documentId,
          companyId,
          branchId, branchIdsStr: header.branch_id,
        });
        await conn.commit();
      } catch (err) {
        await conn.rollback();
        throw err;
      } finally {
        conn.release();
      }
    }
  }

  if (docType === "MAINT_REQUEST") {
    await query(
      `UPDATE maint_requests SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "MAINT_MATERIAL_REQUISITION") {
    await query(
      `UPDATE maint_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }

  if (docType === "PROJECT_ORDER" || docType === "Project Order") {
    await query(
      `UPDATE pm_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }
  if (docType === "PURCHASE_REQUISITION" || docType === "Purchase Requisition" || docType === "PM_PURCHASE_REQUISITION") {
    await query(
      `UPDATE pm_purchase_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
      { id: documentId, companyId },
    );
    return;
  }
}

async function autoApprovePendingWorkflowDocuments({
  workflowId,
  companyId,
  actorUserId = null,
}) {
  const instances = await query(
    `SELECT id, company_id, document_id, document_type, current_step_order
     FROM adm_document_workflows
     WHERE workflow_id = :workflowId
       AND company_id = :companyId
       AND status = 'PENDING'
     ORDER BY id ASC`,
    { workflowId, companyId },
  );

  for (const instance of instances) {
    await applyAutoApprovalToLinkedDocument(instance);
    await query(
      `UPDATE adm_document_workflows
       SET status = 'APPROVED',
           assigned_to_user_id = NULL
       WHERE id = :id`,
      { id: instance.id },
    );
    await query(
      `UPDATE adm_workflow_tasks
       SET action = 'APPROVED'
       WHERE document_workflow_id = :id
         AND action = 'PENDING'`,
      { id: instance.id },
    );
    await query(
      `INSERT INTO adm_workflow_logs
        (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES
        (:dwId, :stepOrder, 'APPROVE', :actorUserId, :comments)`,
      {
        dwId: instance.id,
        stepOrder: Number(instance.current_step_order || 1),
        actorUserId: actorUserId || null,
        comments: "Auto-approved because workflow was deactivated",
      },
    ).catch(() => {});
  }
}

const nextWorkflowCode = async (companyId) => {
  const rows = await query(
    `
    SELECT workflow_code,
          created_at,
          u.username AS created_by_name
         FROM adm_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE company_id = :companyId
      AND workflow_code REGEXP '^WF-[0-9]{6}$'
    ORDER BY CAST(SUBSTRING(workflow_code, 4) AS UNSIGNED) DESC
    LIMIT 1
    `,
    { companyId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].workflow_code || "");
    const numPart = prev.slice(3);
    const n = parseInt(numPart, 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `WF-${String(nextNum).padStart(6, "0")}`;
};

const ensureWorkflowTables = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_code VARCHAR(50) NOT NULL,
      workflow_name VARCHAR(150) NOT NULL,
      module_key VARCHAR(50) NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      document_route VARCHAR(255) DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      default_behavior VARCHAR(20) DEFAULT NULL,
      email_notify TINYINT(1) NOT NULL DEFAULT 1,
      sms_notify TINYINT(1) NOT NULL DEFAULT 1,
      whatsapp_notify TINYINT(1) NOT NULL DEFAULT 1,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_workflow_company_code (company_id, workflow_code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_step_approvers (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      PRIMARY KEY (workflow_id, step_order, approver_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  if (!(await hasColumn("adm_workflows", "document_route"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN document_route VARCHAR(255) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "min_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN min_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "max_amount"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN max_amount DECIMAL(18,2) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "default_behavior"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN default_behavior VARCHAR(20) DEFAULT NULL`,
    );
  }
  if (!(await hasColumn("adm_workflows", "email_notify"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN email_notify TINYINT(1) NOT NULL DEFAULT 1`,
    );
  }
  if (!(await hasColumn("adm_workflows", "sms_notify"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN sms_notify TINYINT(1) NOT NULL DEFAULT 1`,
    );
  }
  if (!(await hasColumn("adm_workflows", "whatsapp_notify"))) {
    await query(
      `ALTER TABLE adm_workflows ADD COLUMN whatsapp_notify TINYINT(1) NOT NULL DEFAULT 1`,
    );
  }
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_steps (
      workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      step_name VARCHAR(150) NOT NULL,
      approver_user_id BIGINT UNSIGNED NOT NULL,
      approver_role_id BIGINT UNSIGNED DEFAULT NULL,
      min_amount DECIMAL(18,2) DEFAULT NULL,
      max_amount DECIMAL(18,2) DEFAULT NULL,
      approval_limit DECIMAL(15,2) DEFAULT NULL,
      is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
      PRIMARY KEY (workflow_id, step_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_document_workflows (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      amount DECIMAL(15,2) DEFAULT 0.00,
      current_step_order INT NOT NULL DEFAULT 1,
      status ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      assigned_to_user_id BIGINT UNSIGNED DEFAULT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_doc_workflow_lookup (document_id, document_type),
      KEY idx_doc_workflow_status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_logs (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      step_order INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      comments VARCHAR(255),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_logs_dw (document_workflow_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_notifications (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      is_read TINYINT(1) NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_notif_user (user_id, is_read)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await query(`
    CREATE TABLE IF NOT EXISTS adm_workflow_tasks (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      company_id BIGINT UNSIGNED NOT NULL,
      workflow_id BIGINT UNSIGNED NOT NULL,
      document_workflow_id BIGINT UNSIGNED NOT NULL,
      document_id BIGINT UNSIGNED NOT NULL,
      document_type VARCHAR(80) NOT NULL,
      step_order INT NOT NULL,
      assigned_to_user_id BIGINT UNSIGNED NOT NULL,
      action ENUM('PENDING','APPROVED','REJECTED','RETURNED') NOT NULL DEFAULT 'PENDING',
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY idx_wf_task_lookup (document_workflow_id, step_order),
      KEY idx_wf_task_assignee (assigned_to_user_id, action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

export const listWorkflows = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const items = await query(
      `SELECT w.*, c.name as company_name,
          w.created_at,
          u.username AS created_by_name
         FROM adm_workflows w
       JOIN adm_companies c ON w.company_id = c.id
        LEFT JOIN adm_users u ON u.id = w.created_by
         WHERE w.company_id = :companyId
       ORDER BY w.workflow_name`,
      { companyId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const reverseApproval = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const userId = req.user.sub;
    // Check exceptional permission
    const rows = await query(
      `SELECT permission_code, effect, is_active,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid 
         AND permission_code IN ('WORKFLOW.APPROVAL.REVERSE', 'WORKFLOW.PENDING_APPROVAL.REVERSE')
         AND is_active = 1 
         AND UPPER(effect) = 'ALLOW'
       LIMIT 1`,
      { uid: userId },
    ).catch(() => []);
    if (!rows || !rows.length) {
      throw httpError(403, "FORBIDDEN", "Reverse approval not permitted");
    }
    // Fetch instance
    const instances = await query(
      `SELECT dw.*, w.id as workflow_id,
          dw.created_at,
          u.username AS created_by_name
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
        LEFT JOIN adm_users u ON u.id = dw.created_by
         WHERE dw.id = :instanceId`,
      { instanceId },
    );
    if (!instances.length)
      throw httpError(404, "NOT_FOUND", "Workflow instance not found");
    const instance = instances[0];
    // Log reversal
    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES (:id, :step, 'REVERSED', :userId, :comments)`,
      {
        id: instance.id,
        step: instance.current_step_order,
        userId,
        comments: "Approval reversed by exceptional permission",
      },
    );
    const isTargetDraft = req.body?.target_status === "DRAFT" || instance.status === "PENDING" || instance.status === "PENDING_APPROVAL";
    const newStatus = isTargetDraft ? "DRAFT" : "REVERSED";

    // Set workflow state to returned/draft and unassign
    await query(
      `UPDATE adm_document_workflows SET status = :status, assigned_to_user_id = NULL WHERE id = :id`,
      { id: instance.id, status: isTargetDraft ? "RETURNED" : "RETURNED" },
    );
    // Mirror document status updates
    if (
      instance.document_type === "STOCK_ADJUSTMENT" ||
      instance.document_type === "Stock Adjustment"
    ) {
      await query(
        `UPDATE inv_stock_adjustments SET status = :status WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id, status: newStatus },
      );
    } else if (
      instance.document_type === "PURCHASE_ORDER" ||
      instance.document_type === "Purchase Order"
    ) {
      await query(
        `UPDATE pur_orders SET status = :status WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id, status: newStatus },
      );
    } else if (
      instance.document_type === "GOODS_RECEIPT" ||
      instance.document_type === "Goods Receipt" ||
      instance.document_type === "GRN" ||
      instance.document_type === "Goods Receipt Note"
    ) {
      await query(
        `UPDATE inv_goods_receipt_notes SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "PAYMENT_VOUCHER" ||
      instance.document_type === "Payment Voucher" ||
      instance.document_type === "PV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "RECEIPT_VOUCHER" ||
      instance.document_type === "Receipt Voucher" ||
      instance.document_type === "RV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "CONTRA_VOUCHER" ||
      instance.document_type === "Contra Voucher" ||
      instance.document_type === "CV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "JOURNAL_VOUCHER" ||
      instance.document_type === "Journal Voucher" ||
      instance.document_type === "JV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "SALES_VOUCHER" ||
      instance.document_type === "Sales Voucher" ||
      instance.document_type === "SV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "PURCHASE_VOUCHER" ||
      instance.document_type === "Purchase Voucher" ||
      instance.document_type === "PUV"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "DEBIT_NOTE" ||
      instance.document_type === "Debit Note" ||
      instance.document_type === "DN"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "CREDIT_NOTE" ||
      instance.document_type === "Credit Note" ||
      instance.document_type === "CN"
    ) {
      await query(
        `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
        { id: instance.document_id, companyId: instance.company_id },
      );
    } else if (
      instance.document_type === "MATERIAL_REQUISITION" ||
      instance.document_type === "Material Requisition"
    ) {
      try {
        await query(
          `UPDATE inv_material_requisitions SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "RETURN_TO_STORES" ||
      instance.document_type === "Return to Stores"
    ) {
      try {
        await query(
          `UPDATE inv_return_to_stores SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "SALES_ORDER" ||
      instance.document_type === "Sales Order"
    ) {
      try {
        await query(
          `UPDATE sal_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (instance.document_type === "SALES_RETURN") {
      try {
        await query(
          `UPDATE sal_returns SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "PURCHASE_RETURN" ||
      instance.document_type === "Purchase Return"
    ) {
      try {
        await query(
          `UPDATE pur_returns SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "SERVICE_REQUEST" ||
      instance.document_type === "Service Request"
    ) {
      try {
        await query(
          `UPDATE pur_service_requests SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      String(instance.document_type || "").toUpperCase() === "MAINT_REQUEST"
    ) {
      try {
        await query(
          `UPDATE maint_requests SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "MAINT_MATERIAL_REQUISITION"
    ) {
      try {
        await query(
          `UPDATE maint_material_requisitions SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "PROJECT_ORDER" ||
      instance.document_type === "Project Order"
    ) {
      try {
        await query(
          `UPDATE pm_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    } else if (
      instance.document_type === "PURCHASE_REQUISITION" ||
      instance.document_type === "Purchase Requisition"
    ) {
      try {
        await query(
          `UPDATE pm_purchase_requisitions SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } catch {}
    }
    // Notify initiator
    // Notify initiator
    const initiatorRes = await query(
      "SELECT actor_user_id FROM adm_workflow_logs WHERE document_workflow_id = :id AND action = 'SUBMIT' LIMIT 1",
      { id: instance.id },
    );
    const initiatorId = initiatorRes.length
      ? initiatorRes[0].actor_user_id
      : null;
    if (initiatorId) {
      await query(
        `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read) 
         VALUES (:companyId, :userId, :title, :message, :link, 0)`,
        {
          companyId: req.scope.companyId,
          userId: initiatorId,
          title: "Approval Reversed",
          message: `Your document #${instance.document_id} approval was reversed.`,
          link: `/administration/workflows/approvals/${instance.id}`,
        },
      );
    }
    res.json({
      success: true,
      message: "Approval reversed and document returned",
    });
  } catch (err) {
    next(err);
  }
};

export const reverseByDocument = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const { companyId = null } = req.scope || {};
    const { document_type, document_id } = req.body || {};
    const docTypeRaw = String(document_type || "").trim();
    const docId = Number(document_id);
    if (!docTypeRaw || !Number.isFinite(docId) || docId <= 0) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid document payload");
    }
    const norm = (s) =>
      String(s || "")
        .trim()
        .toUpperCase()
        .replace(/\s+/g, " ")
        .replace(/ +/g, " ");
    const docTypes = [
      docTypeRaw,
      docTypeRaw.replace(/_/g, " "),
      docTypeRaw.replace(/ /g, "_"),
      docTypeRaw.toUpperCase(),
      docTypeRaw.toLowerCase(),
    ];
    const rows = await query(
      `SELECT permission_code, effect, is_active,
          created_at,
          u.username AS created_by_name
         FROM adm_exceptional_permissions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid 
         AND permission_code IN ('WORKFLOW.APPROVAL.REVERSE', 'WORKFLOW.PENDING_APPROVAL.REVERSE')
         AND is_active = 1 
         AND UPPER(effect) = 'ALLOW'
       LIMIT 1`,
      { uid: userId },
    ).catch(() => []);
    if (!rows || !rows.length) {
      throw httpError(403, "FORBIDDEN", "Reverse approval not permitted");
    }
    const instances = await query(
      `SELECT dw.*, w.id as workflow_id,
          dw.created_at,
          u.username AS created_by_name
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
        LEFT JOIN adm_users u ON u.id = dw.created_by
         WHERE dw.company_id = :companyId
           AND dw.document_id = :docId
           AND (UPPER(dw.document_type) IN (${docTypes
             .map((_, i) => `UPPER(:t${i})`)
             .join(", ")}))
         ORDER BY dw.id DESC
         LIMIT 1`,
      {
        companyId,
        docId,
        ...Object.fromEntries(docTypes.map((v, i) => [`t${i}`, v])),
      },
    );
    if (!instances.length) {
      const tableMap = {
        SALES_ORDER: "sal_orders",
        SALES_INVOICE: "sal_invoices",
        SALES_QUOTATION: "sal_quotations",
        SALES_RETURN: "sal_returns",
        PURCHASE_ORDER: "pur_orders",
        PURCHASE_VOUCHER: "pur_vouchers",
        PURCHASE_RETURN: "pur_returns",
        GOODS_RECEIPT: "inv_goods_receipt_hdr",
        GOODS_ISSUE: "inv_goods_issues",
        MATERIAL_REQUISITION: "inv_material_requisitions",
        STOCK_UPDATION: "inv_stock_adjustments",
        STOCK_VERIFICATION: "inv_stock_verifications",
        GENERAL_REQUISITION: "pur_general_requisitions",
        SERVICE_REQUEST: "srv_service_requests",
        CUSTOMER_PROSPECT: "sal_prospect_customers"
      };
      const tableName = tableMap[docTypeRaw.toUpperCase()];
      if (tableName) {
        // Fallback for manually approved documents without workflow
        await query(`UPDATE ${tableName} SET status = 'DRAFT' WHERE id = :docId AND company_id = :companyId`, { docId, companyId });
        return res.json({ message: "Document reversed to DRAFT (manual approval)" });
      }
      throw httpError(404, "NOT_FOUND", "Workflow instance not found");
    }
    req.params.instanceId = instances[0].id;
    return reverseApproval(req, res, next);
  } catch (err) {
    next(err);
  }
};

function envTrue(v) {
  if (v == null) return false;
  const s = String(v).toLowerCase().trim();
  return s === "1" || s === "true" || s === "yes" || s === "on";
}

export const getWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid ID");

    const workflows = await query(
      `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id AND company_id = :companyId`,
      { id, companyId },
    );
    if (!workflows.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    const workflow = workflows[0];

    const stepsBase = await query(
      `SELECT ws.*,
          ws.created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps ws
        LEFT JOIN adm_users u ON u.id = ws.created_by
         WHERE ws.workflow_id = :id
       ORDER BY ws.step_order ASC`,
      { id },
    );
    const allApprovers = await query(
      `SELECT a.workflow_id, a.step_order, a.approver_user_id, a.approval_limit, u.username,
          a.created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers a
       JOIN adm_users u ON a.approver_user_id = u.id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.workflow_id = :id
       ORDER BY a.step_order ASC, u.username ASC`,
      { id },
    );
    const byStep = {};
    for (const a of allApprovers) {
      const k = `${a.workflow_id}-${a.step_order}`;
      if (!byStep[k]) byStep[k] = [];
      byStep[k].push({
        id: a.approver_user_id,
        username: a.username,
        approval_limit: a.approval_limit,
      });
    }
    const steps = stepsBase.map((s) => {
      const k = `${s.workflow_id}-${s.step_order}`;
      const approvers = byStep[k] || [];
      const first = approvers[0] || null;
      return {
        ...s,
        approver_user_id: s.approver_user_id || (first ? first.id : null),
        approver_name: first ? first.username : null,
        approval_limit:
          s.approval_limit ?? (first ? first.approval_limit : null),
        approvers,
      };
    });

    res.json({ item: { ...workflow, steps } });
  } catch (err) {
    next(err);
  }
};

export const debugWorkflowEmailStatus = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const instanceId = toNumber(req.params.instanceId);
    const { companyId = null } = req.scope || {};
    if (!instanceId) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
    const instRows = await query(
      `SELECT dw.*, w.email_notify, w.sms_notify, w.whatsapp_notify, w.workflow_name,
          dw.created_at,
          u.username AS created_by_name
         FROM adm_document_workflows dw
       JOIN adm_workflows w ON w.id = dw.workflow_id
        LEFT JOIN adm_users u ON u.id = dw.created_by
         WHERE dw.id = :id`,
      { id: instanceId },
    );
    if (!instRows.length)
      throw httpError(404, "NOT_FOUND", "Workflow instance not found");
    const inst = instRows[0];
    const userId = Number(inst.assigned_to_user_id);
    const wfEmailFlag = inst.email_notify;
    const emailNotifyEnabled =
      (wfEmailFlag === null || wfEmailFlag === undefined
        ? 1
        : Number(wfEmailFlag)) === 1;
    const userRows = await query(
      `SELECT id, username, email, is_active, company_id,
          created_at,
          u.username AS created_by_name
         FROM adm_users
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id LIMIT 1`,
      { id: userId },
    );
    const user = userRows[0] || null;
    const prefRows = await query(
      `
      SELECT pref_key, email_enabled,
          created_at,
          u.username AS created_by_name
         FROM adm_notification_prefs
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE user_id = :uid AND pref_key IN ('workflow-approvals','workflow')
      ORDER BY CASE pref_key WHEN 'workflow-approvals' THEN 0 ELSE 1 END
      LIMIT 1
      `,
      { uid: userId },
    ).catch(() => []);
    const pref = prefRows[0] || null;
    const userEmailAllowed =
      !pref || Number(pref.email_enabled) === 1 ? true : false;
    res.json({
      instance: {
        id: inst.id,
        workflow_id: inst.workflow_id,
        workflow_name: inst.workflow_name || null,
        current_step_order: inst.current_step_order,
        assigned_to_user_id: inst.assigned_to_user_id,
      },
      workflow: {
        email_notify_flag: wfEmailFlag,
        email_notify_enabled: emailNotifyEnabled,
      },
      assigned_user: {
        id: user?.id || null,
        username: user?.username || null,
        email: user?.email || null,
        is_active: user ? Number(user.is_active) === 1 : null,
        company_id: user?.company_id || null,
      },
      user_pref: {
        pref_key: pref?.pref_key || null,
        email_enabled: pref?.email_enabled ?? null,
        allows_email: userEmailAllowed,
      },
      mailer: {
        configured: isMailerConfigured(),
      },
      scope: { companyId },
    });
  } catch (err) {
    next(err);
  }
};

export const createWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const {
      workflow_code,
      workflow_name,
      module_key,
      document_type,
      document_route,
      default_behavior,
      is_active,
      steps,
    } = req.body;

    if (!workflow_name || !module_key || !document_type) {
      throw httpError(400, "VALIDATION_ERROR", "Missing required fields");
    }

    const result = await query(
      `INSERT INTO adm_workflows 
       (company_id, workflow_code, workflow_name, module_key, document_type, document_route, default_behavior, email_notify, sms_notify, whatsapp_notify, is_active)
       VALUES (:companyId, :workflow_code, :workflow_name, :module_key, :document_type, :document_route, :default_behavior, :email_notify, :sms_notify, :whatsapp_notify, :is_active)`,
      {
        companyId,
        workflow_code:
          typeof workflow_code === "string" &&
          /^WF-[0-9]{6}$/.test(workflow_code)
            ? workflow_code
            : await nextWorkflowCode(companyId),
        workflow_name,
        module_key,
        document_type,
        document_route:
          typeof document_route === "string" && document_route
            ? document_route
            : null,
        default_behavior:
          typeof default_behavior === "string" &&
          ["BYPASS", "AUTO_APPROVE", "MANUAL"].includes(
            default_behavior.toUpperCase(),
          )
            ? default_behavior.toUpperCase()
            : null,
        email_notify: parseBoolFlag(req.body?.email_notify),
        sms_notify: parseBoolFlag(req.body?.sms_notify),
        whatsapp_notify: parseBoolFlag(req.body?.whatsapp_notify),
        is_active: is_active === undefined ? 1 : Number(Boolean(is_active)),
      },
    );
    const workflowId = result.insertId;

    if (Array.isArray(steps)) {
      for (const step of steps) {
        const ids =
          Array.isArray(step.approver_user_ids) && step.approver_user_ids.length
            ? step.approver_user_ids
            : step.approver_user_id
              ? [step.approver_user_id]
              : [];
        const firstId = ids[0] || null;
        await query(
          `INSERT INTO adm_workflow_steps 
           (workflow_id, step_order, step_name, approver_user_id, approval_limit, is_mandatory)
           VALUES (:workflowId, :step_order, :step_name, :approver_user_id, :approval_limit, :is_mandatory)`,
          {
            workflowId,
            step_order: step.step_order,
            step_name: step.step_name,
            approver_user_id: firstId,
            approval_limit: step.approval_limit
              ? Number(step.approval_limit)
              : null,
            is_mandatory: step.is_mandatory ? 1 : 0,
          },
        );
        for (const uid of ids) {
          await query(
            `INSERT INTO adm_workflow_step_approvers
             (workflow_id, step_order, approver_user_id, approval_limit)
             VALUES (:workflowId, :step_order, :uid, :limit)
             ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
            {
              workflowId,
              step_order: step.step_order,
              uid: uid,
              limit: step.approval_limit ? Number(step.approval_limit) : null,
            },
          );
        }
      }
    }

    res.status(201).json({ id: workflowId, message: "Workflow created" });
  } catch (err) {
    next(err);
  }
};

export const updateWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    const {
      workflow_code,
      workflow_name,
      module_key,
      document_type,
      document_route,
      default_behavior,
      is_active,
      steps,
    } = req.body;

    const existing = await query(
      "SELECT id, is_active FROM adm_workflows WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!existing.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");

    const nextIsActive =
      is_active === undefined ? 1 : Number(Boolean(is_active));

    await query(
      `UPDATE adm_workflows 
       SET workflow_code = :workflow_code,
           workflow_name = :workflow_name,
           module_key = :module_key,
           document_type = :document_type,
           document_route = :document_route,
           default_behavior = :default_behavior,
           email_notify = :email_notify,
           sms_notify = :sms_notify,
           whatsapp_notify = :whatsapp_notify,
           is_active = :is_active
       WHERE id = :id`,
      {
        id,
        workflow_code,
        workflow_name,
        module_key,
        document_type,
        document_route:
          typeof document_route === "string" && document_route
            ? document_route
            : null,
        default_behavior:
          typeof default_behavior === "string" &&
          ["BYPASS", "AUTO_APPROVE", "MANUAL"].includes(
            default_behavior.toUpperCase(),
          )
            ? default_behavior.toUpperCase()
            : null,
        email_notify: parseBoolFlag(req.body?.email_notify),
        sms_notify: parseBoolFlag(req.body?.sms_notify),
        whatsapp_notify: parseBoolFlag(req.body?.whatsapp_notify),
        is_active: nextIsActive,
      },
    );

    await query("DELETE FROM adm_workflow_steps WHERE workflow_id = :id", {
      id,
    });
    await query(
      "DELETE FROM adm_workflow_step_approvers WHERE workflow_id = :id",
      { id },
    );

    if (Array.isArray(steps)) {
      for (const step of steps) {
        const ids =
          Array.isArray(step.approver_user_ids) && step.approver_user_ids.length
            ? step.approver_user_ids
            : step.approver_user_id
              ? [step.approver_user_id]
              : [];
        const firstId = ids[0] || null;
        await query(
          `INSERT INTO adm_workflow_steps 
           (workflow_id, step_order, step_name, approver_user_id, approval_limit, is_mandatory)
           VALUES (:workflowId, :step_order, :step_name, :approver_user_id, :approval_limit, :is_mandatory)`,
          {
            workflowId: id,
            step_order: step.step_order,
            step_name: step.step_name,
            approver_user_id: firstId,
            approval_limit: step.approval_limit
              ? Number(step.approval_limit)
              : null,
            is_mandatory: step.is_mandatory ? 1 : 0,
          },
        );
        for (const uid of ids) {
          await query(
            `INSERT INTO adm_workflow_step_approvers
             (workflow_id, step_order, approver_user_id, approval_limit)
             VALUES (:workflowId, :step_order, :uid, :limit)
             ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
            {
              workflowId: id,
              step_order: step.step_order,
              uid: uid,
              limit: step.approval_limit ? Number(step.approval_limit) : null,
            },
          );
        }
      }
    }

    if (Number(existing[0]?.is_active) === 1 && Number(nextIsActive) === 0) {
      await autoApprovePendingWorkflowDocuments({
        workflowId: id,
        companyId,
        actorUserId: req.user?.sub || null,
      });
    }

    res.json({ message: "Workflow updated" });
  } catch (err) {
    next(err);
  }
};

export const deleteWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const id = toNumber(req.params.id);
    const existing = await query(
      "SELECT id FROM adm_workflows WHERE id = :id AND company_id = :companyId",
      { id, companyId },
    );
    if (!existing.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    await query("DELETE FROM adm_workflows WHERE id = :id", { id });
    res.json({ message: "Workflow deleted" });
  } catch (err) {
    next(err);
  }
};

export const startWorkflow = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const { workflow_id, document_id, document_type, target_user_id, comments } =
      req.body;

    const workflows = await query(
      `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :workflow_id AND company_id = :companyId`,
      { workflow_id, companyId },
    );
    if (!workflows.length)
      throw httpError(404, "NOT_FOUND", "Workflow not found");
    const workflow = workflows[0];

    const steps = await query(
      `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :workflow_id ORDER BY step_order ASC LIMIT 1`,
      { workflow_id },
    );
    if (!steps.length)
      throw httpError(400, "BAD_REQUEST", "Workflow has no steps");
    const firstStep = steps[0];
    const firstApproverRows = await query(
      `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :workflow_id AND step_order = :step_order
       ORDER BY approver_user_id ASC LIMIT 1`,
      { workflow_id, step_order: firstStep.step_order },
    );
    const allowedUsers = await query(
      `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :workflow_id AND step_order = :step_order`,
      { workflow_id, step_order: firstStep.step_order },
    );
    const allowedSet = new Set(
      allowedUsers.map((r) => Number(r.approver_user_id)),
    );
    let firstAssigned =
      firstApproverRows.length > 0
        ? firstApproverRows[0].approver_user_id
        : firstStep.approver_user_id;
    if (target_user_id && allowedSet.has(Number(target_user_id))) {
      firstAssigned = Number(target_user_id);
    }

    const result = await query(
      `INSERT INTO adm_document_workflows 
       (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
       VALUES (:companyId, :workflow_id, :document_id, :document_type, :amount, :step_order, 'PENDING', :user_id)`,
      {
        companyId,
        workflow_id,
        document_id,
        document_type: document_type || workflow.document_type,
        amount: toNumber(req.body.amount, 0),
        step_order: firstStep.step_order,
        user_id: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_tasks
       (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
       VALUES (:companyId, :workflow_id, :dw_id, :document_id, :document_type, :step_order, :assigned_to, 'PENDING')`,
      {
        companyId,
        workflow_id,
        dw_id: result.insertId,
        document_id,
        document_type: document_type || workflow.document_type,
        step_order: firstStep.step_order,
        assigned_to: firstAssigned,
      },
    );

    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES (:id, :step, 'SUBMIT', :userId, :comments)`,
      {
        id: result.insertId,
        step: firstStep.step_order,
        userId: req.user.sub,
        comments: comments || 'Workflow started'
      },
    );
    // Global interception in pool.js handles workflow forwarding notifications automatically

    res.status(201).json({
      message: "Workflow started",
      instanceId: result.insertId,
    });
  } catch (err) {
    next(err);
  }
};

export const getLatestComment = async (req, res, next) => {
  try {
    const { documentType, documentId } = req.params;
    const { companyId = null } = req.scope || {};

    const logs = await query(
      `SELECT l.comments 
       FROM adm_workflow_logs l
       JOIN adm_document_workflows w ON w.id = l.document_workflow_id
       WHERE w.document_type = :documentType 
         AND w.document_id = :documentId
         AND w.company_id = :companyId
         AND l.comments IS NOT NULL
         AND l.comments != ''
         AND l.comments != 'Workflow started'
       ORDER BY l.id DESC
       LIMIT 1`,
      { documentType, documentId, companyId }
    );

    if (logs.length > 0) {
      res.json({ comment: logs[0].comments });
    } else {
      res.json({ comment: null });
    }
  } catch (err) {
    next(err);
  }
};

export const getPendingApprovals = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { companyId = null } = req.scope || {};
    const userId = req.user.sub;
    const items = await query(
      `SELECT 
          dw.id as workflow_instance_id,
          dw.document_id,
          dw.document_type,
          dw.amount,
          dw.current_step_order,
          dw.created_at as submitted_at,
          w.workflow_name,
          ws.step_name,
          COALESCE(so.order_no, fv.voucher_no, po.po_no, mr.requisition_no, rts.rts_no, sa.adjustment_no, grn.grn_no, pm_ord.order_no, pm_pr.requisition_no, gr.requisition_no, inv.invoice_no) as doc_ref,
          po.po_type as po_type,
          u.username as initiator,
          (
            SELECT COUNT(*) = 0
            FROM adm_workflow_steps
            WHERE workflow_id = w.id AND step_order > dw.current_step_order
          ) as is_last_step
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
         JOIN adm_workflow_steps ws ON w.id = ws.workflow_id AND dw.current_step_order = ws.step_order
         LEFT JOIN sal_invoices inv
           ON (dw.document_type = 'SALES_INVOICE' OR dw.document_type = 'Sales Invoice')
          AND inv.id = dw.document_id
         LEFT JOIN sal_orders so
           ON (dw.document_type = 'SALES_ORDER' OR dw.document_type = 'Sales Order')
          AND so.id = dw.document_id
         LEFT JOIN pur_orders po
           ON (dw.document_type = 'PURCHASE_ORDER' OR dw.document_type = 'Purchase Order')
          AND po.id = dw.document_id
         LEFT JOIN inv_material_requisitions mr 
           ON (dw.document_type = 'MATERIAL_REQUISITION' OR dw.document_type = 'Material Requisition') 
          AND mr.id = dw.document_id
         LEFT JOIN inv_return_to_stores rts 
           ON (dw.document_type = 'RETURN_TO_STORES' OR dw.document_type = 'Return to Stores') 
          AND rts.id = dw.document_id
         LEFT JOIN inv_stock_adjustments sa
           ON (dw.document_type = 'STOCK_ADJUSTMENT' OR dw.document_type = 'Stock Adjustment')
          AND sa.id = dw.document_id
         LEFT JOIN inv_goods_receipt_notes grn
           ON (
             dw.document_type = 'GOODS_RECEIPT' OR 
             dw.document_type = 'Goods Receipt' OR
             dw.document_type = 'GRN' OR
             dw.document_type = 'Goods Receipt Note'
           )
           AND grn.id = dw.document_id
           LEFT JOIN pm_orders pm_ord
             ON (dw.document_type = 'PROJECT_ORDER' OR dw.document_type = 'Project Order')
            AND pm_ord.id = dw.document_id
           LEFT JOIN pm_purchase_requisitions pm_pr
             ON (dw.document_type = 'PURCHASE_REQUISITION' OR dw.document_type = 'Purchase Requisition')
            AND pm_pr.id = dw.document_id
           LEFT JOIN pur_general_requisitions gr
             ON (dw.document_type = 'GENERAL_REQUISITION' OR dw.document_type = 'General Requisition')
            AND gr.id = dw.document_id
           LEFT JOIN fin_vouchers fv
            ON (
              dw.document_type = 'PAYMENT_VOUCHER' OR
              dw.document_type = 'Payment Voucher' OR
              dw.document_type = 'PV' OR
              dw.document_type = 'RECEIPT_VOUCHER' OR
              dw.document_type = 'Receipt Voucher' OR
              dw.document_type = 'RV' OR
              dw.document_type = 'JOURNAL_VOUCHER' OR
              dw.document_type = 'Journal Voucher' OR
              dw.document_type = 'JV' OR
              dw.document_type = 'CONTRA_VOUCHER' OR
              dw.document_type = 'Contra Voucher' OR
              dw.document_type = 'CV' OR
              dw.document_type = 'DEBIT_NOTE' OR
              dw.document_type = 'Debit Note' OR
              dw.document_type = 'DN' OR
              dw.document_type = 'CREDIT_NOTE' OR
              dw.document_type = 'Credit Note' OR
              dw.document_type = 'CN'
            ) AND fv.id = dw.document_id
         LEFT JOIN adm_users u ON u.id = (
             SELECT actor_user_id FROM adm_workflow_logs 
             WHERE document_workflow_id = dw.id AND action = 'SUBMIT' LIMIT 1
         )
         WHERE dw.company_id = :companyId
           AND dw.status = 'PENDING'
           AND dw.assigned_to_user_id = :userId
         ORDER BY dw.created_at DESC`,
      { companyId, userId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const getApprovalInstanceDetail = async (req, res, next) => {
  try {
    await ensureWorkflowTables();
    const { instanceId } = req.params;
    const { companyId = null } = req.scope || {};
    const instances = await query(
      `SELECT dw.*, 
               w.workflow_name, w.workflow_code,
               ws.step_name, ws.approver_user_id, ws.approval_limit,
               (SELECT COUNT(*)
         FROM adm_workflow_steps
         WHERE workflow_id = w.id AND step_order > dw.current_step_order) = 0 as is_last_step
        FROM adm_document_workflows dw
        JOIN adm_workflows w ON dw.workflow_id = w.id
        JOIN adm_workflow_steps ws ON w.id = ws.workflow_id AND dw.current_step_order = ws.step_order
        WHERE dw.id = :instanceId AND dw.company_id = :companyId`,
      { instanceId, companyId },
    );
    if (!instances.length)
      throw httpError(404, "NOT_FOUND", "Instance not found");
    const instance = instances[0];
    let next_step_order = null;
    const nextStepRow = await query(
      `SELECT step_order,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wid AND step_order > :cur
         ORDER BY step_order ASC LIMIT 1`,
      { wid: instance.workflow_id, cur: instance.current_step_order },
    );
    if (nextStepRow.length) {
      next_step_order = nextStepRow[0].step_order;
    }
    let next_step_approvers = [];
    if (next_step_order != null) {
      next_step_approvers = await query(
        `SELECT a.approver_user_id as id, u.username, a.approval_limit,
          a.created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers a
           JOIN adm_users u ON u.id = a.approver_user_id
        LEFT JOIN adm_users u ON u.id = a.created_by
         WHERE a.workflow_id = :wid AND a.step_order = :ord
           ORDER BY u.username ASC`,
        { wid: instance.workflow_id, ord: next_step_order },
      );
    }
    const logs = await query(
      `SELECT l.*, u.username as actor_name,
          l.created_at
         FROM adm_workflow_logs l
       LEFT JOIN adm_users u ON l.actor_user_id = u.id
         WHERE l.document_workflow_id = :instanceId
       ORDER BY l.created_at DESC`,
      { instanceId },
    );
    res.json({
      item: { ...instance, logs, next_step_order, next_step_approvers },
    });
  } catch (err) {
    next(err);
  }
};

export const getNotifications = async (req, res, next) => {
  try {
    const userId = req.user.sub;
    const items = await query(
      `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_notifications
        LEFT JOIN adm_users u ON u.id = created_by
        WHERE user_id = :userId 
        ORDER BY created_at DESC`,
      { userId },
    );
    res.json({ items });
  } catch (err) {
    next(err);
  }
};

export const markNotificationRead = async (req, res, next) => {
  try {
    const id = toNumber(req.params.id);
    await query(
      "UPDATE adm_notifications SET is_read = 1 WHERE id = :id AND user_id = :userId",
      { id, userId: req.user.sub },
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    next(err);
  }
};

export const markNotificationsReadBulk = async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.json({ message: "No notifications to mark as read" });
    }
    const userId = req.user.sub;

    // Create placeholders for the IN clause
    const placeholders = ids.map((_, i) => `:id${i}`).join(", ");
    const params = { userId };
    ids.forEach((id, i) => {
      params[`id${i}`] = toNumber(id);
    });

    await query(
      `UPDATE adm_notifications SET is_read = 1 WHERE user_id = :userId AND id IN (${placeholders})`,
      params,
    );
    res.json({ message: "Marked selected as read" });
  } catch (err) {
    next(err);
  }
};

export const performAction = async (req, res, next) => {
  try {
    const { instanceId } = req.params;
    const { action, comments } = req.body;
    const userId = req.user.sub;
    if (!["APPROVE", "REJECT", "RETURN"].includes(action)) {
      throw httpError(400, "VALIDATION_ERROR", "Invalid action");
    }
    const instances = await query(
      `SELECT dw.*, w.id as workflow_id,
          dw.created_at,
          u.username AS created_by_name
         FROM adm_document_workflows dw
         JOIN adm_workflows w ON dw.workflow_id = w.id
        LEFT JOIN adm_users u ON u.id = dw.created_by
         WHERE dw.id = :instanceId`,
      { instanceId },
    );
    if (!instances.length)
      throw httpError(404, "NOT_FOUND", "Workflow instance not found");
    const instance = instances[0];
    if (instance.assigned_to_user_id !== userId) {
      throw httpError(
        403,
        "FORBIDDEN",
        "You are not authorized to approve this step (Assigned to someone else)",
      );
    }
    const currentStepRes = await query(
      `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :workflowId AND step_order = :stepOrder`,
      {
        workflowId: instance.workflow_id,
        stepOrder: instance.current_step_order,
      },
    );
    const currentStep = currentStepRes[0];
    if (
      action === "APPROVE" &&
      currentStep.approval_limit !== null &&
      instance.amount > currentStep.approval_limit
    ) {
      const isLastStep = await query(
        `SELECT COUNT(*) as count,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wid AND step_order > :ord`,
        { wid: instance.workflow_id, ord: instance.current_step_order },
      );
      if (isLastStep[0].count === 0) {
        throw httpError(
          403,
          "FORBIDDEN",
          `Amount ${instance.amount} exceeds your approval limit of ${currentStep.approval_limit}. You cannot final approve.`,
        );
      }
    }
    await query(
      `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES (:id, :step, :action, :userId, :comments)`,
      {
        id: instance.id,
        step: instance.current_step_order,
        action,
        userId,
        comments: comments || "",
      },
    );
    const getInitiator = async () => {
      const logs = await query(
        "SELECT actor_user_id FROM adm_workflow_logs WHERE document_workflow_id = :id AND action = 'SUBMIT' LIMIT 1",
        { id: instance.id },
      );
      return logs.length ? logs[0].actor_user_id : null;
    };
    const notifyUser = async (targetUserId, title, message) => {
      if (!targetUserId) return;
      try {
        await query(
          `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read) 
             VALUES (:companyId, :userId, :title, :message, :link, 0)`,
          {
            companyId: req.scope.companyId,
            userId: targetUserId,
            title: title || "Workflow Notification",
            message: message || "A workflow action requires your attention.",
            link: `/administration/workflows/approvals/${instance.id}`,
          },
        );
      } catch (err) {
        console.error("Error inserting notification DB record:", err);
      }

      // Send push, email, SMS, WhatsApp notifications asynchronously via setImmediate background task
      setImmediate(async () => {
        try {
          const pushPayload = {
            title: title || "Workflow Action Required",
            message: message || "A workflow document requires your attention.",
            type: "workflow",
            link: `/administration/workflows/approvals/${instance.id}`,
            icon: "/OMNISUITE_ICON_CLEAR.png",
            badge: "/OMNISUITE_ICON_CLEAR.png",
            tag: `workflow-${instance.id}`,
            timestamp: new Date().toISOString(),
          };
          await sendPushToUser(targetUserId, pushPayload);
        } catch (err) {
          console.error("Error sending push notification:", err);
        }

        try {
          const wfRows = await query(
            "SELECT email_notify, sms_notify, whatsapp_notify FROM adm_workflows WHERE id = :id LIMIT 1",
            { id: instance.workflow_id },
          ).catch(() => []);
          const emailFlag = wfRows.length ? wfRows[0].email_notify : 1;
          const smsFlag = wfRows.length ? wfRows[0].sms_notify : 1;
          const whatsappFlag = wfRows.length ? wfRows[0].whatsapp_notify : 1;
          const emailEnabled = (emailFlag === null || emailFlag === undefined ? 1 : Number(emailFlag)) === 1;
          const smsEnabled = (smsFlag === null || smsFlag === undefined ? 1 : Number(smsFlag)) === 1;
          const whatsappEnabled = (whatsappFlag === null || whatsappFlag === undefined ? 1 : Number(whatsappFlag)) === 1;
          const forceEmail = envTrue(process.env.WORKFLOW_FORCE_EMAIL);

          if (!emailEnabled && !forceEmail) return;

          let userEmailEnabled = 1;
          let userSmsEnabled = 1;
          let userWhatsappEnabled = 1;
          try {
            const prefRows = await query(
              `SELECT email_enabled, sms_enabled, whatsapp_enabled FROM adm_notification_prefs WHERE user_id = :uid AND pref_key IN ('workflow-approvals','workflow') ORDER BY CASE pref_key WHEN 'workflow-approvals' THEN 0 ELSE 1 END LIMIT 1`,
              { uid: targetUserId },
            );
            if (prefRows.length) {
              userEmailEnabled = Number(prefRows[0].email_enabled) === 1 ? 1 : 0;
              userSmsEnabled = Number(prefRows[0].sms_enabled) === 1 ? 1 : 0;
              userWhatsappEnabled = Number(prefRows[0].whatsapp_enabled) === 1 ? 1 : 0;
            }
          } catch {}

          if (!userEmailEnabled && !forceEmail) return;

          const userRes = await query(
            "SELECT username, email, telephone FROM adm_users WHERE id = :id AND company_id = :companyId AND is_active = 1 LIMIT 1",
            { id: targetUserId, companyId: req.scope.companyId },
          ).catch(() => []);

          if (!userRes.length || !userRes[0].email) return;

          const to = userRes[0].email;
          const subject = "Workflow Document - Action Required";
          const docType = instance.document_type || "Workflow Document";
          const refNo = instance.document_id != null ? String(instance.document_id) : "-";

          const senderRows = await query(
            "SELECT username AS name FROM adm_users WHERE id = :id LIMIT 1",
            { id: req.user?.sub || null },
          ).catch(() => []);
          const senderName = senderRows.length ? senderRows[0].name : "System";

          const actionLabel = /approval/i.test(title)
            ? "Approval"
            : /review/i.test(title)
              ? "Review"
              : "Action Required";

          let baseUrl = process.env.APP_URL;
          if (!baseUrl && req.headers?.origin) baseUrl = req.headers.origin;
          if (!baseUrl) baseUrl = "http://localhost:3000";
          const linkAbs = `${baseUrl}/administration/workflows/approvals/${instance.id}`;
          const nowStr = new Date().toISOString();

          const textContent =
            `Hello,\n\n${message}\n\n` +
            `Document Type: ${docType}\nReference No: ${refNo}\nSent By: ${senderName}\nAction Required: ${actionLabel}\nDate & Time: ${nowStr}\n\nOpen Document:\n${linkAbs}\n\nThank you.\nERP Notification System`;

          const htmlContent =
            `<p>Hello,</p><p>${message}</p>` +
            `<div style="background-color: #f5f5f5; padding: 12px; border-radius: 4px; margin: 16px 0;">` +
            `<p><strong>Document Type:</strong> ${docType}<br/>` +
            `<strong>Reference No:</strong> ${refNo}<br/>` +
            `<strong>Sent By:</strong> ${senderName}<br/>` +
            `<strong>Action Required:</strong> ${actionLabel}<br/>` +
            `<strong>Date & Time:</strong> ${nowStr}</p></div>` +
            `<p><a href="${linkAbs}" style="background-color: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">View Document</a></p>` +
            `<p>Thank you.<br/>ERP Notification System</p>`;

          try {
            await sendMail({
              to,
              subject,
              text: textContent,
              html: htmlContent,
              meta: {
                companyId: req.scope.companyId,
                userId: targetUserId,
                moduleName: "Workflow",
                action: "EMAIL_SENT",
                refNo: refNo,
                urlPath: `/administration/workflows/approvals/${instance.id}`,
              },
            });
          } catch (err) {
            console.error("Error sending workflow email:", err);
          }

          const phone = userRes[0].telephone;
          if (phone && isSMSConfigured() && smsEnabled && userSmsEnabled) {
            try {
              const smsText = `Action Required: ${docType} ${refNo} needs your ${actionLabel}. View: ${linkAbs}`;
              await sendSMS({ to: phone, message: smsText });
            } catch (err) {
              console.error("Error sending workflow SMS:", err);
            }
          }

          if (phone && isWhatsAppConfigured() && whatsappEnabled && userWhatsappEnabled) {
            try {
              const waText = `*Action Required*\n${docType} ${refNo} needs your ${actionLabel}.\n\nView Document:\n${linkAbs}`;
              await sendWhatsApp({ to: phone, message: waText });
            } catch (err) {
              console.error("Error sending workflow WhatsApp:", err);
            }
          }
        } catch (err) {
          console.error("Error in background notifyUser async task:", err);
        }
      });
    };
    if (action === "APPROVE") {
      const nextSteps = await query(
        `SELECT *,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_steps
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :workflowId AND step_order > :currentOrder 
            ORDER BY step_order ASC LIMIT 1`,
        {
          workflowId: instance.workflow_id,
          currentOrder: instance.current_step_order,
        },
      );
      if (nextSteps.length > 0) {
        const nextStep = nextSteps[0];
        if (!nextStep.approver_user_id) {
          throw httpError(
            400,
            "BAD_REQUEST",
            "Next workflow step has no approver_user_id configured",
          );
        }
        const allowedUsers = await query(
          `SELECT approver_user_id,
          created_at,
          u.username AS created_by_name
         FROM adm_workflow_step_approvers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE workflow_id = :wid AND step_order = :ord`,
          { wid: instance.workflow_id, ord: nextStep.step_order },
        );
        const allowedSet = new Set(
          allowedUsers.map((r) => Number(r.approver_user_id)),
        );
        const targetUserIdRaw = req.body?.target_user_id;
        let nextAssigned = null;
        if (
          targetUserIdRaw != null &&
          allowedSet.has(Number(targetUserIdRaw))
        ) {
          nextAssigned = Number(targetUserIdRaw);
        } else if (allowedUsers.length > 0) {
          nextAssigned = Number(allowedUsers[0].approver_user_id);
        } else {
          nextAssigned = Number(nextStep.approver_user_id);
        }
        await query(
          `UPDATE adm_document_workflows 
              SET current_step_order = :nextOrder, assigned_to_user_id = :nextUser 
              WHERE id = :id`,
          {
            id: instance.id,
            nextOrder: nextStep.step_order,
            nextUser: nextAssigned,
          },
        );
        await query(
          `UPDATE adm_workflow_tasks
             SET action = 'APPROVED'
             WHERE document_workflow_id = :dw AND step_order = :cur`,
          { dw: instance.id, cur: instance.current_step_order },
        );
        await query(
          `INSERT INTO adm_workflow_tasks
             (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
             VALUES (:companyId, :workflow_id, :dw_id, :document_id, :document_type, :step_order, :assigned_to, 'PENDING')`,
          {
            companyId: req.scope.companyId,
            workflow_id: instance.workflow_id,
            dw_id: instance.id,
            document_id: instance.document_id,
            document_type: instance.document_type,
            step_order: nextStep.step_order,
            assigned_to: nextAssigned,
          },
        );
        setImmediate(() => {
          notifyUser(
            nextAssigned,
            "Approval Required",
            `Document #${instance.document_id} requires your approval.`,
          ).catch((err) => console.error("Error in background notifyUser:", err));

          import("../services/notifications/workflowNotify.js")
            .then(({ notifyWorkflowForward }) => {
              query("SELECT username AS name FROM adm_users WHERE id = :id LIMIT 1", {
                id: req.user?.sub || null,
              })
                .then((senderRows) => {
                  const senderName = senderRows.length ? senderRows[0].name : "System";
                  return notifyWorkflowForward({
                    companyId: req.scope.companyId,
                    userId: nextAssigned,
                    workflowInstanceId: instance.id,
                    documentId: instance.document_id,
                    documentType: instance.document_type,
                    title: "Document Forwarded For Approval",
                    message: `Document #${instance.document_id} has been forwarded to you for approval.`,
                    action: "APPROVE",
                    senderName,
                    req: req,
                  });
                })
                .catch((err) => console.error("Error sending forward notifications:", err));
            })
            .catch((err) => console.error("Error importing workflowNotify:", err));
        });
      } else {
        await query(
          `UPDATE adm_document_workflows SET status = 'APPROVED', assigned_to_user_id = NULL WHERE id = :id`,
          { id: instance.id },
        );
        await query(
          `UPDATE adm_workflow_tasks
             SET action = 'APPROVED'
             WHERE document_workflow_id = :dw AND step_order = :cur`,
          { dw: instance.id, cur: instance.current_step_order },
        );
        if (
          String(instance.document_type || "").toUpperCase() === "MAINT_REQUEST"
        ) {
          await query(
            `UPDATE maint_requests SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        }
        if (
          instance.document_type === "MAINT_MATERIAL_REQUISITION"
        ) {
          await query(
            `UPDATE maint_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        }
        if (
          instance.document_type === "PROJECT_ORDER" ||
          instance.document_type === "Project Order"
        ) {
          await query(
            `UPDATE pm_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        }
        if (
          instance.document_type === "PURCHASE_REQUISITION" ||
          instance.document_type === "Purchase Requisition"
        ) {
          await query(
            `UPDATE pm_purchase_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        }
        if (
          instance.document_type === "SALES_ORDER" ||
          instance.document_type === "Sales Order"
        ) {
          await query(
            `UPDATE sal_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        }
        if (
          instance.document_type === "SALES_INVOICE" ||
          instance.document_type === "Sales Invoice"
        ) {
          const conn = await pool.getConnection();
          try {
            const invoiceId = instance.document_id;
            const companyId = instance.company_id;
            const invoices = await query(
              "SELECT id, invoice_no, invoice_date, customer_id, branch_id, net_amount, balance_amount, status, currency_id, exchange_rate, remarks, tax_components FROM sal_invoices WHERE id = :id AND company_id = :companyId LIMIT 1",
              { id: invoiceId, companyId }
            );
            if (invoices.length) {
              const inv = invoices[0];
              const branchId = inv.branch_id || null;
              const branchIdsStr = branchId ? String(branchId) : '';
              const details = await query(
                "SELECT item_id, quantity, unit_price, discount_percent, total_amount, net_amount, tax_amount, tax_type FROM sal_invoice_details WHERE invoice_id = :id",
                { id: invoiceId }
              );
              
              let subTotal = 0;
              let taxTotal = 0;
              let grandTotal = 0;
              let discountTotal = 0;
              for (const l of details) {
                const qty = Number(l.quantity || 0);
                const price = Number(l.unit_price || 0);
                const discPct = Number(l.discount_percent || 0);
                const gross = qty * price;
                const discount = (gross * discPct) / 100;
                const net = gross - discount;
                const taxAmt = Number(l.tax_amount || 0);
                subTotal += net;
                taxTotal += taxAmt;
                grandTotal += net + taxAmt;
                discountTotal += discount;
              }

              const bal = Number(inv.balance_amount || inv.net_amount || grandTotal);
              const paymentStatus = bal <= 0 ? "PAID" : bal > 0 ? "UNPAID" : "PARTIALLY_PAID";

              await conn.beginTransaction();
              await conn.execute(
                `UPDATE sal_invoices
                   SET status = 'POSTED',
                       payment_status = :paymentStatus,
                       balance_amount = :balance,
                       total_amount = :totalAmount,
                       net_amount = :netAmount,
                       tax_amount = :taxAmount
                 WHERE id = :id AND company_id = :companyId`,
                {
                  id: invoiceId,
                  companyId,
                  paymentStatus,
                  balance: bal,
                  totalAmount: grandTotal,
                  netAmount: grandTotal,
                  taxAmount: taxTotal,
                }
              );

              let parsedTaxes = [];
              try { parsedTaxes = JSON.parse(inv.tax_components || "[]"); } catch (e) {}

              await createPostedSalesVoucherForInvoiceTx(conn, {
                companyId,
                branchId, branchIdsStr,
                invoiceId,
                invoiceNo: String(inv.invoice_no || ""),
                invoiceDate: inv.invoice_date || new Date().toISOString().slice(0, 10),
                customerId: Number(inv.customer_id || 0),
                grandTotal,
                baseTotal: subTotal,
                taxTotal,
                discountTotal,
                currencyId: inv.currency_id || null,
                exchangeRate: inv.exchange_rate || 1,
                createdBy: userId || null,
                lineTaxes: parsedTaxes,
                itemLines: details.map((d) => ({
                  item_id: d.item_id,
                  quantity: d.quantity,
                  unit_price: d.unit_price,
                  discount_percent: d.discount_percent,
                })),
                remarks: inv.remarks || null,
              });

              await conn.commit();
            }
          } catch (e) {
            console.error("Error creating sales voucher from workflow approval:", e);
            try { await conn.rollback(); } catch {}
            throw e;
          } finally {
            conn.release();
          }
        }
        getInitiator().then((initiatorId) => {
          if (initiatorId) {
            setImmediate(() => {
              notifyUser(
                initiatorId,
                "Document Approved",
                `Your document #${instance.document_id} has been fully approved.`,
              ).catch((err) => console.error("Error in background notifyUser:", err));
            });
          }
        }).catch(() => {});
      }
    } else if (action === "REJECT") {
      await query(
        `UPDATE adm_document_workflows SET status = 'REJECTED', assigned_to_user_id = NULL WHERE id = :id`,
        { id: instance.id },
      );
      await query(
        `UPDATE adm_workflow_tasks
           SET action = 'REJECTED'
           WHERE document_workflow_id = :dw AND step_order = :cur`,
        { dw: instance.id, cur: instance.current_step_order },
      );
      if (
        instance.document_type === "STOCK_ADJUSTMENT" ||
        instance.document_type === "Stock Adjustment"
      ) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PURCHASE_ORDER" ||
        instance.document_type === "Purchase Order"
      ) {
        await query(
          `UPDATE pur_orders SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "GOODS_RECEIPT" ||
        instance.document_type === "Goods Receipt" ||
        instance.document_type === "GRN" ||
        instance.document_type === "Goods Receipt Note"
      ) {
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PAYMENT_VOUCHER" ||
        instance.document_type === "Payment Voucher" ||
        instance.document_type === "PV" ||
        instance.document_type === "RECEIPT_VOUCHER" ||
        instance.document_type === "Receipt Voucher" ||
        instance.document_type === "RV" ||
        instance.document_type === "JOURNAL_VOUCHER" ||
        instance.document_type === "Journal Voucher" ||
        instance.document_type === "JV" ||
        instance.document_type === "CONTRA_VOUCHER" ||
        instance.document_type === "Contra Voucher" ||
        instance.document_type === "CV" ||
        instance.document_type === "DEBIT_NOTE" ||
        instance.document_type === "Debit Note" ||
        instance.document_type === "DN" ||
        instance.document_type === "CREDIT_NOTE" ||
        instance.document_type === "Credit Note" ||
        instance.document_type === "CN"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "SALES_ORDER" ||
        instance.document_type === "Sales Order"
      ) {
        await query(
          `UPDATE sal_orders SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "SALES_INVOICE" ||
        instance.document_type === "Sales Invoice"
      ) {
        await query(
          `UPDATE sal_invoices SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "GENERAL_REQUISITION" ||
        instance.document_type === "General Requisition"
      ) {
        try {
          await query(
            `UPDATE pur_general_requisitions SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "STOCK_UPDATION" ||
        instance.document_type === "Stock Updation"
      ) {
        try {
          await query(
            `UPDATE inv_stock_updations SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "STOCK_VERIFICATION" ||
        instance.document_type === "Stock Verification"
      ) {
        try {
          await query(
            `UPDATE inv_stock_verifications SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "MAINT_MATERIAL_REQUISITION"
      ) {
        try {
          await query(
            `UPDATE maint_material_requisitions SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "PROJECT_ORDER" ||
        instance.document_type === "Project Order"
      ) {
        try {
          await query(
            `UPDATE pm_orders SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "PURCHASE_REQUISITION" ||
        instance.document_type === "Purchase Requisition"
      ) {
        try {
          await query(
            `UPDATE pm_purchase_requisitions SET status = 'REJECTED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      }
      const initiatorId = await getInitiator();
      await notifyUser(
        initiatorId,
        "Document Rejected",
        `Your document #${instance.document_id} was rejected.`,
      );
    } else if (action === "RETURN") {
      await query(
        `UPDATE adm_document_workflows SET status = 'RETURNED', assigned_to_user_id = NULL WHERE id = :id`,
        { id: instance.id },
      );
      await query(
        `UPDATE adm_workflow_tasks
           SET action = 'RETURNED'
           WHERE document_workflow_id = :dw AND step_order = :cur`,
        { dw: instance.id, cur: instance.current_step_order },
      );
      if (
        instance.document_type === "STOCK_ADJUSTMENT" ||
        instance.document_type === "Stock Adjustment"
      ) {
        await query(
          `UPDATE inv_stock_adjustments SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PURCHASE_ORDER" ||
        instance.document_type === "Purchase Order"
      ) {
        await query(
          `UPDATE pur_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "GOODS_RECEIPT" ||
        instance.document_type === "Goods Receipt" ||
        instance.document_type === "GRN" ||
        instance.document_type === "Goods Receipt Note"
      ) {
        await query(
          `UPDATE inv_goods_receipt_notes SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "PAYMENT_VOUCHER" ||
        instance.document_type === "Payment Voucher" ||
        instance.document_type === "PV" ||
        instance.document_type === "RECEIPT_VOUCHER" ||
        instance.document_type === "Receipt Voucher" ||
        instance.document_type === "RV" ||
        instance.document_type === "JOURNAL_VOUCHER" ||
        instance.document_type === "Journal Voucher" ||
        instance.document_type === "JV" ||
        instance.document_type === "CONTRA_VOUCHER" ||
        instance.document_type === "Contra Voucher" ||
        instance.document_type === "CV" ||
        instance.document_type === "DEBIT_NOTE" ||
        instance.document_type === "Debit Note" ||
        instance.document_type === "DN" ||
        instance.document_type === "CREDIT_NOTE" ||
        instance.document_type === "Credit Note" ||
        instance.document_type === "CN"
      ) {
        await query(
          `UPDATE fin_vouchers SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
          { id: instance.document_id, companyId: instance.company_id },
        );
      } else if (
        instance.document_type === "MATERIAL_REQUISITION" ||
        instance.document_type === "Material Requisition"
      ) {
        try {
          await query(
            `UPDATE inv_material_requisitions SET status = 'RETURNED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "RETURN_TO_STORES" ||
        instance.document_type === "Return to Stores"
      ) {
        try {
          await query(
            `UPDATE inv_return_to_stores SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (instance.document_type === "SALES_RETURN") {
        try {
          await query(
            `UPDATE sal_returns SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "PURCHASE_RETURN" ||
        instance.document_type === "Purchase Return"
      ) {
        try {
          await query(
            `UPDATE pur_returns SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "SALES_ORDER" ||
        instance.document_type === "Sales Order"
      ) {
        try {
          await query(
            `UPDATE sal_orders SET status = 'REVERSED' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "GENERAL_REQUISITION" ||
        instance.document_type === "General Requisition"
      ) {
        try {
          await query(
            `UPDATE pur_general_requisitions SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "STOCK_UPDATION" ||
        instance.document_type === "Stock Updation"
      ) {
        try {
          await query(
            `UPDATE inv_stock_updations SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "STOCK_VERIFICATION" ||
        instance.document_type === "Stock Verification"
      ) {
        try {
          await query(
            `UPDATE inv_stock_verifications SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "MAINT_MATERIAL_REQUISITION"
      ) {
        try {
          await query(
            `UPDATE maint_material_requisitions SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "PROJECT_ORDER" ||
        instance.document_type === "Project Order"
      ) {
        try {
          await query(
            `UPDATE pm_orders SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      } else if (
        instance.document_type === "PURCHASE_REQUISITION" ||
        instance.document_type === "Purchase Requisition"
      ) {
        try {
          await query(
            `UPDATE pm_purchase_requisitions SET status = 'DRAFT' WHERE id = :id AND company_id = :companyId`,
            { id: instance.document_id, companyId: instance.company_id },
          );
        } catch (e) {}
      }
      const initiatorId = await getInitiator();
      await notifyUser(
        initiatorId,
        "Document Returned",
        `Your document #${instance.document_id} was returned for revision.`,
      );
    } else if (
      wf.status === "APPROVED" &&
      (wf.document_type === "STOCK_UPDATION" ||
        wf.document_type === "Stock Updation")
    ) {
      try {
        const upRows = await query(
          `SELECT id, status, warehouse_id, branch_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
          { docId: wf.document_id, companyId: wf.company_id },
        );
        if (upRows.length && upRows[0].status !== "APPROVED") {
          const upHdr = upRows[0];
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            await conn.execute(
              `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await conn
              .execute(
                `SELECT item_id, qty, batch_no FROM inv_stock_updation_details WHERE updation_id = :id`,
                { id: wf.document_id },
              )
              .then((r) => r[0]);

            for (const d of details) {
              const itemId = Number(d.item_id);
              const qtyChange = Number(d.qty || 0);
              if (itemId && Number.isFinite(qtyChange) && qtyChange !== 0) {
                await recordMovementTx(conn, {
                  companyId: wf.company_id,
                  branchId, branchIdsStr: upHdr.branch_id || 1,
                  warehouseId: upHdr.warehouse_id,
                  itemId,
                  transactionType: "STOCK_UPDATION",
                  qtyChange,
                  batchNo: d.batch_no || null,
                  sourceRef: wf.document_id,
                  createdBy: null,
                });
              }
            }
            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          } finally {
            conn.release();
          }
        }
      } catch (e) {
        console.error("Error in STOCK_UPDATION post-approval:", e);
      }
    } else if (
      wf.status === "APPROVED" &&
      (wf.document_type === "STOCK_VERIFICATION" ||
        wf.document_type === "Stock Verification")
    ) {
      try {
        const verRows = await query(
          `SELECT id, status, warehouse_id, branch_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
          { docId: wf.document_id, companyId: wf.company_id },
        );
        if (verRows.length && verRows[0].status !== "APPROVED") {
          const verHdr = verRows[0];
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            await conn.execute(
              `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await conn
              .execute(
                `SELECT item_id, variance_qty FROM inv_stock_verification_details WHERE verification_id = :id`,
                { id: wf.document_id },
              )
              .then((r) => r[0]);

            for (const d of details) {
              const itemId = Number(d.item_id);
              const qtyChange = Number(d.variance_qty || 0);
              if (itemId && Number.isFinite(qtyChange) && qtyChange !== 0) {
                await recordMovementTx(conn, {
                  companyId: wf.company_id,
                  branchId, branchIdsStr: verHdr.branch_id || 1,
                  warehouseId: verHdr.warehouse_id,
                  itemId,
                  transactionType: "STOCK_VERIFICATION",
                  qtyChange,
                  sourceRef: wf.document_id,
                  createdBy: null,
                });
              }
            }
            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          } finally {
            conn.release();
          }
        }
      } catch (e) {
        console.error("Error in STOCK_VERIFICATION post-approval:", e);
      }
    }
    if (action === "APPROVE") {
      const finalCheck = await query(
        `SELECT status, document_type, document_id, company_id,
          created_at,
          u.username AS created_by_name
         FROM adm_document_workflows
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :id`,
        { id: instance.id },
      );
      const wf = finalCheck[0];
      if (wf.status === "APPROVED" && wf.document_type === "SALES_RETURN") {
        let headerRows;
        try {
          headerRows = await query(
            `SELECT id, branch_id, warehouse_id, status,
          created_at,
          u.username AS created_by_name
         FROM sal_returns
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
        } catch (e) {
          if (String(e.code) === "ER_NO_SUCH_TABLE") {
            await query(`
                CREATE TABLE IF NOT EXISTS sal_returns (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  company_id BIGINT UNSIGNED NOT NULL,
                  branch_id BIGINT UNSIGNED NOT NULL,
                  return_no VARCHAR(50) NOT NULL,
                  return_date DATE NOT NULL,
                  invoice_id BIGINT UNSIGNED,
                  customer_id BIGINT UNSIGNED,
                  return_type VARCHAR(50) DEFAULT 'DAMAGED',
                  status VARCHAR(20) DEFAULT 'DRAFT',
                  remarks TEXT,
                  total_amount DECIMAL(18,2) DEFAULT 0,
                  created_by BIGINT UNSIGNED,
                  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                  PRIMARY KEY (id),
                  UNIQUE KEY uq_return_no (company_id, branch_id, return_no),
                  INDEX idx_company_branch (company_id, branch_id)
                )
              `);
            await query(`
                CREATE TABLE IF NOT EXISTS sal_return_details (
                  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                  return_id BIGINT UNSIGNED NOT NULL,
                  item_id BIGINT UNSIGNED NOT NULL,
                  qty_returned DECIMAL(18,4) NOT NULL DEFAULT 0,
                  unit_price DECIMAL(18,4) NOT NULL DEFAULT 0,
                  total_amount DECIMAL(18,4) NOT NULL DEFAULT 0,
                  reason_code VARCHAR(50),
                  remarks TEXT,
                  PRIMARY KEY (id),
                  INDEX idx_return (return_id),
                  CONSTRAINT fk_sal_return_details_header FOREIGN KEY (return_id) REFERENCES sal_returns(id) ON DELETE CASCADE
                )
              `);
            headerRows = await query(
              `SELECT id, branch_id, warehouse_id, status,
          created_at,
          u.username AS created_by_name
         FROM sal_returns
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId`,
              { docId: wf.document_id, companyId: wf.company_id },
            );
          } else {
            throw e;
          }
        }
        if (headerRows.length) {
          const header = headerRows[0];
          if (header.status !== "APPROVED") {
            await query(
              `UPDATE sal_returns SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: header.id, companyId: wf.company_id },
            );
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await createCreditNoteForReturnApprovalTx(conn, {
                id: header.id,
                companyId: wf.company_id,
                branchId, branchIdsStr: header.branch_id,
              });
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              throw err;
            } finally {
              conn.release();
            }
          }
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PURCHASE_RETURN" ||
          wf.document_type === "Purchase Return")
      ) {
        let headerRows;
        try {
          headerRows = await query(
            `SELECT id, branch_id, status,
          created_at,
          u.username AS created_by_name
         FROM pur_returns
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
        } catch (e) {
          throw e;
        }
        if (headerRows.length) {
          const header = headerRows[0];
          if (header.status !== "APPROVED") {
            await query(
              `UPDATE pur_returns SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: header.id, companyId: wf.company_id },
            );
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await createDebitNoteForReturnApprovalTx(conn, {
                id: header.id,
                companyId: wf.company_id,
                branchId, branchIdsStr: header.branch_id,
              });
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              throw err;
            } finally {
              conn.release();
            }
          }
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "Material Requisition" ||
          wf.document_type === "MATERIAL_REQUISITION")
      ) {
        try {
          const mrRows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM inv_material_requisitions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (mrRows.length && mrRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_material_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "RETURN_TO_STORES" ||
          wf.document_type === "Return to Stores")
      ) {
        try {
          const rtsRows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM inv_return_to_stores
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rtsRows.length && rtsRows[0].status !== "APPROVED") {
            const rtsHdr = rtsRows[0];
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await conn.execute(
                `UPDATE inv_return_to_stores SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
                { id: wf.document_id, companyId: wf.company_id },
              );
              // Fetch details
              const details = await conn
                .execute(
                  `SELECT item_id, qty_returned, batch_serial, location 
                 FROM inv_return_to_stores_details WHERE rts_id = :id`,
                  { id: wf.document_id },
                )
                .then((r) => r[0]);

              for (const d of details) {
                await recordMovementTx(conn, {
                  companyId: wf.company_id,
                  branchId, branchIdsStr: wf.branch_id || 1,
                  warehouseId: rtsHdr.warehouse_id || null,
                  itemId: d.item_id,
                  transactionType: "RTS",
                  qtyChange: Number(d.qty_returned || 0),
                  batchNo: d.batch_serial,
                  sourceRef: wf.document_id,
                  createdBy: null,
                });
              }
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              throw err;
            } finally {
              conn.release();
            }
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "GOODS_RECEIPT" ||
          wf.document_type === "Goods Receipt" ||
          wf.document_type === "GRN" ||
          wf.document_type === "Goods Receipt Note")
      ) {
        try {
          const grnRows = await query(
            `SELECT id, status, branch_id, warehouse_id,
          created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_notes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          const conn = await pool.getConnection();
          try {
            await conn.beginTransaction();
            await conn.execute(
              `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await conn
              .execute(
                `SELECT item_id, qty_accepted FROM inv_goods_receipt_note_details WHERE grn_id = :id`,
                { id: wf.document_id },
              )
              .then((r) => r[0]);

            const branchId = Number(grnRows[0].branch_id || 0);
            const warehouseId = grnRows[0].warehouse_id || null;
            for (const d of details) {
              const itemId = Number(d.item_id);
              const qtyAccepted = Number(d.qty_accepted || 0);
              if (itemId && Number.isFinite(qtyAccepted) && qtyAccepted > 0) {
                await recordMovementTx(conn, {
                  companyId: wf.company_id,
                  branchId, branchIdsStr,
                  warehouseId,
                  itemId,
                  transactionType: "GRN",
                  qtyChange: qtyAccepted,
                  sourceRef: wf.document_id,
                  createdBy: null,
                });
              }
            }
            await conn.commit();
          } catch (err) {
            await conn.rollback();
            throw err;
          } finally {
            conn.release();
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_ADJUSTMENT" ||
          wf.document_type === "Stock Adjustment")
      ) {
        try {
          const adjRows = await query(
            `SELECT id, status, warehouse_id, branch_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustments
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (adjRows.length && adjRows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_stock_adjustments SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            const details = await query(
              `SELECT item_id, qty,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_adjustment_details
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE adjustment_id = :id`,
              { id: wf.document_id },
            );
            const warehouseId = adjRows[0].warehouse_id;
            const branchId = adjRows[0].branch_id || 0;
            if (warehouseId) {
              const conn = await pool.getConnection();
              try {
                await conn.beginTransaction();
                for (const d of details) {
                  const itemId = Number(d.item_id);
                  const qtyDiff = Number(d.qty);
                  if (itemId && Number.isFinite(qtyDiff) && qtyDiff !== 0) {
                    await recordMovementTx(conn, {
                      companyId: wf.company_id,
                      branchId, branchIdsStr,
                      warehouseId,
                      itemId,
                      transactionType: "STOCK_ADJUSTMENT",
                      qtyChange: qtyDiff,
                      sourceRef: wf.document_id,
                      createdBy: null,
                    });
                  }
                }
                await conn.commit();
              } catch (err) {
                await conn.rollback();
                throw err;
              } finally {
                conn.release();
              }
            }
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_UPDATION" ||
          wf.document_type === "Stock Updation")
      ) {
        try {
          const upRows = await query(
            `SELECT id, status, warehouse_id, branch_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (upRows.length && upRows[0].status !== "APPROVED") {
            const upHdr = upRows[0];
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await conn.execute(
                `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
                { id: wf.document_id, companyId: wf.company_id },
              );
              const details = await conn
                .execute(
                  `SELECT item_id, qty, batch_no FROM inv_stock_updation_details WHERE updation_id = :id`,
                  { id: wf.document_id },
                )
                .then((r) => r[0]);

              for (const d of details) {
                const itemId = Number(d.item_id);
                const qtyChange = Number(d.qty || 0);
                if (itemId && Number.isFinite(qtyChange) && qtyChange !== 0) {
                  await recordMovementTx(conn, {
                    companyId: wf.company_id,
                    branchId, branchIdsStr: upHdr.branch_id || 1,
                    warehouseId: upHdr.warehouse_id,
                    itemId,
                    transactionType: "STOCK_UPDATION",
                    qtyChange,
                    batchNo: d.batch_no || null,
                    sourceRef: wf.document_id,
                    createdBy: null,
                  });
                }
              }
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              throw err;
            } finally {
              conn.release();
            }
          }
        } catch (e) {
          console.error("Error in STOCK_UPDATION post-approval:", e);
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_VERIFICATION" ||
          wf.document_type === "Stock Verification")
      ) {
        try {
          const verRows = await query(
            `SELECT id, status, warehouse_id, branch_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (verRows.length && verRows[0].status !== "APPROVED") {
            const verHdr = verRows[0];
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await conn.execute(
                `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
                { id: wf.document_id, companyId: wf.company_id },
              );
              await applyStockVerificationApprovalTx(conn, {
                companyId: wf.company_id,
                branchId, branchIdsStr: verHdr.branch_id || 1,
                verificationId: wf.document_id,
                warehouseId: verHdr.warehouse_id,
                createdBy: null,
              });
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              throw err;
            } finally {
              conn.release();
            }
          }
        } catch (e) {
          console.error("Error in STOCK_VERIFICATION post-approval:", e);
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PURCHASE_ORDER" ||
          wf.document_type === "Purchase Order")
      ) {
        try {
          const poRows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM pur_orders
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (poRows.length && poRows[0].status !== "APPROVED") {
            await query(
              `UPDATE pur_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "GENERAL_REQUISITION" ||
          wf.document_type === "General Requisition")
      ) {
        try {
          const grRows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM pur_general_requisitions
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (grRows.length && grRows[0].status !== "APPROVED") {
            await query(
              `UPDATE pur_general_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "GOODS_RECEIPT" ||
          wf.document_type === "Goods Receipt" ||
          wf.document_type === "GRN" ||
          wf.document_type === "Goods Receipt Note")
      ) {
        try {
          const rows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM inv_goods_receipt_notes
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE inv_goods_receipt_notes SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PAYMENT_VOUCHER" ||
          wf.document_type === "Payment Voucher" ||
          wf.document_type === "PV" ||
          wf.document_type === "RECEIPT_VOUCHER" ||
          wf.document_type === "Receipt Voucher" ||
          wf.document_type === "RV" ||
          wf.document_type === "JOURNAL_VOUCHER" ||
          wf.document_type === "Journal Voucher" ||
          wf.document_type === "JV" ||
          wf.document_type === "CONTRA_VOUCHER" ||
          wf.document_type === "Contra Voucher" ||
          wf.document_type === "CV" ||
          wf.document_type === "DEBIT_NOTE" ||
          wf.document_type === "Debit Note" ||
          wf.document_type === "DN" ||
          wf.document_type === "CREDIT_NOTE" ||
          wf.document_type === "Credit Note" ||
          wf.document_type === "CN")
      ) {
        try {
          const rows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM fin_vouchers
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE fin_vouchers SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
            if (
              wf.document_type === "PAYMENT_VOUCHER" ||
              wf.document_type === "Payment Voucher" ||
              wf.document_type === "PV"
            ) {
              await query(
                `UPDATE fin_pdc_postings SET status = 'POSTED' WHERE voucher_id = :id AND company_id = :companyId`,
                { id: wf.document_id, companyId: wf.company_id },
              );
              try {
                await query(
                  `UPDATE trans_expense_logs 
                   SET status = 'PAID' 
                   WHERE id IN (
                     SELECT expense_log_id FROM trn_transport_expenses 
                     WHERE voucher_id = :id AND company_id = :companyId AND expense_log_id IS NOT NULL
                   ) AND company_id = :companyId`,
                  { id: wf.document_id, companyId: wf.company_id }
                );
              } catch (e) {}
            }
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "SALES_ORDER" ||
          wf.document_type === "Sales Order")
      ) {
        try {
          const rows = await query(
            `SELECT id, status,
          created_at,
          u.username AS created_by_name
         FROM sal_orders
         LEFT JOIN adm_users u ON u.id = created_by
          WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE sal_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PROJECT_ORDER" ||
          wf.document_type === "Project Order")
      ) {
        try {
          const rows = await query(
            `SELECT id, status FROM pm_orders
             WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (rows.length && rows[0].status !== "APPROVED") {
            await query(
              `UPDATE pm_orders SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: wf.document_id, companyId: wf.company_id },
            );
          }
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "PURCHASE_REQUISITION" ||
          wf.document_type === "Purchase Requisition")
      ) {
        try {
          await query(
            `UPDATE pm_purchase_requisitions SET status = 'FULFILLED' WHERE id = :id AND company_id = :companyId`,
            { id: wf.document_id, companyId: wf.company_id },
          );
        } catch (e) {}
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_UPDATION" ||
          wf.document_type === "Stock Updation")
      ) {
        try {
          const updRows = await query(
            `SELECT id, status, branch_id, warehouse_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updations
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (updRows.length && updRows[0].status !== "APPROVED") {
            const upd = updRows[0];
            await query(
              `UPDATE inv_stock_updations SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: upd.id, companyId: wf.company_id },
            );
            const details = await query(
              `SELECT item_id, qty, batch_no, uom,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_updation_details
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE updation_id = :id`,
              { id: upd.id },
            );
            const branchId = upd.branch_id || 1;
            const warehouseId = upd.warehouse_id || null;
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              for (const d of details) {
                const itemId = Number(d.item_id);
                const qty = Number(d.qty || 0);
                if (itemId && qty > 0) {
                  await recordMovementTx(conn, {
                    companyId: wf.company_id,
                    branchId, branchIdsStr,
                    warehouseId,
                    itemId,
                    transactionType: "STOCK_UPDATION",
                    qtyChange: qty,
                    batchNo: d.batch_no || null,
                    sourceRef: wf.document_id,
                    sourceId: wf.document_id,
                    sourceType: "STOCK_UPDATION",
                  });
                }
              }
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              console.error("Stock Updation movement failed:", err);
            } finally {
              conn.release();
            }
          }
        } catch (e) {
          console.error("Error finalizing Stock Updation:", e);
        }
      } else if (
        wf.status === "APPROVED" &&
        (wf.document_type === "STOCK_VERIFICATION" ||
          wf.document_type === "Stock Verification")
      ) {
        try {
          const verRows = await query(
            `SELECT id, status, branch_id, warehouse_id,
          created_at,
          u.username AS created_by_name
         FROM inv_stock_verifications
        LEFT JOIN adm_users u ON u.id = created_by
         WHERE id = :docId AND company_id = :companyId LIMIT 1`,
            { docId: wf.document_id, companyId: wf.company_id },
          );
          if (verRows.length && verRows[0].status !== "APPROVED") {
            const ver = verRows[0];
            await query(
              `UPDATE inv_stock_verifications SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId`,
              { id: ver.id, companyId: wf.company_id },
            );
            const branchId = ver.branch_id || 1;
            const warehouseId = ver.warehouse_id || null;
            const conn = await pool.getConnection();
            try {
              await conn.beginTransaction();
              await applyStockVerificationApprovalTx(conn, {
                companyId: wf.company_id,
                branchId, branchIdsStr,
                verificationId: ver.id,
                warehouseId,
                createdBy: null,
              });
              await conn.commit();
            } catch (err) {
              await conn.rollback();
              console.error("Stock Verification movement failed:", err);
            } finally {
              conn.release();
            }
          }
        } catch (e) {
          console.error("Error finalizing Stock Verification:", e);
        }
      }
    }
    const finalStatusCheck = await query(
      `SELECT status, document_type, document_id, company_id FROM adm_document_workflows WHERE id = :id`,
      { id: instance.id }
    );
    const finalWf = finalStatusCheck[0];

    if (finalWf.status === "APPROVED" || finalWf.status === "POSTED") {
      // In workflow finalization, document_type can be "SALES_ORDER", "Sales Order", etc.
      let normalizedModuleCode = String(finalWf.document_type || "").toUpperCase().replace(/ /g, '_');
      let triggerStat = finalWf.status;
      if (normalizedModuleCode === "PAYMENT_VOUCHER" || normalizedModuleCode === "RECEIPT_VOUCHER") triggerStat = "POSTED";
      
      await checkAndSendAutomaticNotification({
        companyId: finalWf.company_id,
        moduleCode: normalizedModuleCode,
        statusTrigger: triggerStat,
        documentId: finalWf.document_id,
      }).catch(err => console.error("Auto notification error:", err));
    }

    res.json({ message: "Action processed successfully" });
  } catch (err) {
    next(err);
  }
};
