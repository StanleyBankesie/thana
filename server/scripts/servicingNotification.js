import pool from "../db/pool.js";
import { sendExternalNotification } from "../utils/externalNotification.js";

export async function runServicingNotifications() {
  console.log("[Cron] Running servicing notifications check...");
  try {
    // 1. Update statuses first to ensure we notify on up-to-date data
    await pool.query(`
      UPDATE trans_vehicle_servicing s
      JOIN trans_vehicles v ON s.vehicle_id = v.id
      SET s.service_status = CASE 
        WHEN s.next_service_date < CURDATE() OR (s.next_service_mileage > 0 AND v.current_odometer >= s.next_service_mileage) THEN 'Overdue'
        WHEN s.next_service_date IS NOT NULL AND DATEDIFF(s.next_service_date, CURDATE()) <= COALESCE(s.reminder_days, 30) THEN 'Due'
        ELSE 'Upcoming'
      END
      WHERE s.next_service_date IS NOT NULL
    `);

    // 2. Fetch those needing notification
    const [services] = await pool.query(`
      SELECT s.*, v.reg_number as registration_number
      FROM trans_vehicle_servicing s
      LEFT JOIN trans_vehicles v ON s.vehicle_id = v.id
      WHERE s.service_status IN ('Due', 'Overdue')
      AND (s.last_notified IS NULL OR DATEDIFF(CURDATE(), DATE(s.last_notified)) >= 2)
    `);

    if (!services || services.length === 0) {
      console.log("[Cron] No vehicle servicing require notifications at this time.");
      return;
    }

    console.log(`[Cron] Found ${services.length} servicing records to notify.`);

    for (const s of services) {
      const trigger = s.service_status === 'Overdue' ? 'OVERDUE' : 'DUE';
      
      const [settings] = await pool.query(`
        SELECT * FROM adm_notification_settings
        WHERE module_code = 'VEHICLE_SERVICING' AND status_trigger = ? AND company_id = ?
      `, [trigger, s.company_id]);

      if (!settings || settings.length === 0) continue;
      const config = settings[0];
      if (config.send_email !== 'Y' && config.send_sms !== 'Y' && config.send_whatsapp !== 'Y') continue;
      if (!config.recipients || config.recipients.trim() === '') continue;

      const [templateRow] = await pool.query(`
        SELECT setting_value FROM adm_system_settings WHERE setting_key = 'servicing_notification_template' AND company_id = ?
      `, [s.company_id]);

      let template = templateRow && templateRow.length > 0 && templateRow[0].setting_value
        ? templateRow[0].setting_value
        : "The {{service_type}} for {{vehicle_reg}} is {{status}}. Please schedule a service.";

      template = template
        .replace(/{{vehicle_reg}}/g, s.registration_number || '')
        .replace(/{{service_type}}/g, s.service_type || '')
        .replace(/{{status}}/g, s.service_status || '')
        .replace(/{{next_date}}/g, s.next_service_date ? new Date(s.next_service_date).toLocaleDateString() : '');

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
          subject: `Vehicle Servicing Alert: ${s.registration_number}`,
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

      await pool.query(`UPDATE trans_vehicle_servicing SET last_notified = NOW() WHERE id = ?`, [s.id]);
    }
    
    console.log("[Cron] Servicing notifications check completed.");
  } catch (err) {
    console.error("[Cron] Error running servicing notifications:", err);
  }
}
