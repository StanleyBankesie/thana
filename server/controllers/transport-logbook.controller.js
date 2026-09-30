import { query } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";

async function generateLogbookNo(companyId) {
  const rows = await query(
    `SELECT logbook_no FROM trans_driver_logbook 
     WHERE company_id = :companyId AND logbook_no REGEXP '^LOG-[0-9]{6}$'
     ORDER BY logbook_no DESC LIMIT 1`,
    { companyId }
  );
  
  const prefix = 'LOG-';
  
  if (rows && rows.length > 0) {
    const lastNo = rows[0].logbook_no;
    const seq = parseInt(lastNo.replace(prefix, ''), 10);
    if (!isNaN(seq)) {
      return `${prefix}${String(seq + 1).padStart(6, "0")}`;
    }
  }
  
  return `${prefix}000001`;
}

export const listLogbooks = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    
    // Auto-update status for "Planned" -> "In Progress" if departure time passed, and "In Progress" to "Overdue" maybe? 
    // Wait, let's keep status update simple: if Planned and departure_time < now -> In Progress
    // We'll leave Overdue calculation for UI or simple queries, since it's not a strict DB status in our enum unless we want it.
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
             d.employee_name as driver_name,
             u.full_name as created_by_name
      FROM trans_driver_logbook l
      LEFT JOIN trans_vehicles v ON l.vehicle_id = v.id
      LEFT JOIN trans_drivers d ON l.driver_id = d.id
      LEFT JOIN adm_users u ON l.created_by = u.id
      WHERE l.company_id = :companyId
      ORDER BY l.id DESC
    `, { companyId });
    
    let rows = Array.isArray(items) ? (Array.isArray(items[0]) ? items[0] : items) : [];
    if (!Array.isArray(rows) && rows && typeof rows === 'object') {
       if (Array.isArray(rows.items)) rows = rows.items;
       else rows = [rows];
    }
    
    res.json({ items: rows });
  } catch (error) {
    next(error);
  }
};

export const getLogbookById = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    const rows = await query(`
      SELECT l.*, 
             v.reg_number as registration_number, v.make, v.model, v.current_odometer,
             d.employee_name as driver_name
      FROM trans_driver_logbook l
      LEFT JOIN trans_vehicles v ON l.vehicle_id = v.id
      LEFT JOIN trans_drivers d ON l.driver_id = d.id
      WHERE l.id = :id AND l.company_id = :companyId
    `, { id, companyId });
    
    const results = Array.isArray(rows) && Array.isArray(rows[0]) ? rows[0] : rows;
    
    if (!results || results.length === 0) {
      throw httpError(404, "Logbook record not found");
    }
    
    res.json({ item: results[0] });
  } catch (error) {
    next(error);
  }
};

export const createLogbook = async (req, res, next) => {
  try {
    const { companyId, branchId, userId } = req.scope;
    const data = req.body;
    
    if (!data.vehicle_id) throw httpError(400, "Vehicle is required");
    if (!data.driver_id) throw httpError(400, "Driver is required");
    
    const logbook_no = await generateLogbookNo(companyId);
    
    const beginning_mileage = Number(data.beginning_mileage) || 0;
    const ending_mileage = Number(data.ending_mileage) || 0;
    const distance_travelled = ending_mileage >= beginning_mileage ? ending_mileage - beginning_mileage : 0;

    let trip_status = data.trip_status || 'Planned';
    if (trip_status === 'Planned' && data.departure_time && new Date(data.departure_time) <= new Date()) {
      trip_status = 'In Progress';
    }

    if (data.origin && data.destination) {
      try {
        const route_name = data.planned_route || `${data.origin} -> ${data.destination}`;
        const [existingRoute] = await query(
          `SELECT id FROM trans_routes WHERE origin = :origin AND destination = :destination AND company_id = :companyId`,
          { origin: data.origin, destination: data.destination, companyId }
        );
        if (!existingRoute) {
          await query(
            `INSERT INTO trans_routes (company_id, branch_id, route_code, route_name, origin, destination, created_by)
             VALUES (:companyId, :branchId, :route_code, :route_name, :origin, :destination, :userId)`,
            {
              companyId,
              branchId: branchId || 0,
              route_code: `RT-${Date.now().toString().slice(-6)}`,
              route_name,
              origin: data.origin,
              destination: data.destination,
              userId
            }
          );
        }
      } catch (err) {
        console.error("Failed to save route:", err);
      }
    }

    const result = await query(`
      INSERT INTO trans_driver_logbook (
        company_id, branch_id, vehicle_id, driver_id, logbook_no, trip_date, 
        department, purpose, origin, destination, planned_route, 
        departure_time, expected_return_time, actual_return_time, trip_status, 
        beginning_mileage, ending_mileage, distance_travelled, 
        fuel_level_departure, fuel_level_return, fuel_issued, fuel_cost, fuel_station, 
        num_passengers, passenger_names, driver_remarks, incident_report, 
        traffic_offence, breakdown_details, requested_by, approved_by, approval_status,
        fuel_receipt_url, toll_receipts_url, support_doc_url, created_by
      ) VALUES (
        :companyId, :branchId, :vehicle_id, :driver_id, :logbook_no, :trip_date, 
        :department, :purpose, :origin, :destination, :planned_route, 
        :departure_time, :expected_return_time, :actual_return_time, :trip_status, 
        :beginning_mileage, :ending_mileage, :distance_travelled, 
        :fuel_level_departure, :fuel_level_return, :fuel_issued, :fuel_cost, :fuel_station, 
        :num_passengers, :passenger_names, :driver_remarks, :incident_report, 
        :traffic_offence, :breakdown_details, :requested_by, :approved_by, :approval_status,
        :fuel_receipt_url, :toll_receipts_url, :support_doc_url, :userId
      )
    `, {
      companyId,
      branchId,
      userId,
      logbook_no,
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      trip_date: data.trip_date || null,
      department: data.department || null,
      purpose: data.purpose || null,
      origin: data.origin || null,
      destination: data.destination || null,
      planned_route: data.planned_route || null,
      departure_time: data.departure_time || null,
      expected_return_time: data.expected_return_time || null,
      actual_return_time: data.actual_return_time || null,
      trip_status,
      beginning_mileage,
      ending_mileage,
      distance_travelled,
      fuel_level_departure: data.fuel_level_departure || null,
      fuel_level_return: data.fuel_level_return || null,
      fuel_issued: data.fuel_issued || 0,
      fuel_cost: data.fuel_cost || 0,
      fuel_station: data.fuel_station || null,
      num_passengers: data.num_passengers || 0,
      passenger_names: data.passenger_names || null,
      driver_remarks: data.driver_remarks || null,
      incident_report: data.incident_report || null,
      traffic_offence: data.traffic_offence || null,
      breakdown_details: data.breakdown_details || null,
      requested_by: data.requested_by || null,
      approved_by: data.approved_by || null,
      approval_status: data.approval_status || 'Pending',
      fuel_receipt_url: data.fuel_receipt_url || null,
      toll_receipts_url: data.toll_receipts_url || null,
      support_doc_url: data.support_doc_url || null
    });
    
    const insertId = Array.isArray(result) ? result[0]?.insertId : result?.insertId;
    res.status(201).json({ success: true, id: insertId });
  } catch (error) {
    next(error);
  }
};

export const updateLogbook = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const data = req.body;
    
    const beginning_mileage = Number(data.beginning_mileage) || 0;
    const ending_mileage = Number(data.ending_mileage) || 0;
    const distance_travelled = ending_mileage >= beginning_mileage ? ending_mileage - beginning_mileage : 0;

    let trip_status = data.trip_status || 'Planned';
    if (trip_status === 'Planned' && data.departure_time && new Date(data.departure_time) <= new Date()) {
      trip_status = 'In Progress';
    }

    if (data.origin && data.destination) {
      try {
        const route_name = data.planned_route || `${data.origin} -> ${data.destination}`;
        const [existingRoute] = await query(
          `SELECT id FROM trans_routes WHERE origin = :origin AND destination = :destination AND company_id = :companyId`,
          { origin: data.origin, destination: data.destination, companyId }
        );
        if (!existingRoute) {
          await query(
            `INSERT INTO trans_routes (company_id, branch_id, route_code, route_name, origin, destination, created_by)
             VALUES (:companyId, :branchId, :route_code, :route_name, :origin, :destination, :userId)`,
            {
              companyId,
              branchId: branchId || 0,
              route_code: `RT-${Date.now().toString().slice(-6)}`,
              route_name,
              origin: data.origin,
              destination: data.destination,
              userId
            }
          );
        }
      } catch (err) {
        console.error("Failed to save route:", err);
      }
    }

    await query(`
      UPDATE trans_driver_logbook SET
        vehicle_id = :vehicle_id,
        driver_id = :driver_id,
        trip_date = :trip_date,
        department = :department,
        purpose = :purpose,
        origin = :origin,
        destination = :destination,
        planned_route = :planned_route,
        departure_time = :departure_time,
        expected_return_time = :expected_return_time,
        actual_return_time = :actual_return_time,
        trip_status = :trip_status,
        beginning_mileage = :beginning_mileage,
        ending_mileage = :ending_mileage,
        distance_travelled = :distance_travelled,
        fuel_level_departure = :fuel_level_departure,
        fuel_level_return = :fuel_level_return,
        fuel_issued = :fuel_issued,
        fuel_cost = :fuel_cost,
        fuel_station = :fuel_station,
        num_passengers = :num_passengers,
        passenger_names = :passenger_names,
        driver_remarks = :driver_remarks,
        incident_report = :incident_report,
        traffic_offence = :traffic_offence,
        breakdown_details = :breakdown_details,
        requested_by = :requested_by,
        approved_by = :approved_by,
        approval_status = :approval_status,
        fuel_receipt_url = :fuel_receipt_url,
        toll_receipts_url = :toll_receipts_url,
        support_doc_url = :support_doc_url
      WHERE id = :id AND company_id = :companyId
    `, {
      id,
      companyId,
      vehicle_id: data.vehicle_id,
      driver_id: data.driver_id,
      trip_date: data.trip_date || null,
      department: data.department || null,
      purpose: data.purpose || null,
      origin: data.origin || null,
      destination: data.destination || null,
      planned_route: data.planned_route || null,
      departure_time: data.departure_time || null,
      expected_return_time: data.expected_return_time || null,
      actual_return_time: data.actual_return_time || null,
      trip_status,
      beginning_mileage,
      ending_mileage,
      distance_travelled,
      fuel_level_departure: data.fuel_level_departure || null,
      fuel_level_return: data.fuel_level_return || null,
      fuel_issued: data.fuel_issued || 0,
      fuel_cost: data.fuel_cost || 0,
      fuel_station: data.fuel_station || null,
      num_passengers: data.num_passengers || 0,
      passenger_names: data.passenger_names || null,
      driver_remarks: data.driver_remarks || null,
      incident_report: data.incident_report || null,
      traffic_offence: data.traffic_offence || null,
      breakdown_details: data.breakdown_details || null,
      requested_by: data.requested_by || null,
      approved_by: data.approved_by || null,
      approval_status: data.approval_status || 'Pending',
      fuel_receipt_url: data.fuel_receipt_url || null,
      toll_receipts_url: data.toll_receipts_url || null,
      support_doc_url: data.support_doc_url || null
    });
    
    // Also, if completed, update vehicle's current_odometer if distance was travelled
    if (trip_status === 'Completed' && ending_mileage > 0) {
      await query(`
        UPDATE trans_vehicles 
        SET current_odometer = GREATEST(current_odometer, :ending_mileage) 
        WHERE id = :vehicle_id AND company_id = :companyId
      `, {
        vehicle_id: data.vehicle_id,
        ending_mileage,
        companyId
      });
    }

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const deleteLogbook = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    
    await query(`
      DELETE FROM trans_driver_logbook 
      WHERE id = :id AND company_id = :companyId
    `, { id, companyId });
    
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
