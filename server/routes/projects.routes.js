/**
 * @file projects.routes.js
 * @description Express routes for Projects management, tasks, and timesheets.
 */
import express from "express";

import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import * as projectsController from "../controllers/projects.controller.js";

const router = express.Router();

function toNumber(v, fallback = null) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

import { 
  ensurePMOrderTables, 
  ensurePMPurchaseRequisitionTables,
  ensurePMQuotationTables,
  ensurePMInvoiceTables
} from "../utils/dbUtils.js";
import {
  getInactiveWorkflowBehavior,
  resolveWorkflowSelection,
} from "../utils/workflowResolution.js";

// ===== PROJECTS =====

router.get(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.listProjects
);

router.get(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.VIEW"),
  projectsController.getProjectById
);

router.post(
  "/projects",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.createProject
);

router.put(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.updateProject
);

// ===== PROJECT MANAGERS =====
router.get(
  "/project-managers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listProjectManagers
);

router.post(
  "/project-managers",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.createProjectManager
);

router.delete(
  "/project-managers/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  requirePermission("PM.PROJECT.MANAGE"),
  projectsController.removeProjectManager
);

// ===== PROJECT EQUIPMENTS =====
router.get(
  "/equipments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPmEquipments
);
router.post(
  "/equipments",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPmEquipment
);
router.put(
  "/equipments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePmEquipment
);
router.delete(
  "/equipments/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deletePmEquipment
);

// ===== PROJECT RESOURCES =====
router.get(
  "/resources",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPmResources
);
router.post(
  "/resources",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPmResource
);
router.put(
  "/resources/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePmResource
);
router.delete(
  "/resources/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deletePmResource
);

// ===== TASKS =====
router.get(
  "/tasks",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTasks
);

router.get(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getTaskById
);

router.post(
  "/tasks",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createOrUpdateTask
);

router.put(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createOrUpdateTask
);

router.delete(
  "/tasks/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTask
);

router.delete(
  "/projects/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteProject
);

// ===== TIMESHEETS =====
router.get(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTimesheets
);

router.post(
  "/timesheets",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createTimesheet
);

router.put(
  "/timesheets/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updateTimesheet
);

router.delete(
  "/timesheets/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTimesheet
);

// ===== TASK DEPENDENCIES =====
router.get(
  "/task-dependencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listTaskDependencies
);

router.post(
  "/task-dependencies",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createTaskDependency
);

router.delete(
  "/task-dependencies/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteTaskDependency
);

// ===== EXPENSES =====
router.get(
  "/expenses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listExpenses
);

router.post(
  "/expenses",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createExpense
);

router.put(
  "/expenses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updateExpense
);

router.delete(
  "/expenses/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteExpense
);

router.put(
  "/expenses/:id/voucher",
  requireAuth,
  requireCompanyScope,
  projectsController.updateExpenseVoucherId
);

// ===== INCOME =====
router.get(
  "/income",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listIncome
);

router.post(
  "/income",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createIncome
);

router.put(
  "/income/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updateIncome
);

router.delete(
  "/income/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.deleteIncome
);

router.put(
  "/income/:id/voucher",
  requireAuth,
  requireCompanyScope,
  projectsController.updateIncomeVoucherId
);

// ===== DASHBOARD DETAIL =====
router.get(
  "/dashboard/detail",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMDashboardDetail
);

// ===== PM MATERIAL REQUISITIONS =====
router.get(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialRequisitions
);
router.get(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialRequisitionById
);
router.post(
  "/material-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialRequisition
);
router.put(
  "/material-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialRequisition
);
router.post(
  "/material-requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.submitPMMaterialRequisition
);

// ===== PM MATERIAL UTILIZATIONS =====
router.get(
  "/material-utilizations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialUtilizations
);
router.get(
  "/material-utilizations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialUtilizationById
);
router.post(
  "/material-utilizations",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialUtilization
);
router.put(
  "/material-utilizations/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialUtilization
);
router.post(
  "/material-utilizations/:id/confirm",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.confirmPMMaterialUtilization
);

// ===== PM MATERIALS RECEIPTS =====
router.get(
  "/material-receipts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.listPMMaterialReceipts
);
router.get(
  "/material-receipts/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMMaterialReceiptById
);
router.post(
  "/material-receipts",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.createPMMaterialReceipt
);
router.put(
  "/material-receipts/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.updatePMMaterialReceipt
);

// ===== ISSUE TO REQUIREMENT (for PM materials receipt auto-populate) =====
router.get(
  "/issue-to-requirement/pm",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPendingIssueToRequirement
);
router.get(
  "/issue-to-requirement/pm/:issueId",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getIssueToRequirementDetail
);

// ===== PROJECT STATUS REPORT =====
router.get(
  "/reports/project-status",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectStatusReport
);

// ===== PROJECT INCOME REPORT =====
router.get(
  "/reports/project-income",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectIncomeReport
);

// ===== PROJECT EXPENSE REPORT =====
router.get(
  "/reports/project-expense",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectExpenseReport
);

// ===== TASK EXECUTION ANALYTICS REPORT =====
router.get(
  "/reports/task-execution",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getTaskExecutionAnalyticsReport
);

// ===== DASHBOARD =====
router.get(
  "/dashboard/stats",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getPMDashboardStats
);

// ===== BUDGET VS ACTUAL =====
router.get(
  "/budget-vs-actual",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getBudgetVsActual
);

// ===== PROJECT DETAIL DASHBOARD =====
router.get(
  "/projects/:id/detail",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  projectsController.getProjectDetail
);

// ===== PROJECT ORDERS =====
router.get(
  "/project-orders/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const rows = await query(
        `SELECT order_no FROM pm_orders
         WHERE company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
           AND order_no REGEXP '^PO[0-9]{6}$'
         ORDER BY CAST(REPLACE(order_no, 'PO', '') AS UNSIGNED) DESC
         LIMIT 1`,
        { companyId, branchId, branchIdsStr },
      );
      let nextNum = 1;
      if (rows.length > 0) {
        const prev = String(rows[0].order_no || "");
        const numPart = prev.replace(/^PO/, "");
        const n = parseInt(numPart, 10);
        if (Number.isFinite(n)) nextNum = n + 1;
      }
      const nextNo = `PO${String(nextNum).padStart(6, "0")}`;
      res.json({ nextNo });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/project-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const items = await query(
        `SELECT
           o.id, o.order_no, o.order_date,
           o.project_id, COALESCE(p.project_name, o.project_name) AS project_name,
           o.priority,
           CASE
             WHEN a.has_approved = 1 THEN 'APPROVED'
             WHEN iw.has_inactive_pending = 1 THEN 'APPROVED'
             WHEN x.assigned_to_user_id IS NOT NULL THEN 'PENDING_APPROVAL'
             ELSE o.status
           END AS status,
           o.total_amount,
           u.username AS forwarded_to_username,
           cu.username AS created_by_name,
           (SELECT COUNT(*) FROM adm_workflows w2
            WHERE w2.company_id = :companyId
              AND (w2.document_route = '/project-management/project-orders'
                   OR w2.document_type IN ('PROJECT_ORDER','Project Order'))
              AND w2.is_active = 1) AS has_workflow
         FROM pm_orders o
         LEFT JOIN (
           SELECT t.document_id, t.assigned_to_user_id
           FROM adm_document_workflows t
           JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
           JOIN (
             SELECT document_id, MAX(id) AS max_id
             FROM adm_document_workflows
             WHERE company_id = :companyId
               AND status = 'PENDING'
               AND (document_type = 'PROJECT_ORDER' OR document_type = 'Project Order')
             GROUP BY document_id
           ) m ON m.max_id = t.id
         ) x ON x.document_id = o.id
         LEFT JOIN (
           SELECT t.document_id, 1 AS has_inactive_pending
           FROM adm_document_workflows t
           JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 0
           WHERE t.company_id = :companyId
             AND t.status = 'PENDING'
             AND (t.document_type = 'PROJECT_ORDER' OR t.document_type = 'Project Order')
           GROUP BY t.document_id
         ) iw ON iw.document_id = o.id
         LEFT JOIN (
           SELECT t.document_id, 1 AS has_approved
           FROM adm_document_workflows t
           JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
           JOIN (
             SELECT document_id, MAX(id) AS max_id
             FROM adm_document_workflows
             WHERE company_id = :companyId
               AND status = 'APPROVED'
               AND (document_type = 'PROJECT_ORDER' OR document_type = 'Project Order')
             GROUP BY document_id
           ) m ON m.max_id = t.id
         ) a ON a.document_id = o.id
         LEFT JOIN pm_projects p ON p.id = o.project_id AND p.company_id = :companyId
         LEFT JOIN adm_users u ON u.id = x.assigned_to_user_id
         LEFT JOIN adm_users cu ON cu.id = o.created_by
          WHERE o.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))
            AND COALESCE(o.is_active,'Y') = 'Y'
          ORDER BY o.order_date DESC, o.id DESC`,
         { companyId, branchId, branchIdsStr },
       ).catch(() => []);
       res.json({ items: Array.isArray(items) ? items : [] });
    } catch (e) {
      next(e);
    }
  },
);

router.get(
  "/project-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `SELECT
           o.id, o.order_no, o.order_date, o.project_id,
           COALESCE(p.project_name, o.project_name) AS project_name,
           o.priority, o.status, o.total_amount, o.sub_total, o.tax_amount,
           o.currency_id, o.exchange_rate, o.price_type, o.payment_type,
           o.warehouse_id, o.remarks,
           o.created_at, u.username AS created_by_name
         FROM pm_orders o
         LEFT JOIN pm_projects p ON p.id = o.project_id AND p.company_id = :companyId
         LEFT JOIN adm_users u ON u.id = o.created_by
          WHERE o.id = :id AND o.company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(o.branch_id, :branchIdsStr))
          LIMIT 1`,
         { id, companyId, branchId, branchIdsStr },
       ).catch(() => []);
       if (!rows.length) throw httpError(404, "NOT_FOUND", "Order not found");
       const details = await query(
        `SELECT
           d.id, d.item_id, d.qty AS quantity, d.unit_price,
           d.discount_percent, d.total_amount, d.net_amount, d.tax_amount,
           d.tax_code_id, d.uom,
           it.item_code, it.item_name
         FROM pm_order_items d
         LEFT JOIN inv_items it ON it.id = d.item_id AND it.company_id = :companyId
         WHERE d.order_id = :id
         ORDER BY d.id ASC`,
        { id, companyId },
      ).catch(() => []);
      res.json({
        item: rows[0],
        details: Array.isArray(details) ? details : [],
      });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/project-orders",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const body = req.body || {};
      let order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      if (!order_date) {
        throw httpError(400, "VALIDATION_ERROR", "order_date is required");
      }
      if (!order_no) {
        const noRows = await query(
          `SELECT order_no FROM pm_orders
           WHERE company_id = :companyId
             AND order_no REGEXP '^PO[0-9]{6}$'
           ORDER BY CAST(REPLACE(order_no, 'PO', '') AS UNSIGNED) DESC
           LIMIT 1`,
          { companyId },
        );
        let nextNum = 1;
        if (noRows.length > 0) {
          const numPart = String(noRows[0].order_no || "").replace(/^PO/, "");
          const n = parseInt(numPart, 10);
          if (Number.isFinite(n)) nextNum = n + 1;
        }
        order_no = `PO${String(nextNum).padStart(6, "0")}`;
      }
      const project_id = body.project_id == null ? null : Number(body.project_id);
      const status = String(body.status || "DRAFT").trim().toUpperCase();
      const createdBy = req.user?.sub || null;
      const payload = {
        companyId, branchId, branchIdsStr,
        order_no, order_date, project_id,
        project_name: body.project_name ? String(body.project_name) : null,
        priority: String(body.priority || "MEDIUM").trim().toUpperCase(),
        status,
        total_amount: Number(body.total_amount || 0),
        sub_total: Number(body.sub_total || 0),
        tax_amount: Number(body.tax_amount || 0),
        currency_id: Number(body.currency_id || 4),
        exchange_rate: Number(body.exchange_rate || 1),
        price_type: String(body.price_type || "RETAIL"),
        payment_type: String(body.payment_type || "CASH"),
        warehouse_id: body.warehouse_id == null ? null : Number(body.warehouse_id),
        remarks: body.remarks || null,
        created_by: createdBy,
      };
      const result = await query(
        `INSERT INTO pm_orders
           (company_id, branch_id, order_no, order_date, project_id, project_name, priority, status,
            total_amount, sub_total, tax_amount, currency_id, exchange_rate, price_type, payment_type,
            warehouse_id, remarks, created_by)
         VALUES
           (:companyId, :branchId, :order_no, DATE(:order_date), :project_id, :project_name, :priority, :status,
            :total_amount, :sub_total, :tax_amount, :currency_id, :exchange_rate, :price_type, :payment_type,
            :warehouse_id, :remarks, :created_by)`,
        payload,
      );
      const orderId = result.insertId;
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `INSERT INTO pm_order_items
             (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom, tax_code_id)
           VALUES
             (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom, :tax_code_id)`,
          {
            order_id: orderId,
            item_id,
            qty,
            unit_price: Number(it?.unit_price || 0),
            discount_percent: Number(it?.discount_percent || 0),
            total_amount: Number(it?.total_amount || 0),
            net_amount: Number(it?.net_amount || 0),
            tax_amount: Number(it?.tax_amount || 0),
            uom: String(it?.uom || "PCS").trim(),
            tax_code_id: it?.tax_id ? Number(it.tax_id) : null,
          },
        );
      }
      if (status === "DRAFT") {
        try {
          const [wfRows] = await query(
            `SELECT COUNT(*) AS cnt FROM adm_workflows
             WHERE company_id = :companyId
               AND (document_route = '/project-management/project-orders'
                    OR document_type IN ('PROJECT_ORDER','Project Order'))
               AND is_active = 1`,
            { companyId },
          );
          if (!wfRows?.cnt) {
            await query(
              `UPDATE pm_orders SET status = 'POSTED' WHERE id = :id AND company_id = :companyId`,
              { id: orderId, companyId },
            );
          }
        } catch {}
      }
      const [item] = await query(
        `SELECT o.id, o.order_no, o.order_date, o.project_id,
                COALESCE(p.project_name, o.project_name) AS project_name,
                o.status, o.total_amount,
                o.created_at, u.username AS created_by_name
         FROM pm_orders o
         LEFT JOIN pm_projects p ON p.id = o.project_id AND p.company_id = :companyId
         LEFT JOIN adm_users u ON u.id = o.created_by
         WHERE o.id = :id LIMIT 1`,
        { id: orderId, companyId },
      ).catch(() => []);
      res.status(201).json({ id: orderId, item: item || null });
    } catch (e) {
      next(e);
    }
  },
);

router.put(
  "/project-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const body = req.body || {};
      const order_no = String(body.order_no || "").trim();
      const order_date = body.order_date
        ? String(body.order_date).slice(0, 10)
        : null;
      const project_id = body.project_id == null ? null : Number(body.project_id);
      const status = String(body.status || "DRAFT")
        .trim()
        .toUpperCase();
      if (!order_no || !order_date) {
        throw httpError(400, "VALIDATION_ERROR", "Invalid payload");
      }
      const [existing] = await query(
        `SELECT id FROM pm_orders
         WHERE id = :id AND company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");
      await query(
        `UPDATE pm_orders
            SET order_no = :order_no,
                order_date = DATE(:order_date),
                project_id = :project_id,
                project_name = :project_name,
                priority = :priority,
                status = :status,
                total_amount = :total_amount,
                sub_total = :sub_total,
                tax_amount = :tax_amount,
                currency_id = :currency_id,
                exchange_rate = :exchange_rate,
                price_type = :price_type,
                payment_type = :payment_type,
                warehouse_id = :warehouse_id,
                remarks = :remarks
          WHERE id = :id AND company_id = :companyId
            AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          id, companyId, branchId, branchIdsStr,
          order_no, order_date,
          project_id,
          project_name: body.project_name ? String(body.project_name) : null,
          priority: String(body.priority || "MEDIUM").trim().toUpperCase(),
          status,
          total_amount: Number(body.total_amount || 0),
          sub_total: Number(body.sub_total || 0),
          tax_amount: Number(body.tax_amount || 0),
          currency_id: Number(body.currency_id || 4),
          exchange_rate: Number(body.exchange_rate || 1),
          price_type: String(body.price_type || "RETAIL"),
          payment_type: String(body.payment_type || "CASH"),
          warehouse_id: body.warehouse_id == null ? null : Number(body.warehouse_id),
          remarks: body.remarks || null,
        },
      );
      await query("DELETE FROM pm_order_items WHERE order_id = :id", { id });
      const items = Array.isArray(body.items) ? body.items : [];
      for (const it of items) {
        const item_id = Number(it?.item_id);
        const qty = Number(it?.quantity || 0);
        if (!Number.isFinite(item_id) || qty <= 0) continue;
        await query(
          `INSERT INTO pm_order_items
             (order_id, item_id, qty, unit_price, discount_percent, total_amount, net_amount, tax_amount, uom, tax_code_id)
           VALUES
             (:order_id, :item_id, :qty, :unit_price, :discount_percent, :total_amount, :net_amount, :tax_amount, :uom, :tax_code_id)`,
          {
            order_id: id, item_id, qty,
            unit_price: Number(it?.unit_price || 0),
            discount_percent: Number(it?.discount_percent || 0),
            total_amount: Number(it?.total_amount || 0),
            net_amount: Number(it?.net_amount || 0),
            tax_amount: Number(it?.tax_amount || 0),
            uom: String(it?.uom || "PCS").trim(),
            tax_code_id: it?.tax_id ? Number(it.tax_id) : null,
          },
        );
      }
      if (status === "DRAFT") {
        try {
          const [wfRows] = await query(
            `SELECT COUNT(*) AS cnt FROM adm_workflows
             WHERE company_id = :companyId
               AND (document_route = '/project-management/project-orders'
                    OR document_type IN ('PROJECT_ORDER','Project Order'))
               AND is_active = 1`,
            { companyId },
          );
          if (!wfRows?.cnt) {
            await query(
              `UPDATE pm_orders SET status = 'POSTED' WHERE id = :id AND company_id = :companyId`,
              { id, companyId },
            );
          }
        } catch {}
      }
      res.json({ id });
    } catch (e) {
      next(e);
    }
  },
);

router.delete(
  "/project-orders/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0)
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const rows = await query(
        `SELECT id FROM pm_orders
         WHERE id = :id AND company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Order not found");
      await ensurePMOrderTables();
      await query(
        "UPDATE pm_orders SET status = 'CANCELLED', is_active = 'N', deleted_at = NOW() WHERE id = :id AND company_id = :companyId AND branch_id = :branchId",
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ success: true, id });
    } catch (e) {
      next(e);
    }
  },
);

router.post(
  "/project-orders/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMOrderTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = Number(req.params.id);
      if (!Number.isFinite(id))
        throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const [existing] = await query(
        `SELECT id, status, total_amount FROM pm_orders
         WHERE id = :id AND company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))
         LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      ).catch(() => []);
      if (!existing) throw httpError(404, "NOT_FOUND", "Order not found");

      const amount = req.body?.amount == null
        ? existing.total_amount == null ? null : Number(existing.total_amount || 0)
        : Number(req.body.amount || 0);
      const explicitWorkflowId = req.body?.workflow_id == null ? null : Number(req.body.workflow_id);
      const targetUserId = req.body?.target_user_id == null ? null : Number(req.body.target_user_id);

      let { activeWorkflow: activeWf, inactiveWorkflow } = await resolveWorkflowSelection({
        companyId,
        workflowIdOverride: explicitWorkflowId,
        docRouteBase: "/project-management/project-orders",
        typeSynonyms: ["PROJECT_ORDER", "Project Order", "PROJECT_ORDER:LOCAL"],
        amount,
      });

      if (!activeWf && Number.isFinite(targetUserId) && targetUserId > 0) {
        try {
          await query(
            `INSERT INTO adm_workflows (company_id, workflow_code, workflow_name, module_key, document_type, document_route, is_active)
             VALUES (:companyId, 'WF-PO-DEFAULT', 'Default PO Approval', 'project-management', 'PROJECT_ORDER', '/project-management/project-orders', 1)
             ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
            { companyId },
          );
        } catch {}
        const wfRows = await query(
          `SELECT * FROM adm_workflows
           WHERE company_id = :companyId
             AND module_key = 'project-management'
             AND (document_type = 'PROJECT_ORDER' OR document_type = 'Project Order')
             AND workflow_name = 'Default PO Approval'
           ORDER BY id ASC LIMIT 1`,
          { companyId },
        ).catch(() => []);
        if (wfRows.length) {
          const wfId = wfRows[0].id;
          try {
            await query(
              `INSERT INTO adm_workflow_steps (workflow_id, step_order, step_name, approver_user_id, approver_role_id, min_amount, max_amount, approval_limit, is_mandatory)
               VALUES (:wfId, 1, 'Approval', :uid, NULL, NULL, NULL, NULL, 1)
               ON DUPLICATE KEY UPDATE approver_user_id = VALUES(approver_user_id)`,
              { wfId, uid: targetUserId },
            );
          } catch {}
          try {
            await query(
              `INSERT INTO adm_workflow_step_approvers (workflow_id, step_order, approver_user_id, approval_limit)
               VALUES (:wfId, 1, :uid, NULL)
               ON DUPLICATE KEY UPDATE approval_limit = VALUES(approval_limit)`,
              { wfId, uid: targetUserId },
            );
          } catch {}
          activeWf = wfRows[0];
        }
      }

      if (!activeWf) {
        const behavior = getInactiveWorkflowBehavior(inactiveWorkflow);
        if (behavior && behavior.toUpperCase() !== "AUTO_APPROVE") {
          return res.json({ id, status: "SUBMITTED" });
        }
        await query(
          `UPDATE pm_orders SET status = 'POSTED' WHERE id = :id AND company_id = :companyId
             AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
          { id, companyId, branchId, branchIdsStr },
        );
        return res.json({ id, status: "POSTED" });
      }

      const steps = await query(
        `SELECT * FROM adm_workflow_steps
         WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(
          `UPDATE pm_orders SET status = 'POSTED' WHERE id = :id AND company_id = :companyId
             AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
          { id, companyId, branchId, branchIdsStr },
        );
        return res.json({ id, status: "POSTED" });
      }

      const first = steps[0];
      if (!first.approver_user_id) {
        throw httpError(400, "BAD_REQUEST", "Workflow step 1 has no approver_user_id configured");
      }

      const allowedUsers = await query(
        `SELECT approver_user_id FROM adm_workflow_step_approvers
         WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(allowedUsers.map((r) => Number(r.approver_user_id)));
      let assignedToUserId = Number(first.approver_user_id);
      if (targetUserId != null && Number.isFinite(targetUserId) && allowedSet.has(Number(targetUserId))) {
        assignedToUserId = Number(targetUserId);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }

      const dwRes = await query(
        `INSERT INTO adm_document_workflows
           (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
         VALUES
           (:companyId, :workflowId, :documentId, 'PROJECT_ORDER', :amount, :stepOrder, 'PENDING', :assignedTo)`,
        {
          companyId, workflowId: activeWf.id, documentId: id,
          amount: amount === null ? null : Number(amount),
          stepOrder: first.step_order, assignedTo: assignedToUserId,
        },
      );
      const instanceId = dwRes.insertId;

      await query(
        `INSERT INTO adm_workflow_tasks
           (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
         VALUES
           (:companyId, :workflowId, :dwId, :documentId, 'PROJECT_ORDER', :stepOrder, :assignedTo, 'PENDING')`,
        {
          companyId, workflowId: activeWf.id, dwId: instanceId,
          documentId: id, stepOrder: first.step_order, assignedTo: assignedToUserId,
        },
      );

      await query(
        `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES (:dwId, :stepOrder, 'SUBMIT', :actor, :comments)`,
        { dwId: instanceId, stepOrder: first.step_order, actor: req.user.sub, comments: req.body?.comments || "" },
      );

      await query(
        `UPDATE pm_orders SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId
           AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ id, status: "PENDING_APPROVAL" });
    } catch (e) {
      next(e);
    }
  },
);

// ===== PM PURCHASE REQUISITIONS =====
async function nextPMReqNo(companyId, branchId) {
  const rows = await query(
    `SELECT requisition_no FROM pm_purchase_requisitions
     WHERE company_id = :companyId AND branch_id = :branchId
       AND requisition_no REGEXP '^PR-[0-9]{6}$'
     ORDER BY CAST(SUBSTRING(requisition_no, 4) AS UNSIGNED) DESC LIMIT 1`,
    { companyId, branchId },
  );
  let nextNum = 1;
  if (rows.length > 0) {
    const prev = String(rows[0].requisition_no || "");
    const n = parseInt(prev.slice(3), 10);
    if (Number.isFinite(n)) nextNum = n + 1;
  }
  return `PR-${String(nextNum).padStart(6, "0")}`;
}

router.get(
  "/purchase-requisitions/next-no",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null } = req.scope || {};
      const requisition_no = await nextPMReqNo(companyId, branchId);
      res.json({ requisition_no });
    } catch (e) { next(e); }
  },
);

router.get(
  "/purchase-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { status, from_date, to_date } = req.query;
      let where = "WHERE r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) AND COALESCE(r.is_active,'Y') = 'Y'";
      const params = { companyId, branchId, branchIdsStr };
      if (status) { where += " AND r.status = :status"; params.status = status; }
      if (from_date) { where += " AND r.requisition_date >= :from_date"; params.from_date = from_date; }
      if (to_date) { where += " AND r.requisition_date <= :to_date"; params.to_date = to_date; }
      const rows = await query(
        `SELECT r.*, COALESCE(SUM(i.estimated_total), 0) AS total_estimated_cost, COUNT(i.id) AS item_count,
                cr.username AS created_by_name
         FROM pm_purchase_requisitions r
         LEFT JOIN pm_purchase_requisition_items i ON i.requisition_id = r.id
         LEFT JOIN adm_users cr ON cr.id = r.created_by
         ${where}
         GROUP BY r.id ORDER BY r.created_at DESC`,
        params,
      );
      res.json({ items: rows });
    } catch (e) { next(e); }
  },
);

router.get(
  "/purchase-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid ID");
      const rows = await query(
        `SELECT r.*, cr.username AS created_by_name
         FROM pm_purchase_requisitions r
         LEFT JOIN adm_users cr ON cr.id = r.created_by
         WHERE r.id = :id AND r.company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(r.branch_id, :branchIdsStr)) LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!rows.length) throw httpError(404, "NOT_FOUND", "Requisition not found");
      const items = await query(
        `SELECT gi.*, inv.item_code, inv.item_name
         FROM pm_purchase_requisition_items gi
         LEFT JOIN inv_items inv ON inv.id = gi.item_id
         WHERE gi.requisition_id = :id ORDER BY gi.id`,
        { id },
      );
      res.json({ ...rows[0], items });
    } catch (e) { next(e); }
  },
);

router.post(
  "/purchase-requisitions",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const userId = req.user?.sub || null;
      const { requisition_date, project_id, department, requested_by, purpose, priority, required_date, status, remarks, items, timeline } = req.body;
      if (!requisition_date) throw httpError(400, "VALIDATION_ERROR", "Date is required");
      const lineItems = Array.isArray(items) ? items.filter((i) => i.description) : [];
      if (!lineItems.length) throw httpError(400, "VALIDATION_ERROR", "At least one line item is required");
      const requisition_no = await nextPMReqNo(companyId, branchId);
      const finalStatus = status === "SUBMITTED" ? "SUBMITTED" : "DRAFT";
      const result = await query(
        `INSERT INTO pm_purchase_requisitions
         (company_id, branch_id, requisition_no, requisition_date, project_id, department, requested_by, purpose, priority, required_date, status, remarks, created_by, timeline)
         VALUES (:companyId, :branchId, :requisition_no, :requisition_date, :project_id, :department, :requested_by, :purpose, :priority, :required_date, :status, :remarks, :created_by, :timeline)`,
        {
          companyId, branchId, requisition_no, requisition_date,
          project_id: project_id || null,
          department: department || null,
          requested_by: requested_by || null,
          purpose: purpose || null,
          priority: priority || "MEDIUM",
          required_date: required_date || null,
          status: finalStatus,
          remarks: remarks || null,
          created_by: userId,
          timeline: timeline || null,
        },
      );
      const reqId = Number(result.insertId);
      for (const item of lineItems) {
        const qty = Number(item.qty || 0);
        const unitCost = Number(item.estimated_unit_cost || 0);
        await query(
          `INSERT INTO pm_purchase_requisition_items (requisition_id, item_id, description, qty, uom, estimated_unit_cost, estimated_total, remarks)
           VALUES (:requisition_id, :item_id, :description, :qty, :uom, :estimated_unit_cost, :estimated_total, :remarks)`,
          {
            requisition_id: reqId,
            item_id: item.item_id ? Number(item.item_id) : null,
            description: item.description || "",
            qty,
            uom: item.uom || null,
            estimated_unit_cost: unitCost,
            estimated_total: qty * unitCost,
            remarks: item.remarks || null,
          },
        );
      }
      res.status(201).json({ id: reqId, requisition_no, status: finalStatus, message: "Purchase Requisition created" });
    } catch (e) { next(e); }
  },
);

router.put(
  "/purchase-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid ID");
      const existing = await query(
        `SELECT * FROM pm_purchase_requisitions WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr)) LIMIT 1`,
        { id, companyId, branchId, branchIdsStr },
      );
      if (!existing.length) throw httpError(404, "NOT_FOUND", "Requisition not found");
      if (["APPROVED", "FULFILLED", "CANCELLED"].includes(existing[0].status))
        throw httpError(400, "VALIDATION_ERROR", "Cannot edit a requisition with status: " + existing[0].status);
      const { requisition_date, project_id, department, requested_by, purpose, priority, required_date, status, remarks, items, timeline } = req.body;
      const finalStatus = status || existing[0].status;
      await query(
        `UPDATE pm_purchase_requisitions SET
         requisition_date = :requisition_date, project_id = :project_id, department = :department, requested_by = :requested_by,
         purpose = :purpose, priority = :priority, required_date = :required_date, status = :status, remarks = :remarks, timeline = :timeline
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        {
          requisition_date: requisition_date || existing[0].requisition_date,
          project_id: project_id !== undefined ? project_id : existing[0].project_id,
          department: department !== undefined ? department : existing[0].department,
          requested_by: requested_by !== undefined ? requested_by : existing[0].requested_by,
          purpose: purpose !== undefined ? purpose : existing[0].purpose,
          priority: priority || existing[0].priority,
          required_date: required_date !== undefined ? required_date : existing[0].required_date,
          status: finalStatus,
          remarks: remarks !== undefined ? remarks : existing[0].remarks,
          timeline: timeline !== undefined ? timeline : existing[0].timeline,
          id, companyId, branchId, branchIdsStr,
        },
      );
      if (Array.isArray(items)) {
        await query("DELETE FROM pm_purchase_requisition_items WHERE requisition_id = :id", { id });
        for (const item of items.filter((i) => i.description)) {
          const qty = Number(item.qty || 0);
          const unitCost = Number(item.estimated_unit_cost || 0);
          await query(
            `INSERT INTO pm_purchase_requisition_items (requisition_id, item_id, description, qty, uom, estimated_unit_cost, estimated_total, remarks)
             VALUES (:requisition_id, :item_id, :description, :qty, :uom, :estimated_unit_cost, :estimated_total, :remarks)`,
            {
              requisition_id: id,
              item_id: item.item_id ? Number(item.item_id) : null,
              description: item.description || "",
              qty, uom: item.uom || null,
              estimated_unit_cost: unitCost, estimated_total: qty * unitCost,
              remarks: item.remarks || null,
            },
          );
        }
      }
      res.json({ id, status: finalStatus, message: "Purchase Requisition updated" });
    } catch (e) { next(e); }
  },
);

router.delete(
  "/purchase-requisitions/:id",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid ID");

      const uRows = await query(
        `SELECT 1 FROM adm_exceptional_permissions WHERE user_id = :uid AND effect = 'ALLOW' AND is_active = 1 AND permission_code = 'PM.PR.CANCEL' LIMIT 1`,
        { uid: req.user?.sub }
      );
      if (!uRows || uRows.length === 0) {
        throw httpError(403, "FORBIDDEN", "You do not have exceptional permission to cancel purchase requisitions");
      }

      await query(
        `UPDATE pm_purchase_requisitions SET status = 'CANCELLED', is_active = 'N', deleted_at = NOW()
         WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`,
        { id, companyId, branchId, branchIdsStr },
      );
      res.json({ id, status: "CANCELLED" });
    } catch (e) { next(e); }
  },
);

router.post(
  "/purchase-requisitions/:id/submit",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      await ensurePMPurchaseRequisitionTables();
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const id = toNumber(req.params.id);
      if (!id) throw httpError(400, "VALIDATION_ERROR", "Invalid id");
      const amount = req.body?.amount ?? null;
      const workflowIdOverride = toNumber(req.body?.workflow_id);
      const docRouteBase = "/project-management/purchase-requisitions";
      const { activeWorkflow: activeWf } = await resolveWorkflowSelection({
        companyId, workflowIdOverride, docRouteBase,
        typeSynonyms: ["PURCHASE_REQUISITION", "Purchase Requisition", "PM_PURCHASE_REQUISITION"],
        amount,
      });
      if (!activeWf) {
        await query(`UPDATE pm_purchase_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`, { id, companyId, branchId });
        return res.json({ status: "APPROVED" });
      }
      const steps = await query(
        `SELECT * FROM adm_workflow_steps WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
        { wf: activeWf.id },
      );
      if (!steps.length) {
        await query(`UPDATE pm_purchase_requisitions SET status = 'APPROVED' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`, { id, companyId, branchId });
        return res.json({ status: "APPROVED" });
      }
      const first = steps[0];
      if (!first.approver_user_id) throw httpError(400, "BAD_REQUEST", "Workflow step 1 has no approver_user_id configured");
      const allowedUsers = await query(
        `SELECT approver_user_id FROM adm_workflow_step_approvers WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: first.step_order },
      );
      const allowedSet = new Set(allowedUsers.map((r) => Number(r.approver_user_id)));
      let assignedToUserId = Number(first.approver_user_id);
      const targetUserIdRaw = req.body?.target_user_id;
      if (targetUserIdRaw != null && allowedSet.has(Number(targetUserIdRaw))) {
        assignedToUserId = Number(targetUserIdRaw);
      } else if (allowedUsers.length > 0) {
        assignedToUserId = Number(allowedUsers[0].approver_user_id);
      }
      const dwRes = await query(
        `INSERT INTO adm_document_workflows
           (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
         VALUES (:companyId, :workflowId, :documentId, 'PURCHASE_REQUISITION', :amount, :stepOrder, 'PENDING', :assignedTo)`,
        { workflowId: activeWf.id, documentId: id, amount: amount === null ? null : Number(amount), stepOrder: first.step_order, assignedTo: assignedToUserId },
      );
      const instanceId = dwRes.insertId;
      await query(
        `INSERT INTO adm_workflow_tasks (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
         VALUES (:companyId, :workflowId, :dwId, :documentId, 'PURCHASE_REQUISITION', :stepOrder, :assignedTo, 'PENDING')`,
        { workflowId: activeWf.id, dwId: instanceId, documentId: id, stepOrder: first.step_order, assignedTo: assignedToUserId },
      );
      await query(
        `INSERT INTO adm_workflow_logs (document_workflow_id, step_order, action, actor_user_id, comments)
         VALUES (:dwId, :stepOrder, 'SUBMIT', :actor, '')`,
        { dwId: instanceId, stepOrder: first.step_order, actor: req.user.sub },
      );
      await query(`UPDATE pm_purchase_requisitions SET status = 'PENDING_APPROVAL' WHERE id = :id AND company_id = :companyId AND (:branchIdsStr = '' OR FIND_IN_SET(branch_id, :branchIdsStr))`, { id, companyId, branchId, branchIdsStr });
      res.status(201).json({ instanceId, status: "PENDING_APPROVAL" });
    } catch (e) { next(e); }
  },
);


// ==========================================
// PROJECT QUOTATIONS
// ==========================================

router.get("/project-quotations/next-no", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId } = req;
    const [rows] = await query(
      `SELECT MAX(CAST(REPLACE(quotation_no, 'PQ-', '') AS UNSIGNED)) as max_no
       FROM prj_quotations WHERE company_id = ?`,
      [companyId]
    );
    const maxNo = rows[0]?.max_no || 0;
    const nextNo = `PQ-${String(maxNo + 1).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
});

router.get("/project-quotations", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId } = req;
    const [items] = await query(`SELECT * FROM prj_quotations WHERE company_id = ? ORDER BY id DESC`, [companyId]);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get("/project-quotations/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const [items] = await query(`SELECT * FROM prj_quotations WHERE id = ? AND company_id = ?`, [req.params.id, companyId]);
    if (!items.length) return res.status(404).json({ message: "Not found" });
    const item = items[0];
    const [details] = await query(`SELECT * FROM prj_quotation_details WHERE quotation_id = ?`, [item.id]);
    item.items = details;
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.post("/project-quotations", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId } = req;
    const data = req.body;
    const resH = await query(
      `INSERT INTO prj_quotations (company_id, branch_id, quotation_no, quotation_date, project_id, project_name, customer_id, customer_name, total_amount, net_amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [companyId, branchId, data.quotation_no, data.quotation_date, data.project_id || null, data.project_name || null, data.customer_id || null, data.customer_name || null, data.total_amount || 0, data.net_amount || 0, req.user?.id || null]
    );
    const id = resH.insertId;
    if (data.items && data.items.length) {
      for (const item of data.items) {
        await query(
          `INSERT INTO prj_quotation_details (quotation_id, item_id, qty, unit_price, total_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.item_id || 0, item.qty || 0, item.unit_price || 0, item.total_amount || 0, item.net_amount || 0]
        );
      }
    }
    res.json({ message: "Created", item: { id } });
  } catch (err) {
    next(err);
  }
});

router.put("/project-quotations/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const id = req.params.id;
    const data = req.body;
    await query(
      `UPDATE prj_quotations SET quotation_no=?, quotation_date=?, project_id=?, project_name=?, customer_id=?, customer_name=?, total_amount=?, net_amount=? WHERE id=? AND company_id=?`,
      [data.quotation_no, data.quotation_date, data.project_id || null, data.project_name || null, data.customer_id || null, data.customer_name || null, data.total_amount || 0, data.net_amount || 0, id, companyId]
    );
    await query(`DELETE FROM prj_quotation_details WHERE quotation_id=?`, [id]);
    if (data.items && data.items.length) {
      for (const item of data.items) {
        await query(
          `INSERT INTO prj_quotation_details (quotation_id, item_id, qty, unit_price, total_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.item_id || 0, item.qty || 0, item.unit_price || 0, item.total_amount || 0, item.net_amount || 0]
        );
      }
    }
    res.json({ message: "Updated" });
  } catch (err) {
    next(err);
  }
});

router.delete("/project-quotations/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    await query(`DELETE FROM prj_quotations WHERE id=? AND company_id=?`, [req.params.id, companyId]);
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

router.post("/project-quotations/:id/submit", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    await query(`UPDATE prj_quotations SET status='APPROVED' WHERE id=? AND company_id=?`, [req.params.id, companyId]);
    res.json({ message: "Submitted" });
  } catch (err) {
    next(err);
  }
});

// ==========================================
// PROJECT INVOICES
// ==========================================

router.get("/project-invoices/next-no", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const [rows] = await query(
      `SELECT MAX(CAST(REPLACE(invoice_no, 'PINV-', '') AS UNSIGNED)) as max_no
       FROM prj_invoices WHERE company_id = ?`,
      [companyId]
    );
    const maxNo = rows[0]?.max_no || 0;
    const nextNo = `PINV-${String(maxNo + 1).padStart(6, "0")}`;
    res.json({ nextNo });
  } catch (err) {
    next(err);
  }
});

router.get("/project-invoices", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const [items] = await query(`SELECT * FROM prj_invoices WHERE company_id = ? ORDER BY id DESC`, [companyId]);
    res.json({ items });
  } catch (err) {
    next(err);
  }
});

router.get("/project-invoices/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const [items] = await query(`SELECT * FROM prj_invoices WHERE id = ? AND company_id = ?`, [req.params.id, companyId]);
    if (!items.length) return res.status(404).json({ message: "Not found" });
    const item = items[0];
    const [details] = await query(`SELECT * FROM prj_invoice_details WHERE invoice_id = ?`, [item.id]);
    item.items = details;
    res.json({ item });
  } catch (err) {
    next(err);
  }
});

router.post("/project-invoices", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId, branchId } = req;
    const data = req.body;
    const resH = await query(
      `INSERT INTO prj_invoices (company_id, branch_id, invoice_no, invoice_date, project_id, project_name, customer_id, customer_name, total_amount, net_amount, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT', ?)`,
      [companyId, branchId, data.invoice_no, data.invoice_date, data.project_id || null, data.project_name || null, data.customer_id || null, data.customer_name || null, data.total_amount || 0, data.net_amount || 0, req.user?.id || null]
    );
    const id = resH.insertId;
    if (data.items && data.items.length) {
      for (const item of data.items) {
        await query(
          `INSERT INTO prj_invoice_details (invoice_id, item_id, qty, unit_price, total_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.item_id || 0, item.qty || 0, item.unit_price || 0, item.total_amount || 0, item.net_amount || 0]
        );
      }
    }
    res.json({ message: "Created", item: { id } });
  } catch (err) {
    next(err);
  }
});

router.put("/project-invoices/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    const id = req.params.id;
    const data = req.body;
    await query(
      `UPDATE prj_invoices SET invoice_no=?, invoice_date=?, project_id=?, project_name=?, customer_id=?, customer_name=?, total_amount=?, net_amount=? WHERE id=? AND company_id=?`,
      [data.invoice_no, data.invoice_date, data.project_id || null, data.project_name || null, data.customer_id || null, data.customer_name || null, data.total_amount || 0, data.net_amount || 0, id, companyId]
    );
    await query(`DELETE FROM prj_invoice_details WHERE invoice_id=?`, [id]);
    if (data.items && data.items.length) {
      for (const item of data.items) {
        await query(
          `INSERT INTO prj_invoice_details (invoice_id, item_id, qty, unit_price, total_amount, net_amount) VALUES (?, ?, ?, ?, ?, ?)`,
          [id, item.item_id || 0, item.qty || 0, item.unit_price || 0, item.total_amount || 0, item.net_amount || 0]
        );
      }
    }
    res.json({ message: "Updated" });
  } catch (err) {
    next(err);
  }
});

router.delete("/project-invoices/:id", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    await query(`DELETE FROM prj_invoices WHERE id=? AND company_id=?`, [req.params.id, companyId]);
    res.json({ message: "Deleted" });
  } catch (err) {
    next(err);
  }
});

router.post("/project-invoices/:id/submit", requireAuth, requireCompanyScope, requireBranchScope, async (req, res, next) => {
  try {
    const { companyId } = req;
    await query(`UPDATE prj_invoices SET status='APPROVED' WHERE id=? AND company_id=?`, [req.params.id, companyId]);
    res.json({ message: "Submitted" });
  } catch (err) {
    next(err);
  }
});

export default router;

