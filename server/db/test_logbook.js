import { query } from "./pool.js";

async function test() {
  try {
    const companyId = 1;
    await query(`
      UPDATE trans_driver_logbook
      SET trip_status = CASE
        WHEN trip_status = 'Planned' AND departure_time IS NOT NULL AND departure_time <= NOW() THEN 'In Progress'
        ELSE trip_status
      END
      WHERE company_id = :companyId AND trip_status IN ('Planned')
    `, { companyId });
    
    const items = await query(`
      SELECT l.*, 
             v.reg_number as registration_number, v.make, v.model,
             d.employee_name as driver_name
      FROM trans_driver_logbook l
      LEFT JOIN trans_vehicles v ON l.vehicle_id = v.id
      LEFT JOIN trans_drivers d ON l.driver_id = d.id
      WHERE l.company_id = :companyId
      ORDER BY l.id DESC
    `, { companyId });
    console.log("Success:", items.length);
  } catch (err) {
    console.error("SQL Error:", err.message);
  }
  process.exit(0);
}
test();
