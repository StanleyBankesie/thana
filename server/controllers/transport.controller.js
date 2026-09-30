/**
 * @file transport.controller.js
 * @description Controller for the Transport Module, managing vehicles, drivers, trips, fuel, expenses, and billing.
 */
import { query, pool } from "../db/pool.js";
import { httpError } from "../utils/httpError.js";
import { createPostedSalesVoucherForInvoiceTx } from "../routes/sales.route.js";
import { toNumber } from "../utils/dbUtils.js";
import { resolveWorkflowSelection, getInactiveWorkflowBehavior } from "../utils/workflowResolution.js";
import { getIO } from "../utils/socket.js";
import { sendDocumentForwardNotification } from "../utils/documentNotification.js";

// === DASHBOARD STATS ===
export const getTransportDashboardStats = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    
    const [vehicles] = await query(
      "SELECT COUNT(*) as total FROM trans_vehicles WHERE company_id = :companyId AND is_active = 1",
      { companyId }
    );
    const [drivers] = await query(
      "SELECT COUNT(*) as total FROM trans_drivers WHERE company_id = :companyId AND is_active = 1",
      { companyId }
    );
    const [activeTrips] = await query(
      "SELECT COUNT(*) as total FROM trans_trips WHERE company_id = :companyId AND status IN ('SCHEDULED', 'IN_TRANSIT')",
      { companyId }
    );
    const [fuelCost] = await query(
      "SELECT COALESCE(SUM(total_cost), 0) as total FROM trans_fuel_logs WHERE company_id = :companyId",
      { companyId }
    );

    res.json({
      success: true,
      data: {
        totalVehicles: vehicles?.total || 0,
        totalDrivers: drivers?.total || 0,
        activeTrips: activeTrips?.total || 0,
        totalFuelCost: fuelCost?.total || 0
      }
    });
  } catch (err) {
    next(err);
  }
};

// === VEHICLES ===
export const listVehicles = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      "SELECT * FROM trans_vehicles WHERE company_id = :companyId ORDER BY id DESC",
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("listVehicles Error:", err);
    next(err);
  }
};

export const createVehicle = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { reg_number, vehicle_type, make, model, year_of_manufacture, capacity, capacity_unit, current_odometer, insurance_expiry } = req.body;
    
    if (!reg_number || !vehicle_type) {
      throw httpError(400, "VALIDATION_ERROR", "Registration number and type are required");
    }

    const result = await query(
      `INSERT INTO trans_vehicles (company_id, branch_id, reg_number, vehicle_type, make, model, year_of_manufacture, capacity, capacity_unit, current_odometer, insurance_expiry, created_by) 
       VALUES (:companyId, :branchId, :reg_number, :vehicle_type, :make, :model, :year_of_manufacture, :capacity, :capacity_unit, :current_odometer, :insurance_expiry, :userId)`,
      {
        companyId, branchId, reg_number, vehicle_type, make, model, capacity, capacity_unit,
        year_of_manufacture: year_of_manufacture || null,
        insurance_expiry: insurance_expiry || null,
        current_odometer: current_odometer || 0,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error("createVehicle Error:", err);
    next(err);
  }
};

// === DRIVERS ===
export const listDrivers = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT d.*, IFNULL(d.employee_name, CONCAT(e.first_name, ' ', e.last_name)) as employee_name, e.emp_code as employee_code 
      FROM trans_drivers d
      LEFT JOIN hr_employees e ON d.employee_id = e.id
      WHERE d.company_id = :companyId ORDER BY d.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("listDrivers Error:", err);
    next(err);
  }
};

export const createDriver = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { employee_name, license_number, license_type, license_expiry, user_id } = req.body;
    
    if (!employee_name || !license_number) {
      throw httpError(400, "VALIDATION_ERROR", "Employee Name and License number are required");
    }

    const result = await query(
      `INSERT INTO trans_drivers (company_id, branch_id, employee_name, user_id, license_number, license_type, license_expiry, created_by) 
       VALUES (:companyId, :branchId, :employee_name, :user_id, :license_number, :license_type, :license_expiry, :userId)`,
      {
        companyId, branchId, employee_name, user_id: user_id || null, license_number, license_type, license_expiry,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    console.error("createDriver Error:", err);
    next(err);
  }
};

export const getDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const [driver] = await query("SELECT * FROM trans_drivers WHERE id = :id AND company_id = :companyId", { id, companyId });
    if (!driver) throw httpError(404, "NOT_FOUND", "Driver not found");
    res.json({ success: true, data: { driver } });
  } catch (err) {
    next(err);
  }
};

export const updateDriver = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const { employee_name, license_number, license_type, license_expiry, user_id } = req.body;
    
    await query(
      `UPDATE trans_drivers 
       SET employee_name = :employee_name, user_id = :user_id, license_number = :license_number, license_type = :license_type, license_expiry = :license_expiry
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, employee_name, user_id: user_id || null, license_number, license_type, license_expiry }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const toggleDriverStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    await query(
      "UPDATE trans_drivers SET is_active = NOT is_active WHERE id = :id AND company_id = :companyId",
      { id, companyId }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === REQUESTS ===
export const listRequests = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT r.*, c.customer_name 
      FROM trans_requests r 
      LEFT JOIN sal_customers c ON r.customer_id = c.id 
      WHERE r.company_id = :companyId 
      ORDER BY r.id DESC
    `, { companyId });
    res.json({ success: true, data: { items } });
  } catch (err) {
    console.error("listRequests Error:", err);
    next(err);
  }
};

export const createRequest = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { customer_id, vehicle_id, requester_name, request_date, required_date, return_date, required_time, return_time, no_of_days, no_of_hours, origin, destination, purpose_of_journey, priority, notes } = req.body;
    const lastReqResult = await query("SELECT id FROM trans_requests ORDER BY id DESC LIMIT 1");
    const nextId = (lastReqResult && lastReqResult.length > 0) ? Number(lastReqResult[0].id) + 1 : 1;
    const request_number = "REQ-" + String(nextId).padStart(6, '0');
    const result = await query(
      `INSERT INTO trans_requests (company_id, branch_id, request_number, customer_id, vehicle_id, requester_name, request_date, required_date, return_date, required_time, return_time, no_of_days, no_of_hours, origin, destination, purpose_of_journey, priority, notes, created_by, status) 
       VALUES (:companyId, :branchId, :request_number, :customer_id, :vehicle_id, :requester_name, :request_date, :required_date, :return_date, :required_time, :return_time, :no_of_days, :no_of_hours, :origin, :destination, :purpose_of_journey, :priority, :notes, :userId, 'PENDING')`,
      {
        companyId, branchId, request_number, customer_id, request_date, required_date, origin, destination, 
        purpose_of_journey, requester_name, return_date, required_time, return_time, no_of_days, no_of_hours,
        priority: priority || 'NORMAL',
        notes: notes || null,
        vehicle_id: vehicle_id || null,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, data: { id: result.insertId, request_number } });
  } catch (err) {
    next(err);
  }
};

export const updateRequestStatus = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { status } = req.body;
    await query(
      "UPDATE trans_requests SET status = :status WHERE id = :id AND company_id = :companyId",
      { status, id, companyId }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === TRIPS ===
export const listTrips = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT t.*, v.reg_number, d.user_id AS driver_user_id, IFNULL(d.employee_name, CONCAT(e.first_name, ' ', e.last_name)) as employee_name
      FROM trans_trips t
      LEFT JOIN trans_vehicles v ON t.vehicle_id = v.id
      LEFT JOIN trans_drivers d ON t.driver_id = d.id
      LEFT JOIN hr_employees e ON d.employee_id = e.id
      WHERE t.company_id = :companyId ORDER BY t.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const createTrip = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { request_id, vehicle_id, driver_id, start_time, start_odometer, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, distance, estimated_time } = req.body;
    
    if (!vehicle_id || !driver_id) {
      throw httpError(400, "VALIDATION_ERROR", "Vehicle and Driver are required");
    }

    let route_id = null;
    if (origin_name && destination_name) {
      const [existingRoute] = await query("SELECT id FROM trans_routes WHERE company_id = :companyId AND origin = :origin_name AND destination = :destination_name LIMIT 1", { companyId, origin_name, destination_name });
      if (existingRoute) {
        route_id = existingRoute.id;
      } else {
        const lastRoute = await query("SELECT id FROM trans_routes ORDER BY id DESC LIMIT 1");
        const nextRouteId = (lastRoute && lastRoute.length > 0) ? Number(lastRoute[0].id) + 1 : 1;
        const route_code = "RT-" + String(nextRouteId).padStart(4, '0');
        const route_name = `${origin_name.substring(0, 100)} to ${destination_name.substring(0, 100)}`;
        const routeResult = await query(
          `INSERT INTO trans_routes (company_id, branch_id, route_code, route_name, origin, destination, distance, estimated_time, created_by)
           VALUES (:companyId, :branchId, :route_code, :route_name, :origin_name, :destination_name, :distance, :estimated_time, :userId)`,
          {
            companyId, branchId, route_code, route_name, origin_name, destination_name,
            distance: distance ? Number(distance) : null,
            estimated_time: estimated_time ? Number(estimated_time) : null,
            userId: req.user?.id || null
          }
        );
        route_id = routeResult.insertId;
      }
    }

    const lastTripResult = await query("SELECT id FROM trans_trips ORDER BY id DESC LIMIT 1");
    const nextId = (lastTripResult && lastTripResult.length > 0) ? Number(lastTripResult[0].id) + 1 : 1;
    const trip_number = "TRP-" + String(nextId).padStart(6, '0');
    const result = await query(
      `INSERT INTO trans_trips (company_id, branch_id, trip_number, request_id, route_id, vehicle_id, driver_id, start_time, start_odometer, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, created_by) 
       VALUES (:companyId, :branchId, :trip_number, :request_id, :route_id, :vehicle_id, :driver_id, :start_time, :start_odometer, :origin_name, :origin_lat, :origin_lng, :destination_name, :destination_lat, :destination_lng, :userId)`,
      {
        companyId, branchId, trip_number, 
        request_id: request_id || null, route_id, vehicle_id, driver_id, start_time: start_time || null,
        start_odometer: start_odometer ? Number(start_odometer) : null,
        origin_name: origin_name || null,
        origin_lat: origin_lat ? Number(origin_lat) : null,
        origin_lng: origin_lng ? Number(origin_lng) : null,
        destination_name: destination_name || null,
        destination_lat: destination_lat ? Number(destination_lat) : null,
        destination_lng: destination_lng ? Number(destination_lng) : null,
        userId: req.user?.id || null
      }
    );
    
    // Update vehicle and driver status
    await query("UPDATE trans_vehicles SET status = 'ON_TRIP' WHERE id = :vehicle_id", { vehicle_id });
    await query("UPDATE trans_drivers SET status = 'ON_TRIP' WHERE id = :driver_id", { driver_id });

    if (request_id) {
      await query("UPDATE trans_requests SET status = 'SCHEDULED' WHERE id = :request_id", { request_id });
    }

    // Auto-forward trip document to linked driver user account
    const [driverRow] = await query("SELECT user_id FROM trans_drivers WHERE id = :driver_id LIMIT 1", { driver_id });
    if (driverRow && driverRow.user_id) {
      await sendDocumentForwardNotification({
        userId: driverRow.user_id,
        companyId,
        documentType: 'TRIP',
        documentId: result.insertId,
        documentRef: trip_number,
        title: "New Trip Assigned",
        message: `You have been assigned to trip ${trip_number}.`,
        req
      });
    }

    res.status(201).json({ success: true, data: { id: result.insertId, trip_number } });
  } catch (err) {
    next(err);
  }
};

export const updateTrip = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { request_id, vehicle_id, driver_id, start_time, start_odometer, origin_name, origin_lat, origin_lng, destination_name, destination_lat, destination_lng, distance, estimated_time } = req.body;
    
    if (!vehicle_id || !driver_id) {
      throw httpError(400, "VALIDATION_ERROR", "Vehicle and Driver are required");
    }

    const [existingTrip] = await query("SELECT id FROM trans_trips WHERE id = :id AND company_id = :companyId", { id, companyId });
    if (!existingTrip) throw httpError(404, "NOT_FOUND", "Trip not found");

    let route_id = null;
    if (origin_name && destination_name) {
      const [existingRoute] = await query("SELECT id FROM trans_routes WHERE company_id = :companyId AND origin = :origin_name AND destination = :destination_name LIMIT 1", { companyId, origin_name, destination_name });
      if (existingRoute) {
        route_id = existingRoute.id;
      } else {
        const lastRoute = await query("SELECT id FROM trans_routes ORDER BY id DESC LIMIT 1");
        const nextRouteId = (lastRoute && lastRoute.length > 0) ? Number(lastRoute[0].id) + 1 : 1;
        const route_code = "RT-" + String(nextRouteId).padStart(4, '0');
        const route_name = `${origin_name.substring(0, 100)} to ${destination_name.substring(0, 100)}`;
        const routeResult = await query(
          `INSERT INTO trans_routes (company_id, route_code, route_name, origin, destination, distance, estimated_time, created_by)
           VALUES (:companyId, :route_code, :route_name, :origin_name, :destination_name, :distance, :estimated_time, :userId)`,
          {
            companyId, route_code, route_name, origin_name, destination_name,
            distance: distance ? Number(distance) : null,
            estimated_time: estimated_time ? Number(estimated_time) : null,
            userId: req.user?.id || null
          }
        );
        route_id = routeResult.insertId;
      }
    }

    await query(
      `UPDATE trans_trips SET 
        request_id = :request_id, route_id = :route_id, vehicle_id = :vehicle_id, driver_id = :driver_id, 
        start_time = :start_time, start_odometer = :start_odometer, 
        origin_name = :origin_name, origin_lat = :origin_lat, origin_lng = :origin_lng, 
        destination_name = :destination_name, destination_lat = :destination_lat, destination_lng = :destination_lng 
       WHERE id = :id AND company_id = :companyId`,
      {
        id, companyId, 
        request_id: request_id || null, route_id, vehicle_id, driver_id, start_time: start_time || null,
        start_odometer: start_odometer ? Number(start_odometer) : null,
        origin_name: origin_name || null,
        origin_lat: origin_lat ? Number(origin_lat) : null,
        origin_lng: origin_lng ? Number(origin_lng) : null,
        destination_name: destination_name || null,
        destination_lat: destination_lat ? Number(destination_lat) : null,
        destination_lng: destination_lng ? Number(destination_lng) : null
      }
    );
    
    // Update vehicle and driver status
    await query("UPDATE trans_vehicles SET status = 'ON_TRIP' WHERE id = :vehicle_id", { vehicle_id });
    await query("UPDATE trans_drivers SET status = 'ON_TRIP' WHERE id = :driver_id", { driver_id });

    if (request_id) {
      await query("UPDATE trans_requests SET status = 'SCHEDULED' WHERE id = :request_id", { request_id });
    }

    res.json({ success: true, message: "Trip updated successfully" });
  } catch (err) {
    next(err);
  }
};

// === FUEL & EXPENSES ===
export const listFuelLogs = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT f.*, v.reg_number 
      FROM trans_fuel_logs f
      LEFT JOIN trans_vehicles v ON f.vehicle_id = v.id
      WHERE f.company_id = :companyId ORDER BY f.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const createFuelLog = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { vehicle_id, log_date, odometer_reading, fuel_quantity, cost_per_unit, total_cost, status, notes } = req.body;
    
    const result = await query(
      `INSERT INTO trans_fuel_logs (company_id, branch_id, vehicle_id, log_date, odometer_reading, fuel_quantity, cost_per_unit, total_cost, status, remarks, created_by) 
       VALUES (:companyId, :branchId, :vehicle_id, :log_date, :odometer_reading, :fuel_quantity, :cost_per_unit, :total_cost, :status, :remarks, :userId)`,
      {
        companyId, branchId, vehicle_id, log_date, odometer_reading, fuel_quantity, cost_per_unit, total_cost,
        status: status || 'PENDING', remarks: notes || null,
        userId: req.user?.id || null
      }
    );
    
    // Update vehicle odometer
    await query("UPDATE trans_vehicles SET current_odometer = GREATEST(current_odometer, :odometer_reading) WHERE id = :vehicle_id", 
      { odometer_reading, vehicle_id });

    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

export const getFuelLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const [item] = await query("SELECT * FROM trans_fuel_logs WHERE id = :id AND company_id = :companyId", { id, companyId });
    if (!item) return res.status(404).json({ message: "Fuel log not found" });
    res.json({ success: true, data: { item } });
  } catch (err) {
    next(err);
  }
};

export const updateFuelLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const { vehicle_id, log_date, odometer_reading, fuel_quantity, cost_per_unit, total_cost, fuel_station, notes } = req.body;
    
    await query(
      `UPDATE trans_fuel_logs 
       SET vehicle_id = :vehicle_id, log_date = :log_date, odometer_reading = :odometer_reading, 
           fuel_quantity = :fuel_quantity, cost_per_unit = :cost_per_unit, total_cost = :total_cost,
           remarks = :notes, updated_by = :userId
       WHERE id = :id AND company_id = :companyId`,
      {
        id, companyId, vehicle_id, log_date, odometer_reading, fuel_quantity, cost_per_unit, total_cost,
        notes, userId: req.user?.id || null
      }
    );
    
    // Update vehicle odometer
    await query("UPDATE trans_vehicles SET current_odometer = GREATEST(current_odometer, :odometer_reading) WHERE id = :vehicle_id", 
      { odometer_reading, vehicle_id });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const updateFuelLogStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const { status } = req.body;
    await query("UPDATE trans_fuel_logs SET status = :status WHERE id = :id AND company_id = :companyId", { id, companyId, status });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteFuelLog = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    await query("DELETE FROM trans_fuel_logs WHERE id = :id AND company_id = :companyId", { id, companyId });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === BILLING ===
export const getNextBillingNo = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const [latest] = await query(
      "SELECT invoice_no FROM trans_invoices WHERE company_id = :companyId AND invoice_no LIKE 'TINV-%' ORDER BY id DESC LIMIT 1",
      { companyId }
    );
    let nextNum = 1;
    if (latest && latest.invoice_no) {
      const numMatch = latest.invoice_no.match(/\d+$/);
      if (numMatch) {
        nextNum = parseInt(numMatch[0], 10) + 1;
      }
    }
    const nextNo = `TINV-${String(nextNum).padStart(6, "0")}`;
    res.json({ success: true, nextNo });
  } catch (error) {
    next(error);
  }
};
export const listBilling = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT r.*,
             fu.username AS forwarded_to_username
       FROM trans_invoices r
      LEFT JOIN (
        SELECT t.document_id, t.assigned_to_user_id
        FROM adm_document_workflows t
        JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
        JOIN (
          SELECT document_id, MAX(id) AS max_id
          FROM adm_document_workflows
          WHERE status = 'PENDING'
            AND (document_type = 'TRANSPORT_BILLING' OR document_type = 'Transport Billing' OR document_type = 'TRANSPORT BILLING')
          GROUP BY document_id
        ) m ON m.max_id = t.id
      ) x ON x.document_id = r.id
      LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
      WHERE r.company_id = :companyId
      ORDER BY r.id DESC
    `, { companyId });
    res.json({ success: true, items });
  } catch (err) {
    next(err);
  }
};


// === GPS & POD ===
export const addTripLocation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { latitude, longitude, speed, heading, accuracy, recorded_at, is_initial, origin_name, vehicle_id, driver_id, battery_level, is_offline_point } = req.body;

    const userId = req.user?.id || req.user?.sub || null;

    await query(
      `INSERT INTO trans_trip_locations (trip_id, vehicle_id, driver_id, latitude, longitude, speed, heading, accuracy, battery_level, is_offline_point, recorded_at)
       VALUES (:id, :vehicle_id, :driver_id, :latitude, :longitude, :speed, :heading, :accuracy, :battery_level, :is_offline_point, :recorded_at)`,
      { id, vehicle_id: vehicle_id || null, driver_id: driver_id || userId, latitude, longitude, speed: speed || 0, heading: heading || 0, accuracy: accuracy || 0, battery_level: battery_level || null, is_offline_point: is_offline_point || false, recorded_at: recorded_at ? new Date(recorded_at) : new Date() }
    );

    if (is_initial) {
      const [trip] = await query(`SELECT origin_lat, origin_lng, route_id FROM trans_trips WHERE id = :id`, { id });
      
      let shouldUpdateOrigin = true;
      if (trip && trip.origin_lat && trip.origin_lng) {
        // Haversine distance in meters
        const R = 6371e3;
        const lat1 = trip.origin_lat * Math.PI/180;
        const lat2 = latitude * Math.PI/180;
        const dLat = (latitude - trip.origin_lat) * Math.PI/180;
        const dLng = (longitude - trip.origin_lng) * Math.PI/180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distanceMeters = R * c;
        
        if (distanceMeters <= 20) {
          shouldUpdateOrigin = false;
        }
      }

      if (shouldUpdateOrigin) {
        let finalOriginName = origin_name;
        
        if (!finalOriginName) {
          try {
            let mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.VITE_GOOGLE_MAPS_API_KEY || "";
            if (!mapsKey) {
              const [setting] = await query("SELECT setting_value FROM app_settings WHERE setting_key = 'GOOGLE_MAPS_API_KEY'");
              if (setting && setting.setting_value) mapsKey = setting.setting_value;
            }
            if (mapsKey) {
              const geoRes = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${mapsKey}`);
              const geoData = await geoRes.json();
              if (geoData.results && geoData.results[0]) {
                finalOriginName = geoData.results[0].formatted_address;
              }
            }
          } catch (e) {
            console.error("Backend geocoding failed", e);
          }
        }

        await query(
          `UPDATE trans_trips SET origin_lat = :lat, origin_lng = :lng, origin_name = IFNULL(:name, origin_name) WHERE id = :id`,
          { lat: latitude, lng: longitude, name: finalOriginName, id }
        );
        
        if (trip && trip.route_id && finalOriginName) {
          await query(
            `UPDATE trans_routes SET origin = :name WHERE id = :rid`,
            { name: finalOriginName, rid: trip.route_id }
          );
        }
      }
    }

    try {
      const io = getIO();
      if (io) {
        io.emit("TRIP_LOCATION_UPDATE", {
          tripId: id,
          location: {
            latitude: parseFloat(latitude),
            longitude: parseFloat(longitude),
            speed: speed ? parseFloat(speed) : 0,
            heading: heading ? parseFloat(heading) : 0,
            accuracy: accuracy ? parseFloat(accuracy) : 0,
            recorded_at: recorded_at || new Date().toISOString()
          }
        });
      }
    } catch (e) {
      console.error("Socket emit failed", e);
    }

    res.json({ success: true, message: "Location added successfully" });
  } catch (err) {
    next(err);
  }
};

// === BREAKDOWNS ===
export const listBreakdowns = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(`
      SELECT b.*, v.reg_number, v.make, v.model 
      FROM trans_breakdowns b
      LEFT JOIN trans_vehicles v ON b.vehicle_id = v.id
      WHERE b.company_id = :companyId ORDER BY b.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const createBreakdown = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { 
      defect_date, breakdown_time, driver_name, vehicle_id, 
      fuel_level, details, odometer_reading, reported_by, remarks 
    } = req.body;
    
    if (!defect_date || !breakdown_time) {
      throw httpError(400, "VALIDATION_ERROR", "Defect date and breakdown time are required");
    }

    const result = await query(
      `INSERT INTO trans_breakdowns (
         company_id, branch_id, defect_date, breakdown_time, driver_name, 
         vehicle_id, fuel_level, details, odometer_reading, reported_by, remarks, created_by
       ) 
       VALUES (
         :companyId, :branchId, :defect_date, :breakdown_time, :driver_name, 
         :vehicle_id, :fuel_level, :details, :odometer_reading, :reported_by, :remarks, :userId
       )`,
      {
        companyId, branchId, defect_date, breakdown_time, 
        driver_name: driver_name || null,
        vehicle_id: vehicle_id || null,
        fuel_level: fuel_level || null,
        details: details || null,
        odometer_reading: odometer_reading || null,
        reported_by: reported_by || null,
        remarks: remarks || null,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

export const getTripLocations = async (req, res, next) => {
  try {
    const { id } = req.params;
    const locations = await query(
      "SELECT * FROM trans_trip_locations WHERE trip_id = :id ORDER BY recorded_at ASC",
      { id }
    );
    res.json({ success: true, data: { locations } });
  } catch (err) {
    next(err);
  }
};

export const submitPOD = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { pod_signature_url, pod_photo_url, pod_notes } = req.body;
    await query(
      "UPDATE trans_trips SET status = 'COMPLETED', pod_signature_url = :pod_signature_url, pod_photo_url = :pod_photo_url, pod_notes = :pod_notes, pod_timestamp = NOW() WHERE id = :id",
      { id, pod_signature_url, pod_photo_url, pod_notes }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// ===== INCOME =====
export const listTransportIncome = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    let sql = `SELECT i.*, v.reg_number AS vehicle_reg, t.trip_number AS trip_no, u.username AS created_by_name,
      c_cust.customer_name, cc.name AS cost_center_name,
      CASE 
        WHEN fv.status IN ('DRAFT', 'SUBMITTED') THEN 'PENDING'
        WHEN fv.status IS NOT NULL THEN fv.status
        ELSE i.status 
      END AS status
      FROM trn_transport_income i
      LEFT JOIN trans_vehicles v ON i.vehicle_id = v.id
      LEFT JOIN trans_trips t ON i.trip_id = t.id
      LEFT JOIN adm_users u ON i.recorded_by = u.username
      LEFT JOIN sal_customers c_cust ON i.customer_id = c_cust.id
      LEFT JOIN fin_cost_centers cc ON i.cost_center_id = cc.id
      LEFT JOIN fin_vouchers fv ON i.voucher_id = fv.id
      WHERE i.company_id = :companyId
      ORDER BY i.income_date DESC`;
    const rows = await query(sql, { companyId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createTransportIncome = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    const b = req.body;
    if (!b.amount) throw httpError(400, "VALIDATION_ERROR", "amount required");
    const r = await query(`INSERT INTO trn_transport_income (company_id, branch_id, trip_id, vehicle_id, income_date, category, amount, currency, description, recorded_by, status, customer_id, payment_method, payment_account_id, is_tax_included, tax_code_id, reference_no, cheque_date, cost_center_id)
      VALUES (:companyId, :branchId, :tripId, :vehicleId, :incomeDate, :category, :amount, :currency, :description, :recordedBy, :status, :customerId, :paymentMethod, :paymentAccountId, :isTaxIncluded, :taxCodeId, :referenceNo, :chequeDate, :costCenterId)`, {
      companyId, branchId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      incomeDate: b.income_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING',
      customerId: toNumber(b.customer_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateTransportIncome = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body;
    await query(`UPDATE trn_transport_income SET
      trip_id = :tripId, vehicle_id = :vehicleId, income_date = :incomeDate, category = :category, amount = :amount, currency = :currency,
      description = :description, status = :status, customer_id = :customerId, payment_method = :paymentMethod,
      payment_account_id = :paymentAccountId, is_tax_included = :isTaxIncluded, tax_code_id = :taxCodeId,
      reference_no = :referenceNo, cheque_date = :chequeDate, cost_center_id = :costCenterId
      WHERE id = :id AND company_id = :companyId`, {
      id, companyId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      incomeDate: b.income_date || new Date().toISOString().split('T')[0],
      category: b.category || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      status: b.status || 'PENDING',
      customerId: toNumber(b.customer_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTransportIncome = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM trn_transport_income WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const updateTransportIncomeVoucherId = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const voucherId = toNumber(req.body.voucher_id);
    if (!id || !voucherId) throw httpError(400, "VALIDATION_ERROR", "Invalid id or voucher_id");
    await query(`UPDATE trn_transport_income SET voucher_id = :voucherId WHERE id = :id AND company_id = :companyId`, { id, voucherId, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// ===== EXPENSES =====
export const listTransportExpenses = async (req, res, next) => {
  try {
    const { companyId, branchId = null } = req.scope || {};
    let sql = `SELECT i.*, v.reg_number AS vehicle_reg, t.trip_number AS trip_no, u.username AS created_by_name,
      s.supplier_name, cc.name AS cost_center_name,
      CASE 
        WHEN fv.status IN ('DRAFT', 'SUBMITTED') THEN 'PENDING'
        WHEN fv.status IS NOT NULL THEN fv.status
        ELSE i.status 
      END AS status
      FROM trn_transport_expenses i
      LEFT JOIN trans_vehicles v ON i.vehicle_id = v.id
      LEFT JOIN trans_trips t ON i.trip_id = t.id
      LEFT JOIN adm_users u ON i.recorded_by = u.username
      LEFT JOIN pur_suppliers s ON i.supplier_id = s.id
      LEFT JOIN fin_cost_centers cc ON i.cost_center_id = cc.id
      LEFT JOIN fin_vouchers fv ON i.voucher_id = fv.id
      WHERE i.company_id = :companyId
      ORDER BY i.expense_date DESC`;
    const rows = await query(sql, { companyId });
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createTransportExpense = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope || {};
    const branchId = toNumber(branchIdStr) || 1;
    const b = req.body;
    if (!b.amount) throw httpError(400, "VALIDATION_ERROR", "amount required");
    const r = await query(`INSERT INTO trn_transport_expenses (company_id, branch_id, expense_log_id, vehicle_id, compliance_id, servicing_id, expense_type, expense_date, category, amount, currency, description, recorded_by, status, supplier_id, payment_method, payment_account_id, is_tax_included, tax_code_id, reference_no, cheque_date, cost_center_id)
      VALUES (:companyId, :branchId, :expenseLogId, :vehicleId, :complianceId, :servicingId, :expenseType, :expenseDate, :category, :amount, :currency, :description, :recordedBy, :status, :supplierId, :paymentMethod, :paymentAccountId, :isTaxIncluded, :taxCodeId, :referenceNo, :chequeDate, :costCenterId)`, {
      companyId, branchId,
      expenseLogId: toNumber(b.expense_log_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      complianceId: toNumber(b.compliance_id) || null,
      servicingId: toNumber(b.servicing_id) || null,
      expenseType: b.expense_type || 'Other',
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      category: b.category || b.expense_type || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING',
      supplierId: toNumber(b.supplier_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });

    if (b.expense_log_id && b.status) {
      await query(`UPDATE trans_expense_logs SET status = :status WHERE id = :logId AND company_id = :companyId`, {
        status: b.status,
        logId: toNumber(b.expense_log_id),
        companyId
      });
    }

    res.status(201).json({ id: r.insertId });
  } catch (err) { next(err); }
};

export const updateTransportExpense = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body;
    await query(`UPDATE trn_transport_expenses SET
      expense_log_id = :expenseLogId, vehicle_id = :vehicleId, compliance_id = :complianceId, servicing_id = :servicingId, expense_type = :expenseType, expense_date = :expenseDate, category = :category, amount = :amount, currency = :currency,
      description = :description, status = :status, supplier_id = :supplierId, payment_method = :paymentMethod,
      payment_account_id = :paymentAccountId, is_tax_included = :isTaxIncluded, tax_code_id = :taxCodeId,
      reference_no = :referenceNo, cheque_date = :chequeDate, cost_center_id = :costCenterId
      WHERE id = :id AND company_id = :companyId`, {
      id, companyId,
      expenseLogId: toNumber(b.expense_log_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      complianceId: toNumber(b.compliance_id) || null,
      servicingId: toNumber(b.servicing_id) || null,
      expenseType: b.expense_type || 'Other',
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      category: b.category || b.expense_type || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      status: b.status || 'PENDING',
      supplierId: toNumber(b.supplier_id) || null,
      paymentMethod: b.payment_method || null,
      paymentAccountId: toNumber(b.payment_account_id) || null,
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null,
      referenceNo: b.reference_no || null,
      chequeDate: b.cheque_date || null,
      costCenterId: toNumber(b.cost_center_id) || null,
    });

    if (b.expense_log_id && b.status) {
      await query(`UPDATE trans_expense_logs SET status = :status WHERE id = :logId AND company_id = :companyId`, {
        status: b.status,
        logId: toNumber(b.expense_log_id),
        companyId
      });
    }

    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteTransportExpense = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query(`DELETE FROM trn_transport_expenses WHERE id = :id AND company_id = :companyId`, { id, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const updateTransportExpenseVoucherId = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const voucherId = toNumber(req.body.voucher_id);
    if (!id || !voucherId) throw httpError(400, "VALIDATION_ERROR", "Invalid id or voucher_id");
    await query(`UPDATE trn_transport_expenses SET voucher_id = :voucherId WHERE id = :id AND company_id = :companyId`, { id, voucherId, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

// === FUEL EXPENSES ===
export const listFuelExpenses = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT f.*, v.vehicle_name, v.reg_number, c.customer_name as supplier_name_mapped
       FROM trans_fuel_expenses f
       LEFT JOIN trans_vehicles v ON f.vehicle_id = v.id
       LEFT JOIN sal_customers c ON f.supplier_id = c.id
       WHERE f.company_id = :companyId ORDER BY f.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const createFuelExpense = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = Number(branchIdStr) || 1;
    const { vehicle_id, driver_name, description, supplier_id, supplier_name, expense_type, is_tax_included, tax_code_id, amount, remarks } = req.body;

    const result = await query(
      `INSERT INTO trans_fuel_expenses 
       (company_id, branch_id, vehicle_id, driver_name, description, supplier_id, supplier_name, expense_type, is_tax_included, tax_code_id, amount, remarks, created_by)
       VALUES 
       (:companyId, :branchId, :vehicle_id, :driver_name, :description, :supplier_id, :supplier_name, :expense_type, :is_tax_included, :tax_code_id, :amount, :remarks, :userId)`,
      {
        companyId, branchId, vehicle_id: vehicle_id || null, driver_name: driver_name || null,
        description: description || null, supplier_id: supplier_id || null, supplier_name: supplier_name || null,
        expense_type: expense_type || null, is_tax_included: is_tax_included ? 1 : 0,
        tax_code_id: tax_code_id || null, amount: amount || 0, remarks: remarks || null,
        userId: req.user?.id || null
      }
    );
    res.status(201).json({ success: true, message: "Trip created", data: { id: result.insertId } });
  } catch (err) {
    next(err);
  }
};

export const getTrip = async (req, res, next) => {
  try {
    const { id } = req.params;
    const companyId = req.scope.companyId;

    const [trip] = await query(`
      SELECT t.*, v.reg_number, d.employee_name, r.request_number
      FROM trans_trips t
      LEFT JOIN trans_vehicles v ON t.vehicle_id = v.id
      LEFT JOIN trans_drivers d ON t.driver_id = d.id
      LEFT JOIN trans_requests r ON t.request_id = r.id
      WHERE t.id = :id AND t.company_id = :companyId
    `, { id, companyId });

    if (!trip) {
      return res.status(404).json({ success: false, message: "Trip not found" });
    }

    res.json({ success: true, data: { trip } });
  } catch (err) {
    next(err);
  }
};

export const startTrip = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { start_odometer, latitude, longitude } = req.body;

    const [trip] = await query("SELECT id, vehicle_id, driver_id FROM trans_trips WHERE id = :id AND company_id = :companyId", { id, companyId });
    if (!trip) throw httpError(404, "NOT_FOUND", "Trip not found");

    await query("UPDATE trans_trips SET status = 'STARTED', start_odometer = :start_odometer, start_time = NOW() WHERE id = :id", {
      id, start_odometer: start_odometer ? Number(start_odometer) : null
    });

    await query("UPDATE trans_vehicles SET status = 'ON_TRIP' WHERE id = :vehicle_id", { vehicle_id: trip.vehicle_id });
    await query("UPDATE trans_drivers SET status = 'ON_TRIP' WHERE id = :driver_id", { driver_id: trip.driver_id });

    if (latitude && longitude) {
      await query(
        `INSERT INTO trans_trip_locations (trip_id, vehicle_id, driver_id, latitude, longitude)
         VALUES (:trip_id, :vehicle_id, :driver_id, :latitude, :longitude)`,
        { 
          trip_id: trip.id, 
          vehicle_id: trip.vehicle_id, 
          driver_id: trip.driver_id, 
          latitude: Number(latitude), 
          longitude: Number(longitude) 
        }
      );
      
      try {
        const io = getIO();
        if (io) {
          io.emit("tracking:location_updated", {
            trip_id: trip.id,
            vehicle_id: trip.vehicle_id,
            latitude: Number(latitude),
            longitude: Number(longitude),
            speed: 0,
            heading: 0,
            accuracy: 0,
            timestamp: new Date().toISOString()
          });
        }
      } catch (e) {
        console.error("Socket emit on start failed", e);
      }
    }

    res.json({ success: true, message: "Trip started successfully" });
  } catch (err) {
    next(err);
  }
};

export const returnTrip = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { id } = req.params;
    const { end_time, end_odometer, remarks } = req.body;
    
    // Status can be COMPLETED
    await query(
      `UPDATE trans_trips 
       SET status = 'COMPLETED', end_time = :end_time, end_odometer = :end_odometer, remarks = CONCAT(IFNULL(remarks, ''), '\n', :remarks)
       WHERE id = :id AND company_id = :companyId`,
      { id, companyId, end_time: end_time || null, end_odometer: end_odometer || null, remarks: remarks || '' }
    );

    // Free up driver and vehicle
    const [trip] = await query(`SELECT vehicle_id, driver_id FROM trans_trips WHERE id = :id`, { id });
    if (trip) {
      await query(`UPDATE trans_vehicles SET status = 'AVAILABLE' WHERE id = :vid`, { vid: trip.vehicle_id });
      await query(`UPDATE trans_drivers SET status = 'AVAILABLE' WHERE id = :did`, { did: trip.driver_id });
    }

    // Clear tracking coordinates
    await query(`DELETE FROM trans_trip_locations WHERE trip_id = :id`, { id });

    res.json({ success: true, message: "Trip returned successfully" });
  } catch (err) {
    next(err);
  }
};


// === FUEL BILLS ===
export const listFuelBills = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      "SELECT * FROM trans_fuel_bills WHERE company_id = :companyId ORDER BY id DESC",
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const items = await query("SELECT * FROM trans_fuel_bills WHERE id = :id", { id });
    const details = await query("SELECT * FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    res.json({ success: true, data: { ...items[0], items: details } });
  } catch (err) {
    next(err);
  }
};

export const createFuelBill = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    const result = await query(
      "INSERT INTO trans_fuel_bills (company_id, bill_no, bill_date, supplier_id, total_amount) VALUES (:companyId, :bill_no, :bill_date, :supplier_id, :total_amount)",
      { companyId, bill_no, bill_date: bill_date || new Date(), supplier_id: supplier_id || 0, total_amount: total_amount || 0 }
    );
    const billId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_fuel_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:billId, :item_id, :quantity, :unit_price, :total_amount)",
          { billId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true, data: { id: billId } });
  } catch (err) {
    next(err);
  }
};

export const updateFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bill_no, bill_date, supplier_id, total_amount, items } = req.body;
    await query(
      "UPDATE trans_fuel_bills SET bill_no = :bill_no, bill_date = :bill_date, supplier_id = :supplier_id, total_amount = :total_amount WHERE id = :id",
      { bill_no, bill_date, supplier_id: supplier_id || 0, total_amount: total_amount || 0, id }
    );
    await query("DELETE FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_fuel_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteFuelBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM trans_fuel_bill_details WHERE bill_id = :id", { id });
    await query("DELETE FROM trans_fuel_bills WHERE id = :id", { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === TRANSPORT INVOICES / BILLING ===
export const getBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const items = await query(`
      SELECT r.*,
             fu.username AS forwarded_to_username
       FROM trans_invoices r
      LEFT JOIN (
        SELECT t.document_id, t.assigned_to_user_id
        FROM adm_document_workflows t
        JOIN adm_workflows w ON w.id = t.workflow_id AND w.is_active = 1
        JOIN (
          SELECT document_id, MAX(id) AS max_id
          FROM adm_document_workflows
          WHERE status = 'PENDING'
            AND (document_type = 'TRANSPORT_BILLING' OR document_type = 'Transport Billing' OR document_type = 'TRANSPORT BILLING')
          GROUP BY document_id
        ) m ON m.max_id = t.id
      ) x ON x.document_id = r.id
      LEFT JOIN adm_users fu ON fu.id = x.assigned_to_user_id
      WHERE r.id = :id
    `, { id });
    const details = await query("SELECT * FROM trans_invoice_details WHERE invoice_id = :id", { id });
    res.json({ success: true, data: { ...items[0], items: details } });
  } catch (err) {
    next(err);
  }
};

export const createBilling = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope;
    const branchId = toNumber(branchIdStr) || 1;
    const { invoice_no, invoice_date, customer_id, total_amount, items, trip_id } = req.body;
    const result = await query(
      "INSERT INTO trans_invoices (company_id, branch_id, invoice_no, invoice_date, customer_id, total_amount, trip_id) VALUES (:companyId, :branchId, :invoice_no, :invoice_date, :customer_id, :total_amount, :trip_id)",
      { companyId, branchId, invoice_no: invoice_no || 'INV-TEMP', invoice_date: invoice_date || new Date(), customer_id: customer_id || 0, total_amount: total_amount || 0, trip_id: trip_id || null }
    );
    const invoiceId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_invoice_details (invoice_id, item_id, quantity, unit_price, total_amount) VALUES (:invoiceId, :item_id, :quantity, :unit_price, :total_amount)",
          { invoiceId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true, data: { id: invoiceId } });
  } catch (err) {
    next(err);
  }
};

export const updateBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { invoice_no, invoice_date, customer_id, total_amount, items, trip_id } = req.body;
    await query(
      "UPDATE trans_invoices SET invoice_no = :invoice_no, invoice_date = :invoice_date, customer_id = :customer_id, total_amount = :total_amount, trip_id = :trip_id WHERE id = :id",
      { invoice_no, invoice_date, customer_id: customer_id || 0, total_amount: total_amount || 0, trip_id: trip_id || null, id }
    );
    await query("DELETE FROM trans_invoice_details WHERE invoice_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_invoice_details (invoice_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteBilling = async (req, res, next) => {
  try {
    const { id } = req.params;
    await query("DELETE FROM trans_invoice_details WHERE invoice_id = :id", { id });
    await query("DELETE FROM trans_invoices WHERE id = :id", { id });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const submitBilling = async (req, res, next) => {
  const conn = await pool.getConnection();
  try {
    const { companyId, branchIdStr = '', branchIdsStr = '' } = req.scope || {};
    const branchId = toNumber(branchIdStr) || 1;
    const id = Number(req.params.id);
    const invoices = await query(
      "SELECT id, invoice_no, invoice_date, customer_id, total_amount as net_amount, status, remarks FROM trans_invoices WHERE id = :id AND company_id = :companyId LIMIT 1",
      { id, companyId }
    );
    if (!invoices.length) throw httpError(404, "NOT_FOUND", "Invoice not found");
    const inv = invoices[0];
    if (String(inv.status) === "POSTED") {
      return res.json({ id, status: "POSTED", payment_status: inv.payment_status || "UNPAID" });
    }
    if (String(inv.status) === "PENDING_APPROVAL") {
      throw httpError(400, "BAD_REQUEST", "Document is already pending approval");
    }
    const details = await query(
      "SELECT item_id, quantity, unit_price, total_amount as net_amount FROM trans_invoice_details WHERE invoice_id = :id",
      { id }
    );
    if (!details.length) throw httpError(400, "VALIDATION_ERROR", "No line items");

    let subTotal = 0;
    for (const l of details) {
      subTotal += Number(l.net_amount || 0);
    }
    const grandTotal = subTotal;
    
    const explicitWorkflowId = req.body?.workflow_id == null ? null : Number(req.body.workflow_id);
    const targetUserId = req.body?.target_approver_id == null ? null : Number(req.body.target_approver_id);
    
    let { activeWorkflow: activeWf, inactiveWorkflow } = await resolveWorkflowSelection({
      companyId,
      workflowIdOverride: explicitWorkflowId,
      docRouteBase: "/transport/billing",
      typeSynonyms: ["TRANSPORT_BILLING", "Transport Billing", "TRANSPORT BILLING"],
      amount: grandTotal
    });

    if (!activeWf && targetUserId) {
      // Fallback default workflow
      await conn.execute(
        `INSERT INTO adm_workflows (company_id, workflow_code, workflow_name, module_key, document_type, document_route, is_active)
         SELECT :companyId, 'WF-TB-DEF', 'Default Transport Billing Approval', 'transport', 'TRANSPORT_BILLING', '/transport/billing', 1
         FROM DUAL WHERE NOT EXISTS (
           SELECT 1 FROM adm_workflows
           WHERE company_id = :companyId AND module_key = 'transport' AND document_type = 'TRANSPORT_BILLING' AND workflow_name = 'Default Transport Billing Approval'
         )`,
        { companyId }
      );
      const [wfRows] = await conn.execute(
        `SELECT id FROM adm_workflows WHERE company_id = :companyId AND module_key = 'transport' AND document_type = 'TRANSPORT_BILLING' AND workflow_name = 'Default Transport Billing Approval' LIMIT 1`,
        { companyId }
      );
      if (wfRows?.length) {
        const wfId = wfRows[0].id;
        const [stepsRows] = await conn.execute(`SELECT 1 FROM adm_workflow_steps WHERE workflow_id = :wfId LIMIT 1`, { wfId });
        if (!stepsRows.length) {
          await conn.execute(
            `INSERT INTO adm_workflow_steps (workflow_id, step_order, step_name, approver_user_id, approval_limit, is_mandatory)
             VALUES (:wfId, 1, 'Final Approval', :targetUserId, 999999999, 1)`,
            { wfId, targetUserId }
          );
          await conn.execute(
            `INSERT INTO adm_workflow_step_approvers (workflow_id, step_order, approver_user_id, approval_limit)
             VALUES (:wfId, 1, :targetUserId, 999999999)`,
            { wfId, targetUserId }
          );
        }
        const { activeWorkflow: fallbackWf } = await resolveWorkflowSelection({ companyId, workflowIdOverride: wfId, docRouteBase: "/transport/billing", typeSynonyms: ["TRANSPORT_BILLING"], amount: grandTotal });
        if (fallbackWf) activeWf = fallbackWf;
      }
    }

    const applyPosted = async () => {
      await conn.execute(
        `UPDATE trans_invoices SET status = 'POSTED', payment_status = 'UNPAID' WHERE id = :id`,
        { id }
      );
      await createPostedSalesVoucherForInvoiceTx(conn, {
        companyId,
        branchId, branchIdsStr,
        invoiceId: id,
        invoiceNo: String(inv.invoice_no || ""),
        invoiceDate: inv.invoice_date || new Date().toISOString().slice(0, 10),
        customerId: Number(inv.customer_id || 0),
        grandTotal,
        baseTotal: subTotal,
        taxTotal: 0,
        discountTotal: 0,
        currencyId: null,
        exchangeRate: 1,
        createdBy: req.user?.sub || null,
        lineTaxes: [],
        itemLines: details.map((d) => ({
          item_id: d.item_id,
          quantity: d.quantity,
          unit_price: d.unit_price,
          discount_percent: 0,
        })),
        remarks: inv.remarks || null,
      });
    };

    await conn.beginTransaction();

    if (!activeWf) {
      const behavior = getInactiveWorkflowBehavior(inactiveWorkflow);
      if (!behavior || behavior.toUpperCase() === "AUTO_APPROVE") {
        await applyPosted();
        await conn.commit();
        return res.json({ id, status: "POSTED", payment_status: "UNPAID" });
      } else {
        await conn.commit();
        return res.json({ id, status: "DRAFT", payment_status: "UNPAID" });
      }
    }

    const [firstStep] = await conn.execute(
      `SELECT step_order, approver_user_id
       FROM adm_workflow_steps
       WHERE workflow_id = :wf ORDER BY step_order ASC LIMIT 1`,
      { wf: activeWf.id }
    );
    if (!firstStep || !firstStep.length) {
      throw httpError(400, "BAD_REQUEST", "Workflow has no steps configured");
    }
    const stepOrder = firstStep[0].step_order;
    let assignedTo = targetUserId || firstStep[0].approver_user_id || null;
    if (!assignedTo) {
      const [apprs] = await conn.execute(
        `SELECT approver_user_id FROM adm_workflow_step_approvers WHERE workflow_id = :wf AND step_order = :ord`,
        { wf: activeWf.id, ord: stepOrder }
      );
      if (apprs && apprs.length) {
        assignedTo = apprs[0].approver_user_id;
      }
    }
    if (!assignedTo) {
      throw httpError(400, "BAD_REQUEST", "Workflow step 1 has no approver_user_id configured");
    }

    await conn.execute(
      `UPDATE trans_invoices SET status = 'PENDING_APPROVAL' WHERE id = :id`,
      { id }
    );

    const [dwIns] = await conn.execute(
      `INSERT INTO adm_document_workflows
        (company_id, workflow_id, document_id, document_type, amount, current_step_order, status, assigned_to_user_id)
       VALUES
        (:companyId, :workflowId, :documentId, 'TRANSPORT_BILLING', :amount, :stepOrder, 'PENDING', :assignedTo)`,
      {
        companyId,
        workflowId: activeWf.id,
        documentId: id,
        amount: grandTotal,
        stepOrder,
        assignedTo,
      }
    );
    const dwId = dwIns.insertId;

    await conn.execute(
      `INSERT INTO adm_workflow_tasks
        (company_id, workflow_id, document_workflow_id, document_id, document_type, step_order, assigned_to_user_id, action)
       VALUES
        (:companyId, :workflowId, :dwId, :documentId, 'TRANSPORT_BILLING', :stepOrder, :assignedTo, 'PENDING')`,
      {
        companyId,
        workflowId: activeWf.id,
        dwId,
        documentId: id,
        stepOrder,
        assignedTo,
      }
    );

    await conn.execute(
      `INSERT INTO adm_workflow_logs
        (document_workflow_id, step_order, action, actor_user_id, comments)
       VALUES
        (:dwId, :stepOrder, 'SUBMITTED', :actorId, 'Document submitted for approval')`,
      {
        dwId,
        stepOrder,
        actorId: req.user?.sub || null,
      }
    );

    await conn.commit();
    res.json({ id, status: "PENDING_APPROVAL", payment_status: "UNPAID" });
  } catch (e) {
    try { await conn.rollback(); } catch {}
    next(e);
  } finally {
    conn.release();
  }
};


// === TRANSPORTATION BILLS ===
export const getNextTransportationBillNo = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const [latest] = await query(
      "SELECT bill_no FROM trans_transportation_bills WHERE company_id = :companyId AND bill_no LIKE 'TB-%' ORDER BY id DESC LIMIT 1",
      { companyId }
    );
    let nextNum = 1;
    if (latest && latest.bill_no) {
      const numMatch = latest.bill_no.match(/\d+$/);
      if (numMatch) {
        nextNum = parseInt(numMatch[0], 10) + 1;
      }
    }
    const nextNo = `TB-${String(nextNum).padStart(6, "0")}`;
    res.json({ success: true, nextNo });
  } catch (error) {
    next(error);
  }
};

export const listTransportationBills = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const items = await query(
      `SELECT tb.*, s.supplier_name
       FROM trans_transportation_bills tb
       LEFT JOIN pur_suppliers s ON s.id = tb.supplier_id
       WHERE tb.company_id = :companyId
       ORDER BY tb.id DESC`,
      { companyId }
    );
    res.json({ success: true, data: { items } });
  } catch (err) {
    next(err);
  }
};

export const getTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const rows = await query(
      `SELECT tb.*, s.supplier_name
       FROM trans_transportation_bills tb
       LEFT JOIN pur_suppliers s ON s.id = tb.supplier_id
       WHERE tb.id = :id`,
      { id }
    );
    const details = await query(
      `SELECT tbd.*, ii.item_name, ii.item_code
       FROM trans_transportation_bill_details tbd
       LEFT JOIN inv_items ii ON ii.id = tbd.item_id
       WHERE tbd.bill_id = :id`,
      { id }
    );
    // Map bill_details columns to what the form expects
    const mappedDetails = details.map(d => ({
      ...d,
      desc: d.description || d.item_name || "",
      qty: Number(d.quantity) || 0,
      rate: Number(d.unit_price) || 0,
      line_total: Number(d.total_amount) || 0,
    }));
    res.json({ success: true, data: { item: rows[0] || {}, details: mappedDetails } });
  } catch (err) {
    next(err);
  }
};

export const createTransportationBill = async (req, res, next) => {
  try {
    const { companyId, branchId } = req.scope;
    const { bill_no, bill_date, due_date, supplier_id, total_amount, order_id, items, currency_id, exchange_rate, service_date, cost_center_id } = req.body;
    const result = await query(
      "INSERT INTO trans_transportation_bills (company_id, branch_id, bill_no, bill_date, due_date, supplier_id, total_amount, status, payment_status, currency_id, exchange_rate, service_date, order_id, cost_center_id) VALUES (:companyId, :branchId, :bill_no, :bill_date, :due_date, :supplier_id, :total_amount, 'POSTED', 'UNPAID', :currency_id, :exchange_rate, :service_date, :order_id, :cost_center_id)",
      { companyId, branchId: branchId || null, bill_no, bill_date: bill_date || new Date(), due_date: due_date || bill_date || new Date(), supplier_id: supplier_id || 0, total_amount: total_amount || 0, currency_id: currency_id || null, exchange_rate: exchange_rate || 1, service_date: service_date || null, order_id: order_id || null, cost_center_id: cost_center_id || null }
    );
    const billId = result.insertId;
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_transportation_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:billId, :item_id, :quantity, :unit_price, :total_amount)",
          { billId, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    // Mark the linked expense log as billed and sync status
    if (order_id) {
      await query(
        `UPDATE trans_expense_logs SET bill_id = :billId, status = 'POSTED' WHERE id = :order_id AND company_id = :companyId`,
        { billId, order_id, companyId }
      ).catch(() => {});
    }
    res.json({ success: true, data: { id: billId } });
  } catch (err) {
    next(err);
  }
};

export const updateTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope;
    const { bill_no, bill_date, due_date, supplier_id, total_amount, order_id, items, currency_id, exchange_rate, service_date, cost_center_id } = req.body;
    await query(
      "UPDATE trans_transportation_bills SET bill_no = :bill_no, bill_date = :bill_date, due_date = :due_date, supplier_id = :supplier_id, total_amount = :total_amount, status = 'POSTED', currency_id = :currency_id, exchange_rate = :exchange_rate, service_date = :service_date, order_id = :order_id, cost_center_id = :cost_center_id WHERE id = :id",
      { bill_no, bill_date, due_date: due_date || bill_date || null, supplier_id: supplier_id || 0, total_amount: total_amount || 0, currency_id: currency_id || null, exchange_rate: exchange_rate || 1, service_date: service_date || null, order_id: order_id || null, cost_center_id: cost_center_id || null, id }
    );
    await query("DELETE FROM trans_transportation_bill_details WHERE bill_id = :id", { id });
    if (items && items.length) {
      for (const item of items) {
        await query(
          "INSERT INTO trans_transportation_bill_details (bill_id, item_id, quantity, unit_price, total_amount) VALUES (:id, :item_id, :quantity, :unit_price, :total_amount)",
          { id, item_id: item.item_id || 0, quantity: item.quantity || 0, unit_price: item.unit_price || 0, total_amount: item.total_amount || 0 }
        );
      }
    }
    // Clear old expense log link, then re-link the new one
    await query(
      "UPDATE trans_expense_logs SET bill_id = NULL WHERE bill_id = :id AND company_id = :companyId",
      { id, companyId }
    ).catch(() => {});
    if (order_id) {
      await query(
        `UPDATE trans_expense_logs e
         JOIN trans_transportation_bills tb ON tb.id = :id
         SET e.bill_id = :id, e.status = CASE
             WHEN tb.payment_status = 'FULLY PAID' THEN 'FULLY PAID'
             WHEN tb.payment_status = 'PARTIAL PAYMENT' THEN 'PARTIAL PAYMENT'
             ELSE tb.status
         END
         WHERE e.id = :order_id AND e.company_id = :companyId`,
        { id, order_id, companyId }
      ).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

export const deleteTransportationBill = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { companyId } = req.scope || {};
    
    const prevRows = await query("SELECT bill_no FROM trans_transportation_bills WHERE id = :id", { id });
    const billNo = prevRows[0]?.bill_no;

    await query("DELETE FROM trans_transportation_bill_details WHERE bill_id = :id", { id });
    await query("DELETE FROM trans_transportation_bills WHERE id = :id", { id });

    if (billNo && companyId) {
      const vRows = await query(
        `SELECT DISTINCT v.id AS voucher_id
           FROM fin_vouchers v
           JOIN fin_voucher_lines l ON l.voucher_id = v.id
          WHERE v.company_id = :companyId
            AND l.reference_no = :referenceNo`,
        { companyId, referenceNo: billNo }
      ).catch(() => []);
      const voucherIds = vRows.map((r) => Number(r.voucher_id)).filter((n) => Number.isFinite(n) && n > 0);
      if (voucherIds.length > 0) {
        const inList = voucherIds.join(",");
        await query(`DELETE FROM fin_voucher_lines WHERE voucher_id IN (${inList})`).catch(() => null);
        await query(`DELETE FROM fin_vouchers WHERE id IN (${inList})`).catch(() => null);
      }
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === EXPENSE LOGS ===
export const listExpenseLogs = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const sql = `
      SELECT e.*, e.bill_id,
        t.trip_number as trip_no,
        v.reg_number as vehicle_reg,
        s.supplier_name
      FROM trans_expense_logs e
      LEFT JOIN trans_trips t ON e.trip_id = t.id
      LEFT JOIN trans_vehicles v ON e.vehicle_id = v.id
      LEFT JOIN pur_suppliers s ON e.supplier_id = s.id
      WHERE e.company_id = :companyId AND e.deleted_at IS NULL
      ORDER BY e.expense_date DESC, e.id DESC`;
    const rows = await query(sql, { companyId });
    
    const logIds = rows.map(r => Number(r.id));
    if (logIds.length > 0) {
      const itemsSql = `
        SELECT i.*, it.item_name, it.item_code
        FROM trans_expense_log_items i
        LEFT JOIN inv_items it ON i.item_id = it.id
        WHERE i.log_id IN (${logIds.join(',')})
      `;
      const itemRows = await query(itemsSql, {});
      const itemsByLog = {};
      itemRows.forEach(item => {
        if (!itemsByLog[item.log_id]) itemsByLog[item.log_id] = [];
        itemsByLog[item.log_id].push(item);
      });
      rows.forEach(r => {
        r.items = itemsByLog[r.id] || [];
      });
    } else {
      rows.forEach(r => r.items = []);
    }
    
    res.json({ items: rows });
  } catch (err) { next(err); }
};

export const createExpenseLog = async (req, res, next) => {
  try {
    const { companyId, branchIdStr } = req.scope || {};
    const branchId = toNumber(branchIdStr) || 1;
    const b = req.body;
    if (!b.amount && (!b.items || !b.items.length)) throw httpError(400, "VALIDATION_ERROR", "amount or items required");
    
    const r = await query(`INSERT INTO trans_expense_logs (company_id, branch_id, trip_id, vehicle_id, supplier_id, expense_date, expense_type, amount, currency, description, recorded_by, status, is_tax_included, tax_code_id)
      VALUES (:companyId, :branchId, :tripId, :vehicleId, :supplierId, :expenseDate, :expenseType, :amount, :currency, :description, :recordedBy, :status, :isTaxIncluded, :taxCodeId)`, {
      companyId, branchId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      supplierId: toNumber(b.supplier_id) || null,
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      expenseType: b.expense_type || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      recordedBy: req.user?.username || null,
      status: b.status || 'PENDING',
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null
    });
    
    const logId = r.insertId;
    
    // Auto-generate log_number (e.g., EXL000001)
    const logNumber = `EXL${String(logId).padStart(6, '0')}`;
    await query(`UPDATE trans_expense_logs SET log_number = :logNumber WHERE id = :logId`, { logNumber, logId });
    
    if (b.items && Array.isArray(b.items)) {
      for (const item of b.items) {
        await query(`INSERT INTO trans_expense_log_items (log_id, item_id, uom, quantity, unit_price, total_amount, tax_amount, net_amount)
          VALUES (:logId, :itemId, :uom, :quantity, :unitPrice, :totalAmount, :taxAmount, :netAmount)`, {
          logId,
          itemId: toNumber(item.item_id),
          uom: item.uom || null,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_price || 0),
          totalAmount: Number(item.total_amount || (Number(item.quantity||1)*Number(item.unit_price||0))),
          taxAmount: Number(item.tax_amount || 0),
          netAmount: Number(item.net_amount || 0)
        });
      }
    }
    
    res.status(201).json({ id: logId });
  } catch (err) { next(err); }
};

export const updateExpenseLog = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    const b = req.body;
    await query(`UPDATE trans_expense_logs SET
      trip_id = :tripId, vehicle_id = :vehicleId, supplier_id = :supplierId, expense_date = :expenseDate, expense_type = :expenseType, amount = :amount, currency = :currency,
      description = :description, status = :status, is_tax_included = :isTaxIncluded, tax_code_id = :taxCodeId
      WHERE id = :id AND company_id = :companyId`, {
      id, companyId,
      tripId: toNumber(b.trip_id) || null,
      vehicleId: toNumber(b.vehicle_id) || null,
      supplierId: toNumber(b.supplier_id) || null,
      expenseDate: b.expense_date || new Date().toISOString().split('T')[0],
      expenseType: b.expense_type || 'OTHER',
      amount: Number(b.amount || 0),
      currency: b.currency || 'GHS',
      description: b.description || null,
      status: b.status || 'PENDING',
      isTaxIncluded: b.is_tax_included ? 1 : 0,
      taxCodeId: toNumber(b.tax_code_id) || null
    });
    
    if (b.items && Array.isArray(b.items)) {
      await query(`DELETE FROM trans_expense_log_items WHERE log_id = :id`, { id });
      for (const item of b.items) {
        await query(`INSERT INTO trans_expense_log_items (log_id, item_id, uom, quantity, unit_price, total_amount, tax_amount, net_amount)
          VALUES (:logId, :itemId, :uom, :quantity, :unitPrice, :totalAmount, :taxAmount, :netAmount)`, {
          logId: id,
          itemId: toNumber(item.item_id),
          uom: item.uom || null,
          quantity: Number(item.quantity || 1),
          unitPrice: Number(item.unit_price || 0),
          totalAmount: Number(item.total_amount || (Number(item.quantity||1)*Number(item.unit_price||0))),
          taxAmount: Number(item.tax_amount || 0),
          netAmount: Number(item.net_amount || 0)
        });
      }
    }
    
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const deleteExpenseLog = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const id = toNumber(req.params.id);
    await query("UPDATE trans_expense_logs SET deleted_at = NOW() WHERE id = :id AND company_id = :companyId", { id, companyId });
    res.json({ ok: true });
  } catch (err) { next(err); }
};

export const updateExpenseLogVoucherId = async (req, res, next) => {
  try {
    const { companyId } = req.scope;
    const id = toNumber(req.params.id);
    const { voucher_id } = req.body;
    await query(
      "UPDATE trans_expense_logs SET voucher_id = :voucher_id WHERE id = :id AND company_id = :companyId",
      { voucher_id, id, companyId }
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

// === COMPREHENSIVE TRANSPORT & TRIP EXECUTION ANALYTICS REPORT ===
export const getTransportFullAnalyticsReport = async (req, res, next) => {
  try {
    const { companyId } = req.scope || {};
    const vehicleId = req.query.vehicle_id ? toNumber(req.query.vehicle_id) : null;
    const driverId = req.query.driver_id ? toNumber(req.query.driver_id) : null;
    const status = req.query.status ? String(req.query.status).toUpperCase() : null;

    // 1. Fetch Vehicles
    const vehicleRows = await query(
      "SELECT id, reg_number, make, model, status, capacity, fuel_type FROM trans_vehicles WHERE company_id = :companyId ORDER BY reg_number",
      { companyId }
    ).catch(() => []);

    // 2. Fetch Drivers
    const driverRows = await query(
      "SELECT id, employee_name AS driver_name, license_number, status FROM trans_drivers WHERE company_id = :companyId ORDER BY employee_name",
      { companyId }
    ).catch(() => []);

    // 3. Query Trips
    let tripSql = `
      SELECT t.*, 
             COALESCE(NULLIF(v.reg_number, ''), NULLIF(CONCAT(v.make, ' ', v.model), ' '), CONCAT('Vehicle #', t.vehicle_id)) AS vehicle_name,
             v.reg_number AS reg_number,
             COALESCE(NULLIF(d.employee_name, ''), 'Unassigned Driver') AS driver_name
      FROM trans_trips t
      LEFT JOIN trans_vehicles v ON v.id = t.vehicle_id
      LEFT JOIN trans_drivers d ON d.id = t.driver_id
      WHERE (t.company_id = :companyId OR :companyId IS NULL OR t.company_id = 0)`;

    if (vehicleId) tripSql += ` AND t.vehicle_id = :vehicleId`;
    if (driverId) tripSql += ` AND t.driver_id = :driverId`;
    if (status) tripSql += ` AND UPPER(t.status) = :status`;

    tripSql += ` ORDER BY t.created_at DESC, t.id DESC`;

    const rawTrips = await query(tripSql, { companyId, vehicleId, driverId, status }).catch(() => []);

    // 4. Query Fuel Logs
    const fuelRows = await query(
      "SELECT f.*, v.reg_number AS reg_number FROM trans_fuel_logs f LEFT JOIN trans_vehicles v ON v.id = f.vehicle_id WHERE f.company_id = :companyId ORDER BY f.log_date DESC",
      { companyId }
    ).catch(() => []);

    // 5. Query Expenses / Bills
    const expenseRows = await query(
      "SELECT * FROM trans_expense_logs WHERE company_id = :companyId AND (deleted_at IS NULL)",
      { companyId }
    ).catch(() => []);

    // 6. Query Billing/Invoices for Revenue
    const invoiceRows = await query(
      "SELECT trip_id, net_amount as amount, status FROM trans_invoices WHERE company_id = :companyId",
      { companyId }
    ).catch(() => []);

    const billingRows = await query(
      "SELECT trip_id, amount, status FROM trans_billing WHERE company_id = :companyId AND (deleted_at IS NULL)",
      { companyId }
    ).catch(() => []);

    // 7. Query Routes for Distance
    const routeRows = await query(
      "SELECT id, distance FROM trans_routes WHERE company_id = :companyId AND (deleted_at IS NULL)",
      { companyId }
    ).catch(() => []);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let totalTrips = 0;
    let completedTrips = 0;
    let inTransitTrips = 0;
    let scheduledTrips = 0;
    let delayedTrips = 0;
    let cancelledTrips = 0;
    let totalDistanceKm = 0;
    let totalRevenue = 0;
    let totalTripCost = 0;
    let onTimeCompletedTrips = 0;

    const driverMap = {};
    const vehicleMap = {};

    const items = (rawTrips || []).map((t) => {
      totalTrips++;

      const currentStatus = (t.status || "SCHEDULED").toUpperCase();
      t.status = currentStatus;

      if (currentStatus === "COMPLETED") completedTrips++;
      else if (currentStatus === "IN_TRANSIT") inTransitTrips++;
      else if (currentStatus === "SCHEDULED") scheduledTrips++;
      else if (currentStatus === "DELAYED") delayedTrips++;
      else if (currentStatus === "CANCELLED") cancelledTrips++;

      const tripExpenses = expenseRows.filter(e => e.trip_id === t.id);
      const calculatedCost = tripExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

      const tripInvoices = invoiceRows.filter(i => i.trip_id === t.id && i.status !== 'CANCELLED');
      const tripBilling = billingRows.filter(b => b.trip_id === t.id && b.status !== 'CANCELLED');
      const calculatedRev = tripInvoices.reduce((sum, i) => sum + Number(i.amount || 0), 0) + 
                            tripBilling.reduce((sum, b) => sum + Number(b.amount || 0), 0);

      const route = routeRows.find(r => r.id === t.route_id);
      const calculatedDist = route ? Number(route.distance || 0) : Number((t.end_odometer || 0) - (t.start_odometer || 0));

      const dist = calculatedDist > 0 ? calculatedDist : Number(t.total_distance_km || t.distance_km || 0);
      const rev = calculatedRev > 0 ? calculatedRev : Number(t.revenue || t.total_amount || 0);
      const cost = calculatedCost > 0 ? calculatedCost : Number(t.trip_cost || t.total_cost || 0);

      totalDistanceKm += dist;
      totalRevenue += rev;
      totalTripCost += cost;

      t.profit = rev - cost;
      t.total_distance_km = dist;
      t.revenue = rev;
      t.trip_cost = cost;

      // Calculate SLA & Due Status
      const endDateVal = t.end_time || t.end_date || t.scheduled_end;
      if (currentStatus === "COMPLETED") {
        t.due_status = "COMPLETED";
        t.due_label = "Completed";
        onTimeCompletedTrips++;
      } else if (currentStatus === "DELAYED") {
        t.due_status = "OVERDUE";
        t.due_label = "Delayed Schedule";
      } else if (endDateVal) {
        const sDate = String(endDateVal).split("T")[0];
        const parts = sDate.split("-");
        let dueDate = null;
        if (parts.length === 3) {
          dueDate = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        } else {
          dueDate = new Date(endDateVal);
        }
        dueDate.setHours(0, 0, 0, 0);

        const diffTime = dueDate.getTime() - today.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          const daysOver = Math.abs(diffDays);
          t.due_status = "OVERDUE";
          t.due_label = `Overdue by ${daysOver} d`;
          if (currentStatus !== "CANCELLED") delayedTrips++;
        } else if (diffDays === 0) {
          t.due_status = "DUE_TODAY";
          t.due_label = "Due Today";
        } else {
          t.due_status = "ON_SCHEDULE";
          t.due_label = `In ${diffDays} d`;
        }
      } else {
        t.due_status = "NO_DUE_DATE";
        t.due_label = "—";
      }

      // Aggregations
      const dName = t.driver_name || "Unassigned Driver";
      if (!driverMap[dName]) {
        driverMap[dName] = { name: dName, total: 0, completed: 0, delayed: 0, distance: 0, revenue: 0 };
      }
      driverMap[dName].total++;
      driverMap[dName].distance += dist;
      driverMap[dName].revenue += rev;
      if (currentStatus === "COMPLETED") driverMap[dName].completed++;
      if (t.due_status === "OVERDUE" || currentStatus === "DELAYED") driverMap[dName].delayed++;

      const vName = t.vehicle_name || "Unassigned Vehicle";
      if (!vehicleMap[vName]) {
        vehicleMap[vName] = { name: vName, reg: t.reg_number || "", total: 0, completed: 0, delayed: 0, distance: 0, cost: 0 };
      }
      vehicleMap[vName].total++;
      vehicleMap[vName].distance += dist;
      vehicleMap[vName].cost += cost;
      if (currentStatus === "COMPLETED") vehicleMap[vName].completed++;
      if (t.due_status === "OVERDUE" || currentStatus === "DELAYED") vehicleMap[vName].delayed++;

      return t;
    });

    // Fleet Status Aggregation
    const totalFleet = vehicleRows.length;
    let availableVehicles = 0;
    let inTransitVehicles = 0;
    let maintenanceVehicles = 0;
    let outOfServiceVehicles = 0;

    vehicleRows.forEach((v) => {
      const st = (v.status || "AVAILABLE").toUpperCase();
      if (st === "AVAILABLE" || st === "ACTIVE" || st === "READY") availableVehicles++;
      else if (st === "IN_TRANSIT" || st === "ON_TRIP") inTransitVehicles++;
      else if (st === "MAINTENANCE" || st === "SERVICING") maintenanceVehicles++;
      else outOfServiceVehicles++;
    });

    // Driver Status Aggregation
    const totalDrivers = driverRows.length;
    let availableDrivers = 0;
    let onTripDrivers = 0;
    let offDutyDrivers = 0;

    driverRows.forEach((d) => {
      const st = (d.status || "AVAILABLE").toUpperCase();
      if (st === "AVAILABLE" || st === "ACTIVE" || st === "READY") availableDrivers++;
      else if (st === "ON_TRIP" || st === "IN_TRANSIT") onTripDrivers++;
      else offDutyDrivers++;
    });

    // Fuel Aggregation
    let totalFuelLiters = 0;
    let totalFuelCost = 0;
    fuelRows.forEach((f) => {
      totalFuelLiters += Number(f.liters || f.quantity || 0);
      totalFuelCost += Number(f.total_cost || f.amount || 0);
    });

    const completionRate = totalTrips > 0 ? ((completedTrips / totalTrips) * 100).toFixed(1) : "0.0";
    const onTimeRate = completedTrips > 0 ? ((onTimeCompletedTrips / completedTrips) * 100).toFixed(1) : "0.0";
    const delayRate = totalTrips > 0 ? ((delayedTrips / totalTrips) * 100).toFixed(1) : "0.0";
    const fleetUtilizationRate = totalFleet > 0 ? (((inTransitVehicles + availableVehicles) / totalFleet) * 100).toFixed(1) : "0.0";

    const driverPerformance = Object.values(driverMap).map((d) => ({
      ...d,
      completionRate: d.total > 0 ? ((d.completed / d.total) * 100).toFixed(1) : "0.0"
    })).sort((a, b) => b.total - a.total);

    const vehicleUtilization = Object.values(vehicleMap).map((v) => ({
      ...v,
      completionRate: v.total > 0 ? ((v.completed / v.total) * 100).toFixed(1) : "0.0"
    })).sort((a, b) => b.total - a.total);

    res.json({
      success: true,
      vehicles: vehicleRows,
      drivers: driverRows,
      items,
      analytics: {
        totalTrips,
        completedTrips,
        inTransitTrips,
        scheduledTrips,
        delayedTrips,
        cancelledTrips,
        completionRate: Number(completionRate),
        onTimeRate: Number(onTimeRate),
        delayRate: Number(delayRate),
        totalDistanceKm,
        totalRevenue,
        totalTripCost,
        netProfitability: totalRevenue - totalTripCost,
        
        // Fleet
        totalFleet,
        availableVehicles,
        inTransitVehicles,
        maintenanceVehicles,
        outOfServiceVehicles,
        fleetUtilizationRate: Number(fleetUtilizationRate),

        // Drivers
        totalDrivers,
        availableDrivers,
        onTripDrivers,
        offDutyDrivers,

        // Fuel
        totalFuelLiters,
        totalFuelCost,
        avgFuelCostPerLiter: totalFuelLiters > 0 ? (totalFuelCost / totalFuelLiters).toFixed(2) : "0.00",
        fuelKmPerLiter: totalFuelLiters > 0 ? (totalDistanceKm / totalFuelLiters).toFixed(1) : "0.0",

        // Performance Tables
        driverPerformance,
        vehicleUtilization
      }
    });
  } catch (err) {
    next(err);
  }
};

