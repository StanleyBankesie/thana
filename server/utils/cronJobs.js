import cron from "node-cron";
import { runBackup } from "../scripts/backup.js";
import { runComplianceNotifications } from "../scripts/complianceNotification.js";
import { runServicingNotifications } from "../scripts/servicingNotification.js";
import { query } from "../db/pool.js";

/**
 * Automatically closes unclosed POS days/shifts at midnight or for prior dates.
 * Computes actual sales and sets closing cash & MoMo to allow smooth morning re-opening.
 */
export async function autoCloseMidnightPosDays() {
  try {
    const openRows = await query(
      `
      SELECT
        id,
        company_id,
        branch_id,
        terminal_code,
        business_date,
        open_datetime,
        opening_float,
        momo_opening_main,
        momo_opening_pay,
        created_by
      FROM pos_day_status
      WHERE status = 'OPEN'
        AND (
          DATE(open_datetime) < CURRENT_DATE()
          OR TIMESTAMPDIFF(HOUR, open_datetime, NOW()) >= 16
        )
      `,
    );

    if (!openRows || !openRows.length) {
      return { closedCount: 0 };
    }

    console.log(`[POS Auto-Close] Found ${openRows.length} unclosed shift(s) from previous day(s). Auto-closing...`);

    let closedCount = 0;
    for (const shift of openRows) {
      try {
        const openTime = new Date(shift.open_datetime);
        const closeDate = new Date(openTime);
        closeDate.setHours(23, 59, 59, 999);
        const finalCloseDatetime = closeDate > new Date() ? new Date() : closeDate;

        // Query sales during this shift window
        const salesRows = await query(
          `
          SELECT
            SUM(CASE WHEN COALESCE(s.payment_method, '') = 'CASH' THEN s.net_amount ELSE 0 END) AS cash_sales,
            SUM(CASE WHEN COALESCE(s.payment_method, '') IN ('MOBILE', 'MOMO') THEN s.net_amount ELSE 0 END) AS momo_sales,
            SUM(s.net_amount) AS total_sales
          FROM pos_sales s
          LEFT JOIN pos_terminals t ON t.id = s.terminal_id AND t.company_id = s.company_id AND t.branch_id = s.branch_id
          WHERE s.company_id = :companyId
            AND s.branch_id = :branchId
            AND t.code = :terminalCode
            AND s.sale_datetime >= :openDatetime
            AND s.sale_datetime <= :closeDatetime
            AND s.status = 'COMPLETED'
          `,
          {
            companyId: shift.company_id,
            branchId: shift.branch_id,
            terminalCode: shift.terminal_code,
            openDatetime: openTime,
            closeDatetime: finalCloseDatetime,
          },
        );

        const sales = salesRows?.[0] || {};
        const cashSales = Number(sales.cash_sales || 0);
        const momoSales = Number(sales.momo_sales || 0);
        const totalSales = Number(sales.total_sales || 0);

        const openFloat = Number(shift.opening_float || 0);
        const expectedCash = openFloat + cashSales;

        const momoOpenMain = Number(shift.momo_opening_main || 0);
        const momoOpenPay = Number(shift.momo_opening_pay || 0);
        const momoOpeningTotal = momoOpenMain + momoOpenPay;

        const momoClosingMain = momoOpenMain + momoSales;
        const momoClosingPay = momoOpenPay;
        const expectedMoMo = momoClosingMain + momoClosingPay;

        // Update pos_day_status
        await query(
          `
          UPDATE pos_day_status
          SET close_datetime = :closeDatetime,
              actual_cash = :actualCash,
              actual_momo = :actualMoMo,
              momo_opening_balance = :momoOpeningBalance,
              momo_closing_balance = :momoClosingBalance,
              momo_closing_main = :momoClosingMain,
              momo_closing_pay = :momoClosingPay,
              next_opening_float = :nextOpeningFloat,
              close_notes = 'Auto-closed at midnight by system',
              closed_by = :closedBy,
              status = 'CLOSED',
              updated_at = NOW()
          WHERE id = :id
          `,
          {
            id: shift.id,
            closeDatetime: finalCloseDatetime,
            actualCash: expectedCash,
            actualMoMo: expectedMoMo,
            momoOpeningBalance: momoOpeningTotal,
            momoClosingBalance: expectedMoMo,
            momoClosingMain,
            momoClosingPay,
            nextOpeningFloat: expectedCash,
            closedBy: shift.created_by,
          },
        );

        // Update pos_sessions
        await query(
          `
          UPDATE pos_sessions
          SET end_time = :closeDatetime,
              total_sales = :totalSales,
              status = 'CLOSED',
              closed_by = :closedBy,
              updated_at = NOW()
          WHERE (day_status_id = :id OR (terminal_code = :terminalCode AND status = 'OPEN'))
            AND company_id = :companyId
          `,
          {
            id: shift.id,
            terminalCode: shift.terminal_code,
            companyId: shift.company_id,
            closeDatetime: finalCloseDatetime,
            totalSales,
            closedBy: shift.created_by,
          },
        ).catch(() => {});

        closedCount++;
      } catch (shiftErr) {
        console.error(`[POS Auto-Close] Error auto-closing shift #${shift.id}:`, shiftErr);
      }
    }

    if (closedCount > 0) {
      console.log(`[POS Auto-Close] Successfully auto-closed ${closedCount} shift(s).`);
    }
    return { closedCount };
  } catch (err) {
    console.error("[POS Auto-Close] Error running autoCloseMidnightPosDays:", err);
    return { closedCount: 0, error: err.message };
  }
}

/**
 * Initializes all cron jobs for the application.
 * This should be imported once at application startup.
 */
export function initCronJobs() {
  console.log("[Cron] Initializing automated scheduled tasks...");

  // Run auto-close on startup to catch any leftover unclosed shifts from previous days
  autoCloseMidnightPosDays().catch(() => {});

  // Schedule automatic POS Day Closing at 12:00 AM midnight (0 0 * * *)
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Triggering midnight POS auto-close for unclosed days...");
    try {
      await autoCloseMidnightPosDays();
    } catch (err) {
      console.error("[Cron] Midnight POS auto-close failed:", err);
    }
  });
  console.log("[Cron] Scheduled midnight POS Day Auto-Close for 12:00 AM (0 0 * * *)");

  // Also run every hour at minute 0 to catch any shifts crossing the 16-hour or date boundary
  cron.schedule("0 * * * *", async () => {
    try {
      await autoCloseMidnightPosDays();
    } catch (err) {
      console.error("[Cron] Hourly POS auto-close check failed:", err);
    }
  });

  // Schedule the automatic cloud backup at 12:00 AM every day
  cron.schedule("0 0 * * *", async () => {
    console.log("[Cron] Triggering scheduled daily cloud backup...");
    try {
      // isManual = false, localOnly = false, cloudOnly = true
      await runBackup(false, false, true);
    } catch (err) {
      console.error("[Cron] Daily cloud backup failed:", err);
    }
  });
  
  console.log("[Cron] Scheduled daily cloud backup for 12:00 AM (0 0 * * *)");

  // Schedule compliance notifications daily at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    try {
      await runComplianceNotifications();
    } catch (err) {
      console.error("[Cron] Compliance notifications failed:", err);
    }
  });
  console.log("[Cron] Scheduled compliance notifications for 10:00 AM (0 10 * * *)");

  // Schedule servicing notifications daily at 10:00 AM
  cron.schedule("0 10 * * *", async () => {
    try {
      await runServicingNotifications();
    } catch (err) {
      console.error("[Cron] Servicing notifications failed:", err);
    }
  });
  console.log("[Cron] Scheduled servicing notifications for 10:00 AM (0 10 * * *)");
}

