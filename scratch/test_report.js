import { query, pool } from "../server/db/pool.js";

async function test() {
  try {
    const companyId = 1;
    const conditions = ["j.company_id = ?"];
    const params = [companyId];
    const whereClause = conditions.join(" AND ");

    const costRecords = await query(`
      SELECT 
        j.id,
        j.order_no AS job_order_no,
        COALESCE(j.instructions, 'Maintenance Job') AS subject,
        j.service_line,
        j.status,
        j.actual_hours,
        COALESCE(sr.total_material_cost, 0) AS material_cost,
        COALESCE(sr.total_material_cost + (COALESCE(j.actual_hours, 1) * 25.00), COALESCE(j.actual_hours, 1) * 25.00) AS total_cost,
        p.property_name,
        c.customer_name AS client_name,
        j.created_at
      FROM maint_job_orders j
      LEFT JOIN fm_properties p ON p.id = j.property_id
      LEFT JOIN sal_customers c ON c.id = j.client_id
      LEFT JOIN fm_service_reports sr ON sr.work_order_id = j.id
      WHERE ${whereClause}
      ORDER BY j.created_at DESC
      LIMIT 100
    `, params);
    console.log("costRecords SUCCESS, length:", costRecords.length);
    console.log("sample record:", costRecords[0]);
  } catch (err) {
    console.error("ERROR CAUGHT:", err);
  } finally {
    process.exit();
  }
}

test();
