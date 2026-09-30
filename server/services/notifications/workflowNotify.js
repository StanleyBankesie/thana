/**
 * @file workflowNotify.js
 * @description Provides cross-channel notification capabilities for workflow actions.
 * Dispatches notifications to the database, WebSocket clients (Socket.IO),
 * push notifications, and emails (SMTP) in a unified manner.
 */

import { query } from "../../db/pool.js";
import { sendPushToUser } from "../../routes/push.routes.js";
import { sendMail } from "../../utils/mailer.js";
import { getIO } from "../../utils/socket.js";
import { ensureWorkflowTables } from "../../utils/dbUtils.js";

/**
 * Sends a comprehensive multi-channel notification to a user when a document
 * is forwarded to them in a workflow. Attempts database insertion, real-time
 * WebSocket broadcast, mobile push notification, and finally an email dispatch.
 * 
 * @param {Object} params - The notification payload and configuration.
 * @param {number|string} params.companyId - The ID of the company.
 * @param {number|string} params.userId - The ID of the recipient user.
 * @param {number|string} params.workflowInstanceId - The ID of the active workflow instance.
 * @param {number|string} params.documentId - The reference ID of the forwarded document.
 * @param {string} params.documentType - The type of document (e.g., 'invoice', 'purchase-order').
 * @param {string} [params.title="Document Forwarded"] - Notification title.
 * @param {string} [params.message=""] - Detailed message for the user.
 * @param {string} [params.action="APPROVE"] - The action expected from the user.
 * @param {string} [params.link="/administration/workflows/approvals/..."] - The URL path to the approval page.
 * @param {string} [params.senderName="System"] - The name of the user or system component that forwarded the document.
 * @returns {Promise<void>} Resolves when all notification channels have been attempted (errors are swallowed).
 */
export async function notifyWorkflowForward({
  companyId,
  userId,
  workflowInstanceId,
  documentId,
  documentType,
  title = "Document Forwarded",
  message = "",
  action = "APPROVE",
  link = `/administration/workflows/approvals/${workflowInstanceId}`,
  senderName = "System",
  req = null,
}) {
  let baseUrl = process.env.APP_URL;
  if (!baseUrl && req) {
    if (req.headers?.origin) {
      baseUrl = req.headers.origin;
    } else if (req.headers?.referer) {
      try {
        baseUrl = new URL(req.headers.referer).origin;
      } catch {}
    }
  }
  if (!baseUrl) baseUrl = "http://localhost:3000";
  const linkAbs = `${baseUrl}${link}`;

  try {
    await ensureWorkflowTables();
    await query(
      `INSERT INTO adm_notifications (company_id, user_id, title, message, link, is_read)
       VALUES (:companyId, :userId, :title, :message, :link, 0)`,
      { companyId, userId, title, message, link },
    );
  } catch {}
  try {
    const io = getIO();
    io.to(`user_${userId}`).emit("notifications:new", {
      title: title || "Notification",
      message: message || "",
      link,
      type: "workflow",
      documentId,
      workflowInstanceId,
    });
  } catch {}

  // Dispatch Push, Email, WhatsApp, and SMS asynchronously via setImmediate
  setImmediate(async () => {
    try {
      const payload = {
        title: title || "Document Forwarded",
        message: message || `A ${documentType} has been forwarded to you.`,
        type: "workflow-forward",
        documentType,
        documentRef: String(documentId),
        actionType: action,
        senderName,
        link,
        tag: `wf-${workflowInstanceId || documentId}`,
      };
      await sendPushToUser(userId, payload);
    } catch {}

    try {
      const unameRows = await query(
        `SELECT username FROM adm_users WHERE id = :userId AND is_active = 1 LIMIT 1`,
        { userId },
      );
      const uname = unameRows?.[0]?.username || null;
      let to = null;
      if (uname) {
        const emailRows = await query(
          `SELECT email FROM adm_users WHERE username = :uname AND company_id = :companyId AND is_active = 1 LIMIT 1`,
          { uname, companyId },
        );
        to = emailRows?.[0]?.email || null;
      }
      if (to) {
        const subject = title || "Document Forwarded";
        const text = [
          "Hello,",
          "",
          message || `A ${documentType} has been forwarded to you.`,
          "",
          `Document Type: ${documentType}`,
          `Reference No: ${documentId}`,
          `Sent By: ${senderName}`,
          `Action Required: ${action}`,
          "",
          `Open: ${linkAbs}`,
        ].join("\n");
        const html = [
          `<p>Hello,</p>`,
          `<p>${message || "A document has been forwarded to you."}</p>`,
          `<div style="background:#f5f5f5;padding:12px;border-radius:6px">`,
          `<p><strong>Document Type:</strong> ${documentType}</p>`,
          `<p><strong>Reference No:</strong> ${documentId}</p>`,
          `<p><strong>Sent By:</strong> ${senderName}</p>`,
          `<p><strong>Action Required:</strong> ${action}</p>`,
          `</div>`,
          `<p><a href="${linkAbs}" style="background:#0e3646;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">Open Document</a></p>`,
        ].join("");
        await sendMail({
          to,
          subject,
          text,
          html,
          meta: {
            moduleName: "WorkflowNotify",
            action: "EMAIL_SENT",
            userId,
            companyId,
            refNo: String(documentId),
            urlPath: linkAbs,
            message: `Workflow forward email sent to ${to}`,
          },
        });
      }
    } catch {}

    try {
      const { isWhatsAppConfigured, sendWhatsApp } = await import("../../utils/whatsapp.js");
      if (isWhatsAppConfigured()) {
        const uRows = await query(
          `SELECT telephone FROM adm_users WHERE id = :userId AND is_active = 1 LIMIT 1`,
          { userId }
        );
        const phone = uRows?.[0]?.telephone;
        if (phone) {
          const waText = `*Action Required*\n${documentType} #${documentId} needs your ${action}.\n\nView Document:\n${linkAbs}`;
          await sendWhatsApp({ to: phone, message: waText });
        }
      }
    } catch {}

    try {
      const { isSMSConfigured, sendSMS } = await import("../../utils/sms.js");
      if (isSMSConfigured()) {
        const uRows = await query(
          `SELECT telephone FROM adm_users WHERE id = :userId AND is_active = 1 LIMIT 1`,
          { userId }
        );
        const phone = uRows?.[0]?.telephone;
        if (phone) {
          const smsText = `${title || "Document Forwarded"} - Action Required: ${action} - Ref: ${documentId} - Link: ${linkAbs}`;
          await sendSMS({ to: phone, message: smsText });
        }
      }
    } catch {}
  });
}
