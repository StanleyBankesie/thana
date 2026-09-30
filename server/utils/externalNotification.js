import { isMailerConfigured, sendMail } from "./mailer.js";
import { isSMSConfigured, sendSMS } from "./sms.js";
import { isWhatsAppConfigured, sendWhatsApp } from "./whatsapp.js";

/**
 * Sends a notification via multiple channels.
 * @param {Object} options
 * @param {string} options.type - 'email', 'sms', 'whatsapp', or 'all'
 * @param {string} options.recipientEmail - Target email address
 * @param {string} options.recipientPhone - Target phone number
 * @param {string} options.subject - Email subject
 * @param {string} options.text - Text payload for Email/SMS/WhatsApp
 * @param {string} options.html - HTML payload for Email
 * @param {Array} options.attachments - Email attachments
 */
export const sendExternalNotification = async ({
  type,
  recipientEmail,
  recipientPhone,
  subject,
  text,
  html,
  attachments = [],
}) => {
  const sendAll = type === "all";
  let results = { email: false, sms: false, whatsapp: false, message: "" };

  if ((type === "email" || sendAll) && recipientEmail) {
    if (isMailerConfigured()) {
      try {
        await sendMail({ to: recipientEmail, subject, text, html, attachments });
        results.email = true;
        results.message += "Email sent. ";
      } catch (err) {
        console.error("Failed to send email:", err.message);
        results.message += `Email failed (${err.message}). `;
      }
    } else {
      results.message += "Email not configured. ";
    }
  }

  if ((type === "sms" || sendAll) && recipientPhone) {
    if (isSMSConfigured()) {
      try {
        await sendSMS({ to: recipientPhone, message: text });
        results.sms = true;
        results.message += "SMS sent. ";
      } catch (err) {
        console.error("Failed to send SMS:", err.message);
        results.message += `SMS failed (${err.message}). `;
      }
    } else {
      results.message += "SMS not configured. ";
    }
  }

  if ((type === "whatsapp" || sendAll) && recipientPhone) {
    if (isWhatsAppConfigured()) {
      try {
        await sendWhatsApp({ to: recipientPhone, message: text });
        results.whatsapp = true;
        results.message += "WhatsApp sent. ";
      } catch (err) {
        console.error("Failed to send WhatsApp:", err.message);
        results.message += `WhatsApp failed (${err.message}). `;
      }
    } else {
      results.message += "WhatsApp not configured. ";
    }
  }

  if (!results.message) {
    results.message = "No valid contact info or notification types selected.";
  }

  return results;
};

export const checkAndSendAutomaticNotification = async ({
  companyId,
  moduleCode,
  statusTrigger,
  documentId,
}) => {
  try {
    const { query } = await import("../db/pool.js");

    // 1. Check if settings exist for this trigger
    const [setting] = await query(
      `SELECT * FROM adm_notification_settings 
       WHERE company_id = ? AND module_code = ? AND status_trigger = ? LIMIT 1`,
      [companyId, moduleCode, statusTrigger]
    );

    if (!setting) return;
    if (setting.send_email === 'N' && setting.send_sms === 'N' && setting.send_whatsapp === 'N') return;

    let doc = null;
    let subject = "";
    let text = "";
    let html = "";
    let recipientEmail = null;
    let recipientPhone = null;

    if (moduleCode === "SALES_ORDER") {
      [doc] = await query(
        `SELECT o.order_no, o.total_amount, c.customer_name, c.email, c.phone 
         FROM sal_orders o LEFT JOIN sal_customers c ON c.id = o.customer_id 
         WHERE o.id = ?`, [documentId]
      );
      if (doc) {
        recipientEmail = doc.email;
        recipientPhone = doc.phone;
        subject = `Sales Order ${doc.order_no} is now ${statusTrigger}`;
        text = `Dear ${doc.customer_name},\n\nYour Sales Order ${doc.order_no} for ${doc.total_amount} has been ${statusTrigger}.\n\nThank you!`;
        html = `<p>Dear ${doc.customer_name},</p><p>Your Sales Order <strong>${doc.order_no}</strong> for ${doc.total_amount} has been ${statusTrigger}.</p><p>Thank you!</p>`;
      }
    } else if (moduleCode === "PURCHASE_ORDER") {
      [doc] = await query(
        `SELECT o.po_no, o.total_amount, s.supplier_name, s.email, s.phone 
         FROM pur_orders o LEFT JOIN pur_suppliers s ON s.id = o.supplier_id 
         WHERE o.id = ?`, [documentId]
      );
      if (doc) {
        recipientEmail = doc.email;
        recipientPhone = doc.phone;
        subject = `Purchase Order ${doc.po_no} is now ${statusTrigger}`;
        text = `Dear ${doc.supplier_name},\n\nPurchase Order ${doc.po_no} for ${doc.total_amount} has been ${statusTrigger}.\n\nThank you!`;
        html = `<p>Dear ${doc.supplier_name},</p><p>Purchase Order <strong>${doc.po_no}</strong> for ${doc.total_amount} has been ${statusTrigger}.</p><p>Thank you!</p>`;
      }
    } else if (moduleCode === "SERVICE_ORDER") {
      [doc] = await query(
        `SELECT o.order_no, o.total_amount, s.supplier_name, s.email, s.phone 
         FROM pur_service_orders o LEFT JOIN pur_suppliers s ON s.id = o.supplier_id 
         WHERE o.id = ?`, [documentId]
      );
      if (doc) {
        recipientEmail = doc.email;
        recipientPhone = doc.phone;
        subject = `Service Order ${doc.order_no} is now ${statusTrigger}`;
        text = `Dear ${doc.supplier_name},\n\nService Order ${doc.order_no} for ${doc.total_amount} has been ${statusTrigger}.\n\nThank you!`;
        html = `<p>Dear ${doc.supplier_name},</p><p>Service Order <strong>${doc.order_no}</strong> for ${doc.total_amount} has been ${statusTrigger}.</p><p>Thank you!</p>`;
      }
    } else if (moduleCode === "MAINTENANCE_JOB") {
      [doc] = await query(
        `SELECT o.job_order_no, o.description, s.item_name AS provider_name, s.email, s.phone 
         FROM maint_job_orders o LEFT JOIN maint_setup_items s ON (s.id = o.assigned_to_id AND s.item_type = 'SERVICE_PROVIDER') 
         WHERE o.id = ?`, [documentId]
      );
      if (doc) {
        recipientEmail = doc.email;
        recipientPhone = doc.phone;
        subject = `Job Order ${doc.job_order_no} is now ${statusTrigger}`;
        text = `Dear ${doc.provider_name || 'Service Provider'},\n\nJob Order ${doc.job_order_no} (${doc.description}) has been ${statusTrigger}.\n\nThank you!`;
        html = `<p>Dear ${doc.provider_name || 'Service Provider'},</p><p>Job Order <strong>${doc.job_order_no}</strong> (${doc.description}) has been ${statusTrigger}.</p><p>Thank you!</p>`;
      }
    }

    if (!doc) return;

    const parseTemplate = (tmpl, fallbackText) => {
      if (!tmpl) return fallbackText;
      return tmpl
        .replace(/{customer_name}/g, doc.customer_name || doc.supplier_name || doc.provider_name || "")
        .replace(/{document_type}/g, moduleCode.replace(/_/g, " "))
        .replace(/{document_no}/g, doc.order_no || doc.po_no || doc.job_order_no || "")
        .replace(/{amount}/g, doc.total_amount || "")
        .replace(/{status}/g, statusTrigger);
    };

    const moduleTemplate = process.env[`TEMPLATE_${moduleCode}`];
    const customText = parseTemplate(moduleTemplate, text);

    // 1. Send to Document's Customer/Supplier
    if (setting.send_email === 'Y' && recipientEmail) {
      await sendExternalNotification({ type: 'email', recipientEmail, subject, text, html }).catch(()=>null);
    }
    if (setting.send_sms === 'Y' && recipientPhone) {
      await sendExternalNotification({ type: 'sms', recipientPhone, text: customText }).catch(()=>null);
    }
    if (setting.send_whatsapp === 'Y' && recipientPhone) {
      await sendExternalNotification({ type: 'whatsapp', recipientPhone, text: customText }).catch(()=>null);
    }

    // 2. Send to Configured Recipients in adm_notification_settings
    if (setting.recipients && setting.recipients.trim() !== '') {
      const recipientIds = setting.recipients.split(',').map(id => id.trim()).filter(Boolean);
      if (recipientIds.length > 0) {
        let extraRecipients = [];
        if (moduleCode === "SALES_ORDER") {
          [extraRecipients] = await query(`SELECT email, phone FROM sal_customers WHERE id IN (?)`, [recipientIds]);
        } else if (["PURCHASE_ORDER", "SERVICE_ORDER", "MAINTENANCE_JOB", "PAYMENT_VOUCHER"].includes(moduleCode)) {
          [extraRecipients] = await query(`SELECT email, phone FROM pur_suppliers WHERE id IN (?)`, [recipientIds]);
        }
        
        for (const ext of extraRecipients) {
          if (setting.send_email === 'Y' && ext.email && ext.email !== recipientEmail) {
            await sendExternalNotification({ type: 'email', recipientEmail: ext.email, subject, text, html }).catch(()=>null);
          }
          if (ext.phone && ext.phone !== recipientPhone) {
            if (setting.send_sms === 'Y') {
              await sendExternalNotification({ type: 'sms', recipientPhone: ext.phone, text: customText }).catch(()=>null);
            }
            if (setting.send_whatsapp === 'Y') {
              await sendExternalNotification({ type: 'whatsapp', recipientPhone: ext.phone, text: customText }).catch(()=>null);
            }
          }
        }
      }
    }

  } catch (err) {
    console.error("Failed to process automatic external notification:", err);
  }
};
