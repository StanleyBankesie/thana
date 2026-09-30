/**
 * @file workflow.routes.js
 * @description Express routes for workflow configurations, steps, and approvals.
 */
import express from "express";
import {
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
} from "../middleware/auth.js";
import * as workflowController from "../controllers/workflow.controller.js";
import { query } from "../db/pool.js";

const router = express.Router();

// ==========================================
// WORKFLOW EXECUTION & NOTIFICATIONS
// (Specific routes MUST be defined before generic /:id routes)
// ==========================================

// Start Workflow for a Document
router.post(
  "/start",
  requireAuth,
  requireCompanyScope,
  workflowController.startWorkflow,
);

// Get Pending Approvals for Current User
router.get(
  "/approvals/pending",
  requireAuth,
  requireCompanyScope,
  workflowController.getPendingApprovals,
);

// Get Workflow Instance Detail
router.get(
  "/approvals/instance/:instanceId",
  requireAuth,
  requireCompanyScope,
  workflowController.getApprovalInstanceDetail,
);

// Get Latest Workflow Comment for Document
router.get(
  "/logs/:documentType/:documentId/latest-comment",
  requireAuth,
  requireCompanyScope,
  workflowController.getLatestComment,
);

router.get(
  "/debug/:instanceId/email",
  requireAuth,
  requireCompanyScope,
  workflowController.debugWorkflowEmailStatus,
);

// Reverse Approval (Exceptional Permission)
router.post(
  "/:instanceId/reverse",
  requireAuth,
  requireCompanyScope,
  workflowController.reverseApproval,
);

// Direct Approve by Document Type + ID (simple approval bypassing multi-step workflow)
router.post(
  "/approve",
  requireAuth,
  requireCompanyScope,
  async (req, res, next) => {
    try {
      const { companyId = null } = req.scope || {};
      const { document_type, document_id } = req.body || {};
      if (!document_type || !document_id) {
        return res.status(400).json({ message: "document_type and document_id are required" });
      }
      const id = Number(document_id);
      if (!id) {
        return res.status(400).json({ message: "Invalid document_id" });
      }
      const tableMap = {
        SERVICE_REQUEST: { table: "pur_service_requests", idCol: "id" },
        SERVICE_BILL: { table: "pur_service_bills", idCol: "id" },
      };
      const mapping = tableMap[document_type];
      if (!mapping) {
        return res.status(400).json({ message: `Unsupported document_type: ${document_type}` });
      }
      const [existing] = await query(
        `SELECT id, status FROM ${mapping.table} WHERE ${mapping.idCol} = :id AND company_id = :companyId`,
        { id, companyId },
      );
      if (!existing) {
        return res.status(404).json({ message: "Document not found" });
      }
      if (String(existing.status || "").toUpperCase() !== "PENDING") {
        return res.status(400).json({ message: `Document is not PENDING (current status: ${existing.status})` });
      }
      await query(
        `UPDATE ${mapping.table} SET status = 'APPROVED' WHERE ${mapping.idCol} = :id AND company_id = :companyId`,
        { id, companyId },
      );
      res.json({ message: "Approved", status: "APPROVED" });
    } catch (err) {
      next(err);
    }
  },
);

// Reverse by Document (Exceptional Permission)
router.post(
  "/reverse-by-document",
  requireAuth,
  requireCompanyScope,
  workflowController.reverseByDocument,
);

// Get Notifications
router.get(
  "/notifications",
  requireAuth,
  requireCompanyScope,
  workflowController.getNotifications,
);

// Search Users for Approver selection
router.get(
  "/users",
  requireAuth,
  requireCompanyScope,
  requireBranchScope,
  async (req, res, next) => {
    try {
      const { companyId, branchId = null, branchIdsStr = '' } = req.scope || {};
      const { q, active, limit } = req.query || {};
      const clauses = ["u.company_id = :companyId", "(:branchIdsStr = '' OR FIND_IN_SET(u.branch_id, :branchIdsStr))"];
      const params = { companyId, branchId, branchIdsStr };
      if (typeof active !== "undefined" && active !== "") {
        clauses.push("u.is_active = :is_active");
        params.is_active = Number(Boolean(active));
      }
      if (q && String(q).trim().length > 0) {
        params.q = `%${String(q).trim()}%`;
        clauses.push(
          "(u.username LIKE :q OR u.full_name LIKE :q OR u.email LIKE :q)",
        );
      }
      const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      const lim = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));
      const items = await query(`
        SELECT u.id, u.username, u.full_name, u.email, u.is_active,
          u.created_at,
          uc.username AS created_by_name
         FROM adm_users u
        LEFT JOIN adm_users uc ON uc.id = u.created_by
        ${where}
         ORDER BY u.username ASC
        LIMIT ${lim}
        `,
        params,
      );
      res.json({ items });
    } catch (err) {
      next(err);
    }
  },
);

// Mark Notifications Read (Bulk)
router.put(
  "/notifications/read-bulk",
  requireAuth,
  workflowController.markNotificationsReadBulk,
);

// Mark Notification Read
router.put(
  "/notifications/:id/read",
  requireAuth,
  workflowController.markNotificationRead,
);

// Perform Action (Approve/Reject/Return)
router.post(
  "/:instanceId/action",
  requireAuth,
  requireCompanyScope,
  workflowController.performAction,
);

// ==========================================
// WORKFLOW DEFINITIONS (CRUD)
// ==========================================

// List Workflows
router.get(
  "/",
  requireAuth,
  requireCompanyScope,
  workflowController.listWorkflows,
);

// Create Workflow
router.post(
  "/",
  requireAuth,
  requireCompanyScope,
  workflowController.createWorkflow,
);

// Update Workflow
router.put(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.updateWorkflow,
);

// Delete Workflow
router.delete(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.deleteWorkflow,
);

// Get Workflow Detail (Wildcard - MUST BE LAST GET)
router.get(
  "/:id",
  requireAuth,
  requireCompanyScope,
  workflowController.getWorkflow,
);

export default router;

