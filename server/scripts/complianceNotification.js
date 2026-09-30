import pool from "../db/pool.js";
import { sendExternalNotification } from "../utils/externalNotification.js";

export async function runComplianceNotifications() {
  console.log("[Cron] Running compliance notifications check...");
  try {
    // 1. Update statuses first to ensure we notify on up-to-date data
    await pool.query(`
      UPDATE trans_vehicle_compliance
      SET status = CASE 
        WHEN expiry_date < CURDATE() THEN 'Expired'
        WHEN DATEDIFF(expiry_date, CURDATE()) <= COALESCE(reminder_days, 30) THEN 'Expiring Soon'
        ELSE 'Valid'
      END
      WHERE expiry_date IS NOT NULL
    `);

    // 2. Fetch those needing notification
    const [compliances] = await pool.query(`
      SELECT c.* 
      FROM trans_vehicle_compliance c
      WHERE c.status IN ('Expiring Soon', 'Expired')
      AND (c.last_notified IS NULL OR DATEDIFF(CURDATE(), DATE(c.last_notified)) >= 2)
    `);

    if (!compliances || compliances.length === 0) {
      console.log("[Cron] No compliance documents require notifications at this time.");
      return;
    }

    console.log(`[Cron] Found ${compliances.length} compliance documents to notify.`);

    for (const c of compliances) {
      const trigger = c.status === 'Expired' ? 'EXPIRED' : 'EXPIRING_SOON';
      
      const [settings] = await pool.query(`
        SELECT * FROM adm_notification_settings
        WHERE module_code = 'VEHICLE_COMPLIANCE' AND status_trigger = ? AND company_id = ?
      `, [trigger, c.company_id]);

      if (!settings || settings.length === 0) continue;
      const config = settings[0];
      if (config.send_email !== 'Y' && config.send_sms !== 'Y' && config.send_whatsapp !== 'Y') continue;
      if (!config.recipients || config.recipients.trim() === '') continue;

      const [templateRow] = await pool.query(`
        SELECT setting_value FROM adm_system_settings WHERE setting_key = 'compliance_notification_template' AND company_id = ?
      `, [c.company_id]);

      let template = templateRow && templateRow.length > 0 && templateRow[0].setting_value
        ? templateRow[0].setting_value
        : "Your {{compliance_type}} for {{vehicle_reg}} is {{status}}. Please renew as soon as possible.";

      template = template
        .replace(/{{vehicle_reg}}/g, c.registration_number || '')
        .replace(/{{compliance_type}}/g, c.compliance_type || '')
        .replace(/{{status}}/g, c.status || '')
        .replace(/{{expiry_date}}/g, c.expiry_date ? new Date(c.expiry_date).toLocaleDateString() : '');

      const userIds = config.recipients.split(',').map(r => r.trim()).filter(Boolean);
      if (userIds.length === 0) continue;

      const [users] = await pool.query(`
        SELECT email, telephone FROM adm_users 
        WHERE id IN (?) AND is_active = 1
      `, [userIds]);

      if (!users || users.length === 0) continue;
      
      for (const user of users) {
        // Build payload
        const payload = {
          type: 'all',
          subject: `Vehicle Compliance Alert: ${c.registration_number}`,
          text: template,
          html: `<p>${template}</p>`
        };
        
        if (user.email && config.send_email === 'Y') {
          await sendExternalNotification({ ...payload, type: 'email', recipientEmail: user.email });
        }
        
        if (user.telephone) {
          if (config.send_sms === 'Y') {
            await sendExternalNotification({ ...payload, type: 'sms', recipientPhone: user.telephone });
          }
          if (config.send_whatsapp === 'Y') {
            await sendExternalNotification({ ...payload, type: 'whatsapp', recipientPhone: user.telephone });
          }
        }
        
        // Add a 2 second delay between each user notification to avoid SMTP/API rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      await pool.query(`UPDATE trans_vehicle_compliance SET last_notified = NOW() WHERE id = ?`, [c.id]);
    }
    
    console.log("[Cron] Compliance notifications check completed.");
  } catch (err) {
    console.error("[Cron] Error running compliance notifications:", err);
  }
}
